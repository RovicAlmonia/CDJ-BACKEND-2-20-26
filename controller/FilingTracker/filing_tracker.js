// ============================================================
// controller/filingTracker/filingMonitor.js
// Manages tblmonitorhdr + tblmonitordtl
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const { logDeletion } = require("../deletedlog/deletedlog");

// ── LOAD FORM METADATA FROM DB ────────────────────────────────
// Builds a lookup map keyed by FormCode from tblbirforms.
// Falls back to an empty object if the table is unavailable.
async function loadFormMeta() {
  try {
    const result = await select({ tableName: "tblbirforms", fields: ["*"] });
    const map = {};
    (result?.data || []).forEach((row) => {
      map[row.FormCode] = {
        name:  row.FormName,
        cat:   row.Category,
        due:   row.DueSchedule,
        start: row.StartOfFiling,
      };
    });
    return map;
  } catch (err) {
    console.error("loadFormMeta error:", err);
    return {};
  }
}

// ── COMPUTE DEADLINE ─────────────────────────────────────────
// Derives a concrete ISO deadline date from the form code + period info.
// Falls back to 14 days from today if no specific rule matches.
function computeDeadline(formcode, periodtype, periodyear, periodmonth, periodquarter) {
  const y = Number(periodyear);

  // Annual income tax returns — April 15 of the following year
  if (["1700","1701","1701A","1702-RT","1702-EX"].includes(formcode)) {
    return `${y + 1}-04-15`;
  }
  // Annual info returns — Jan 31 of following year
  if (["1604-C","2316","1604-F"].includes(formcode)) {
    return `${y + 1}-01-31`;
  }
  // 1604-E — March 1 of following year
  if (formcode === "1604-E") {
    return `${y + 1}-03-01`;
  }
  // Monthly WHT compensation — 10th of the following month
  if (formcode === "1601-C" && periodtype === "Monthly" && periodmonth) {
    const next = new Date(y, periodmonth, 10);
    return next.toISOString().slice(0, 10);
  }
  // Monthly VAT — 20th of following month
  if (formcode === "2550M" && periodtype === "Monthly" && periodmonth) {
    const next = new Date(y, periodmonth, 20);
    return next.toISOString().slice(0, 10);
  }
  // Quarterly forms — 25th of last month of the quarter
  if (
    ["1601-EQ","1601-FQ","2550Q","2551Q","1702Q","1701Q"].includes(formcode) &&
    periodquarter
  ) {
    const qEndMonth = periodquarter * 3; // Q1→3, Q2→6, Q3→9, Q4→12
    return `${y}-${String(qEndMonth).padStart(2, "0")}-25`;
  }

  // Fallback: 14 days from today
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 14);
  return fallback.toISOString().slice(0, 10);
}

// ── GET ALL BIR FORMS (consumed by the Add Monitor dialog) ───
module.exports.selectbirforms = async function (req, res) {
  try {
    const result = await select({ tableName: "tblbirforms", fields: ["*"] });
    res.status(200).json({ success: true, data: result?.data || [] });
  } catch (err) {
    console.error("selectbirforms error:", err);
    res.status(500).json({ success: false, message: "Failed to load BIR forms." });
  }
};

// ── GET ALL MONITORS WITH DETAILS ────────────────────────────
module.exports.selectmonitors = async function (req, res) {
  try {
    const FORM_META = await loadFormMeta();

    const hdrResult = await select({ tableName: "tblmonitorhdr", fields: ["*"] });
    const headers   = Array.isArray(hdrResult?.data) ? hdrResult.data : [];

    const dtlResult = await select({ tableName: "tblmonitordtl", fields: ["*"] });
    const details   = Array.isArray(dtlResult?.data) ? dtlResult.data : [];

    const clientResult = await select({ tableName: "tblclients", fields: ["*"] });
    const clientMap    = {};
    (clientResult?.data || []).forEach((c) => { clientMap[c.ID] = c; });

    const data = headers.map((hdr) => {
      const hdrDetails = details
        .filter((d) => d.MonitorHdrID === hdr.ID)
        .map((d) => {
          const meta = FORM_META[d.FormCode] || {};
          return {
            ...d,
            FormName:      meta.name  || d.FormName    || d.FormCode,
            Category:      meta.cat   || d.Category    || "Other",
            DueSchedule:   meta.due   || d.DueSchedule || "—",
            StartOfFiling: meta.start || d.StartOfFiling || "—",
          };
        });

      const totalForms   = hdrDetails.length;
      const filedCount   = hdrDetails.filter((d) => d.IsFiled === 1).length;
      const overdueCount = hdrDetails.filter((d) => {
        if (d.IsFiled) return false;
        const dl = new Date(d.DeadlineDate);
        dl.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return dl < today;
      }).length;
      const progressPct = totalForms > 0 ? Math.round((filedCount / totalForms) * 100) : 0;

      let overallStatus;
      if (filedCount === totalForms && totalForms > 0) overallStatus = "Complete";
      else if (overdueCount > 0)                       overallStatus = "Overdue";
      else if (filedCount > 0)                         overallStatus = "Incomplete";
      else                                             overallStatus = "Upcoming";

      return {
        ...hdr,
        Client:        clientMap[hdr.ClientID] || {},
        Details:       hdrDetails,
        TotalForms:    totalForms,
        FiledCount:    filedCount,
        OverdueCount:  overdueCount,
        ProgressPct:   progressPct,
        OverallStatus: overallStatus,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("selectmonitors error:", err);
    res.status(500).json({ success: false, message: "Failed to load monitors." });
  }
};

// ── ADD MONITOR HEADER + DETAIL ROWS ─────────────────────────
// Body: { clientid, periodtype, periodyear, periodmonth?, periodquarter?, formcodes[] }
module.exports.postmonitor = async function (req, res) {
  try {
    const {
      clientid, periodtype, periodyear,
      periodmonth, periodquarter, formcodes = [],
    } = req.body;

    if (!clientid || !periodtype || !periodyear || !formcodes.length) {
      return res.status(400).json({
        success: false,
        message: "clientid, periodtype, periodyear and formcodes[] are required.",
      });
    }

    // ── Duplicate check ──────────────────────────────────────
    const dupCheck = await select({
      tableName:  "tblmonitorhdr",
      fields:     ["ID"],
      where:      [
        "ClientID = ?",
        "PeriodType = ?",
        "PeriodYear = ?",
        "COALESCE(PeriodMonth, 0) = ?",
        "COALESCE(PeriodQuarter, 0) = ?",
      ],
      whereValue: [
        clientid,
        periodtype,
        periodyear,
        periodmonth   ?? 0,
        periodquarter ?? 0,
      ],
    });

    if (dupCheck?.data?.length > 0) {
      return res.status(409).json({
        success: false,
        message: `A ${periodtype} monitor for this client already exists for that period.`,
      });
    }

    // ── Verify client exists ─────────────────────────────────
    const clientCheck = await select({
      tableName:  "tblclients",
      fields:     ["ID"],
      where:      ["ID = ?"],
      whereValue: [clientid],
    });
    if (!clientCheck?.data?.length) {
      return res.status(404).json({ success: false, message: "Client not found." });
    }

    // ── Load form metadata from DB ───────────────────────────
    const FORM_META = await loadFormMeta();

    // ── Insert header ────────────────────────────────────────
    const hdrInsert = await insert({
      tableName:  "tblmonitorhdr",
      fieldValue: {
        ClientID:      clientid,
        PeriodType:    periodtype,
        PeriodYear:    periodyear,
        PeriodMonth:   periodmonth   ?? null,
        PeriodQuarter: periodquarter ?? null,
        Remarks:       null,
      },
    });

    const monitorHdrID = hdrInsert?.data?.insertId;
    if (!monitorHdrID) {
      return res.status(500).json({ success: false, message: "Failed to create monitor header." });
    }

    // ── Insert one detail row per form code ──────────────────
    const dtlInserts = [];
    for (const code of formcodes) {
      const meta         = FORM_META[code] || {};
      const deadlineDate = computeDeadline(code, periodtype, periodyear, periodmonth, periodquarter);
      const inserted = await insert({
        tableName:  "tblmonitordtl",
        fieldValue: {
          MonitorHdrID:  monitorHdrID,
          ClientID:      clientid,
          FormCode:      code,
          FormName:      meta.name  || code,
          Category:      meta.cat   || "Other",
          DueSchedule:   meta.due   || "—",
          StartOfFiling: meta.start || "—",
          DeadlineDate:  deadlineDate,
          IsFiled:       0,
          FiledDate:     null,
          FiledBy:       null,
          Remarks:       null,
        },
      });
      dtlInserts.push(inserted);
    }

    res.status(201).json({ success: true, data: { hdrID: monitorHdrID, details: dtlInserts } });
  } catch (err) {
    console.error("postmonitor error:", err);
    res.status(500).json({ success: false, message: "Failed to create monitor record." });
  }
};

// ── AUTO-RENEW: create next period when all forms in a header are filed ──
async function maybeRenew(monitorHdrID) {
  const hdr = (await select({
    tableName:  "tblmonitorhdr",
    fields:     ["*"],
    where:      ["ID = ?"],
    whereValue: [monitorHdrID],
  }))?.data?.[0];
  if (!hdr) return;

  const details = (await select({
    tableName:  "tblmonitordtl",
    fields:     ["IsFiled"],
    where:      ["MonitorHdrID = ?"],
    whereValue: [monitorHdrID],
  }))?.data || [];

  const allFiled = details.length > 0 && details.every((d) => d.IsFiled === 1);
  if (!allFiled) return;

  // Compute next period values
  let nextMonth   = hdr.PeriodMonth;
  let nextQuarter = hdr.PeriodQuarter;
  let nextYear    = hdr.PeriodYear;

  if (hdr.PeriodType === "Monthly") {
    nextMonth = (hdr.PeriodMonth % 12) + 1;
    if (nextMonth === 1) nextYear += 1;
  } else if (hdr.PeriodType === "Quarterly") {
    nextQuarter = (hdr.PeriodQuarter % 4) + 1;
    if (nextQuarter === 1) nextYear += 1;
  } else {
    nextYear += 1;
  }

  // Guard: skip if next period already exists
  const existing = await select({
    tableName:  "tblmonitorhdr",
    fields:     ["ID"],
    where:      [
      "ClientID = ?",
      "PeriodType = ?",
      "PeriodYear = ?",
      "COALESCE(PeriodMonth, 0) = ?",
      "COALESCE(PeriodQuarter, 0) = ?",
    ],
    whereValue: [
      hdr.ClientID,
      hdr.PeriodType,
      nextYear,
      nextMonth   ?? 0,
      nextQuarter ?? 0,
    ],
  });
  if (existing?.data?.length > 0) return;

  // Carry forward the same form codes from the current period
  const currentDetails = (await select({
    tableName:  "tblmonitordtl",
    fields:     ["FormCode"],
    where:      ["MonitorHdrID = ?"],
    whereValue: [monitorHdrID],
  }))?.data || [];
  const formCodes = currentDetails.map((d) => d.FormCode);

  // Load fresh metadata from DB for the renewed detail rows
  const FORM_META = await loadFormMeta();

  // Insert new header for the next period
  const newHdr = await insert({
    tableName:  "tblmonitorhdr",
    fieldValue: {
      ClientID:      hdr.ClientID,
      PeriodType:    hdr.PeriodType,
      PeriodYear:    nextYear,
      PeriodMonth:   nextMonth   ?? null,
      PeriodQuarter: nextQuarter ?? null,
      Remarks:       null,
    },
  });
  const newHdrID = newHdr?.data?.insertId;
  if (!newHdrID) return;

  // Insert detail rows with freshly computed deadlines
  for (const code of formCodes) {
    const meta         = FORM_META[code] || {};
    const deadlineDate = computeDeadline(code, hdr.PeriodType, nextYear, nextMonth, nextQuarter);
    await insert({
      tableName:  "tblmonitordtl",
      fieldValue: {
        MonitorHdrID:  newHdrID,
        ClientID:      hdr.ClientID,
        FormCode:      code,
        FormName:      meta.name  || code,
        Category:      meta.cat   || "Other",
        DueSchedule:   meta.due   || "—",
        StartOfFiling: meta.start || "—",
        DeadlineDate:  deadlineDate,
        IsFiled:       0,
        FiledDate:     null,
        FiledBy:       null,
        Remarks:       null,
      },
    });
  }
}

// ── UPDATE A DETAIL ROW (mark filed / unmark) ─────────────────
// Body: { id, isfiled, fileddate?, filedby?, remarks? }
module.exports.updatemonitordtl = async function (req, res) {
  try {
    const { id, isfiled, fileddate, filedby, remarks } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required." });
    }

    const data = await update({
      tableName:  "tblmonitordtl",
      fieldValue: {
        ID:        id,
        IsFiled:   isfiled ? 1 : 0,
        FiledDate: isfiled ? (fileddate || new Date().toISOString().slice(0, 10)) : null,
        FiledBy:   isfiled ? (filedby   || null) : null,
        Remarks:   remarks || null,
      },
    });

    // Auto-renew: if all sibling forms are now filed, create the next period
    const dtlRow = (await select({
      tableName:  "tblmonitordtl",
      fields:     ["MonitorHdrID"],
      where:      ["ID = ?"],
      whereValue: [id],
    }))?.data?.[0];
    if (dtlRow?.MonitorHdrID) {
      await maybeRenew(dtlRow.MonitorHdrID);
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("updatemonitordtl error:", err);
    res.status(500).json({ success: false, message: "Failed to update filing detail." });
  }
};

// ── DELETE MONITOR HEADER + ALL ITS DETAILS ──────────────────
module.exports.deletemonitor = async function (req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required." });
    }

    // Fetch header for audit log
    const hdrResult = await select({
      tableName:  "tblmonitorhdr",
      fields:     ["*"],
      where:      ["ID = ?"],
      whereValue: [id],
    });
    const hdr = hdrResult?.data?.[0];

    // Fetch details for audit log
    const dtlResult = await select({
      tableName:  "tblmonitordtl",
      fields:     ["*"],
      where:      ["MonitorHdrID = ?"],
      whereValue: [id],
    });
    const dtls = dtlResult?.data || [];

    // Delete detail rows first (FK constraint)
    if (dtls.length > 0) {
      await remove({
        tableName:  "tblmonitordtl",
        where:      ["MonitorHdrID = ?"],
        whereValue: [id],
      });
    }

    // Delete header
    const data = await remove({
      tableName:  "tblmonitorhdr",
      where:      ["ID = ?"],
      whereValue: [id],
    });

    // Audit log
    if (hdr) {
      await logDeletion(
        "MonitorHdr",
        hdr.ID,
        `Monitor #${hdr.ID} — Client #${hdr.ClientID} · ${hdr.PeriodType} ${hdr.PeriodYear}`,
        { header: hdr, details: dtls },
        req.body?.deletedBy || req.user?.username || "system"
      );
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("deletemonitor error:", err);
    res.status(500).json({ success: false, message: "Failed to delete monitor record." });
  }
};