// ============================================================
// controller/monitor/monitor.js
// Manages tblmonitorhdr + tblmonitordtl
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const { logDeletion } = require("../deletedlog/deletedlog");

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function computeDeadline(formCode, periodType, year, month, quarter) {
  const pad     = (n) => String(n).padStart(2, "0");
  const lastDay = (y, m) => new Date(y, m, 0).getDate();

  if (periodType === "Monthly") {
    let nm = month + 1, ny = year;
    if (nm > 12) { nm = 1; ny++; }
    if (formCode === "1601-C") return `${ny}-${pad(nm)}-10`;
    if (formCode === "2550M")  return `${ny}-${pad(nm)}-20`;
    return `${ny}-${pad(nm)}-${pad(lastDay(ny, nm))}`;
  }

  if (periodType === "Quarterly") {
    const qEnd = quarter * 3;
    let fm = qEnd + 1, fy = year;
    if (fm > 12) { fm = 1; fy++; }
    if (["2550Q","2551Q"].includes(formCode))
      return `${year}-${pad(qEnd)}-25`;
    if (["1601-EQ","1601-FQ","1701Q","1702Q"].includes(formCode))
      return `${fy}-${pad(fm)}-${pad(lastDay(fy, fm))}`;
    return `${fy}-${pad(fm)}-${pad(lastDay(fy, fm))}`;
  }

  // Annual
  const ANNUAL = {
    "1700":"04-15","1701":"04-15","1701A":"04-15","1702-RT":"04-15","1702-EX":"04-15",
    "1604-C":"01-31","1604-F":"01-31","2316":"01-31","1604-E":"03-01","0605":"12-31",
  };
  return `${year}-${ANNUAL[formCode] || "04-15"}`;
}

function deriveStatus(deadlineDate, isFiled) {
  if (isFiled) return "Filed";
  const today = new Date(); today.setHours(0,0,0,0);
  const dl    = Math.ceil((new Date(deadlineDate) - today) / 86400000);
  if (dl < 0)  return "Overdue";
  if (dl <= 7) return "Pending";
  return "Upcoming";
}

// ─────────────────────────────────────────────────────────────
// SAFE SELECT HELPER — always returns an array, never throws
// ─────────────────────────────────────────────────────────────
async function safeSelect(params) {
  try {
    const result = await select(params);
    return Array.isArray(result?.data) ? result.data : [];
  } catch (e) {
    console.error("safeSelect error:", e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// GET all monitors with details + client info
// ─────────────────────────────────────────────────────────────
module.exports.selectmonitors = async function (req, res) {
  try {
    const [headers, details, clients, forms] = await Promise.all([
      safeSelect({ tableName: "tblmonitorhdr", fields: ["*"] }),
      safeSelect({ tableName: "tblmonitordtl", fields: ["*"] }),
      safeSelect({ tableName: "tblclients",    fields: ["ID","ClientID","LNF","TradeName","Type","Status","RetentionType"] }),
      safeSelect({ tableName: "tblbirforms",   fields: ["*"] }),
    ]);

    const clientMap = Object.fromEntries(clients.map((c) => [c.ID, c]));
    const formMap   = Object.fromEntries(forms.map((f) => [f.FormCode, f]));

    const data = headers.map((hdr) => {
      const hdrDetails = details
        .filter((d) => d.MonitorHdrID === hdr.ID)
        .map((d) => ({
          ...d,
          CurrentStatus: deriveStatus(d.DeadlineDate, d.IsFiled),
          FormName:      formMap[d.FormCode]?.FormName    || d.FormCode,
          Category:      formMap[d.FormCode]?.Category    || "Other",
          DueSchedule:   formMap[d.FormCode]?.DueSchedule || "—",
        }));

      const total    = hdrDetails.length;
      const filed    = hdrDetails.filter((d) => d.IsFiled === 1).length;
      const overdue  = hdrDetails.filter((d) => d.CurrentStatus === "Overdue").length;
      const progress = total > 0 ? Math.round((filed / total) * 100) : 0;
      const overall  = filed === total && total > 0 ? "Complete"
                     : overdue > 0 ? "Overdue"
                     : filed > 0   ? "Pending"
                     : "Upcoming";

      return {
        ...hdr,
        Client:        clientMap[hdr.ClientID] || null,
        Details:       hdrDetails,
        TotalForms:    total,
        FiledCount:    filed,
        OverdueCount:  overdue,
        ProgressPct:   progress,
        OverallStatus: overall,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("selectmonitors error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET monitors for one client
// ─────────────────────────────────────────────────────────────
module.exports.selectmonitorsbyclient = async function (req, res) {
  try {
    const { clientid } = req.query;

    const [headers, details, forms] = await Promise.all([
      safeSelect({ tableName: "tblmonitorhdr", fields: ["*"], where: ["ClientID = ?"], whereValue: [clientid] }),
      safeSelect({ tableName: "tblmonitordtl", fields: ["*"], where: ["ClientID = ?"], whereValue: [clientid] }),
      safeSelect({ tableName: "tblbirforms",   fields: ["*"] }),
    ]);

    const formMap = Object.fromEntries(forms.map((f) => [f.FormCode, f]));

    const data = headers.map((hdr) => {
      const hdrDetails = details
        .filter((d) => d.MonitorHdrID === hdr.ID)
        .map((d) => ({
          ...d,
          CurrentStatus: deriveStatus(d.DeadlineDate, d.IsFiled),
          FormName:      formMap[d.FormCode]?.FormName    || d.FormCode,
          Category:      formMap[d.FormCode]?.Category    || "Other",
          DueSchedule:   formMap[d.FormCode]?.DueSchedule || "—",
        }));

      const total = hdrDetails.length;
      const filed = hdrDetails.filter((d) => d.IsFiled === 1).length;
      return {
        ...hdr,
        Details:     hdrDetails,
        TotalForms:  total,
        FiledCount:  filed,
        ProgressPct: total > 0 ? Math.round((filed / total) * 100) : 0,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("selectmonitorsbyclient error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST — create monitor header + auto-generate detail rows
// Body: { clientid, periodtype, periodyear, periodmonth?,
//         periodquarter?, formcodes[], createdby? }
// ─────────────────────────────────────────────────────────────
module.exports.postmonitor = async function (req, res) {
  try {
    const {
      clientid, periodtype, periodyear,
      periodmonth = null, periodquarter = null,
      formcodes = [], createdby = "system",
    } = req.body;

    // ── Validate required fields ──────────────────────────────
    if (!clientid || !periodtype || !periodyear || !formcodes.length) {
      return res.status(400).json({
        success: false,
        message: "clientid, periodtype, periodyear, formcodes[] are required.",
      });
    }

    // ── Prevent duplicate period for same client ──────────────
    const existing = await safeSelect({
      tableName:  "tblmonitorhdr",
      fields:     ["ID"],
      where:      ["ClientID = ?","PeriodType = ?","PeriodYear = ?","PeriodMonth <=> ?","PeriodQuarter <=> ?"],
      whereValue: [clientid, periodtype, periodyear, periodmonth, periodquarter],
    });
    if (existing.length > 0) {
      return res.status(409).json({
        success:    false,
        message:    "Monitor record already exists for this client and period.",
        existingID: existing[0].ID,
      });
    }

    // ── Insert header ─────────────────────────────────────────
    const hdrInsert = await insert({
      tableName:  "tblmonitorhdr",
      fieldValue: {
        ClientID:      clientid,
        PeriodType:    periodtype,
        PeriodYear:    periodyear,
        PeriodMonth:   periodmonth,
        PeriodQuarter: periodquarter,
        OverallStatus: "Upcoming",
        CreatedBy:     createdby,
      },
    });

    // ── Extract insertId — mainModel returns { success, message, id }
    const hdrID = hdrInsert?.id
               ?? hdrInsert?.insertId
               ?? hdrInsert?.data?.insertId
               ?? null;

    if (!hdrID) {
      console.error("postmonitor: hdrInsert result =", JSON.stringify(hdrInsert));
      return res.status(500).json({
        success: false,
        message: "Header inserted but could not retrieve insertId. Check mainModel return shape.",
      });
    }

    // ── Insert one detail row per form code ───────────────────
    const dtlResults = [];
    for (const code of formcodes) {
      const deadline = computeDeadline(
        code, periodtype,
        Number(periodyear),
        periodmonth   ? Number(periodmonth)   : null,
        periodquarter ? Number(periodquarter) : null,
      );
      const status = deriveStatus(deadline, false);

      const dtl = await insert({
        tableName:  "tblmonitordtl",
        fieldValue: {
          MonitorHdrID: hdrID,      // ← guaranteed non-null now
          ClientID:     clientid,
          FormCode:     code,
          DeadlineDate: deadline,
          IsFiled:      0,
          Status:       status,
        },
      });

      dtlResults.push({ formCode: code, deadline, status, insertId: dtl?.id ?? dtl?.insertId ?? dtl?.data?.insertId });
    }

    res.status(200).json({ success: true, hdrID, details: dtlResults });
  } catch (err) {
    console.error("postmonitor error:", err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT — update monitor header (status / remarks)
// ─────────────────────────────────────────────────────────────
module.exports.updatemonitorhdr = async function (req, res) {
  try {
    const { id, overallstatus, remarks } = req.body;
    const data = await update({
      tableName:  "tblmonitorhdr",
      fieldValue: { ID: id, OverallStatus: overallstatus, Remarks: remarks || null },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("updatemonitorhdr error:", err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST — update detail row (mark filed / unfiled)
// Body: { id, isfiled, fileddate?, filedby?, remarks? }
// ─────────────────────────────────────────────────────────────
module.exports.updatemonitordtl = async function (req, res) {
  try {
    const { id, isfiled, fileddate, filedby, remarks } = req.body;

    // ── Fetch existing detail ─────────────────────────────────
    const existing = await safeSelect({
      tableName:  "tblmonitordtl",
      fields:     ["*"],
      where:      ["ID = ?"],
      whereValue: [id],
    });
    const record = existing[0];
    if (!record) {
      return res.status(404).json({ success: false, message: "Detail record not found." });
    }

    const newStatus = deriveStatus(record.DeadlineDate, isfiled);

    // ── Update the detail row ─────────────────────────────────
    const data = await update({
      tableName:  "tblmonitordtl",
      fieldValue: {
        ID:        id,
        IsFiled:   isfiled ? 1 : 0,
        FiledDate: isfiled ? (fileddate || new Date().toISOString().slice(0, 10)) : null,
        FiledBy:   filedby  || null,
        Remarks:   remarks  || null,
        Status:    newStatus,
      },
    });

    // ── Recompute header OverallStatus ────────────────────────
    const allDtls = await safeSelect({
      tableName:  "tblmonitordtl",
      fields:     ["IsFiled","DeadlineDate"],
      where:      ["MonitorHdrID = ?"],
      whereValue: [record.MonitorHdrID],
    });

    const total   = allDtls.length;
    const filed   = allDtls.filter((d) => d.IsFiled === 1).length;
    const hasOver = allDtls.some((d) => deriveStatus(d.DeadlineDate, d.IsFiled) === "Overdue");
    const newHdr  = filed === total && total > 0 ? "Complete"
                  : hasOver    ? "Overdue"
                  : filed > 0  ? "Pending"
                  : "Upcoming";

    await update({
      tableName:  "tblmonitorhdr",
      fieldValue: { ID: record.MonitorHdrID, OverallStatus: newHdr },
    });

    res.status(200).json({
      success:         true,
      data,
      newDetailStatus: newStatus,
      newHdrStatus:    newHdr,
      progressPct:     total > 0 ? Math.round((filed / total) * 100) : 0,
      filedCount:      filed,
      totalForms:      total,
    });
  } catch (err) {
    console.error("updatemonitordtl error:", err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE monitor (cascades to tblmonitordtl)
// ─────────────────────────────────────────────────────────────
module.exports.deletemonitor = async function (req, res) {
  try {
    const { id } = req.query;

    const existing = await safeSelect({
      tableName:  "tblmonitorhdr",
      fields:     ["*"],
      where:      ["ID = ?"],
      whereValue: [id],
    });
    const record = existing[0];

    const data = await remove({
      tableName:  "tblmonitorhdr",
      where:      ["ID = ?"],
      whereValue: [id],
    });

    if (record) {
      await logDeletion(
        "MonitorRecord",
        record.ID,
        `Monitor #${record.ID} — Client ${record.ClientID} (${record.PeriodType} ${record.PeriodYear})`,
        record,
        req.body?.deletedBy || req.user?.username || "system",
      );
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("deletemonitor error:", err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET notifications — unfiled forms overdue or due within N days
// ─────────────────────────────────────────────────────────────
module.exports.getnotifications = async function (req, res) {
  try {
    const daysAhead = parseInt(req.query.days || "7", 10);

    const [details, clients, forms, headers] = await Promise.all([
      safeSelect({ tableName: "tblmonitordtl", fields: ["*"] }),
      safeSelect({ tableName: "tblclients",    fields: ["ID","ClientID","LNF","TradeName","Type","RetentionType"] }),
      safeSelect({ tableName: "tblbirforms",   fields: ["*"] }),
      safeSelect({ tableName: "tblmonitorhdr", fields: ["*"] }),
    ]);

    const clientMap = Object.fromEntries(clients.map((c) => [c.ID, c]));
    const formMap   = Object.fromEntries(forms.map((f) => [f.FormCode, f]));
    const hdrMap    = Object.fromEntries(headers.map((h) => [h.ID, h]));

    const today = new Date(); today.setHours(0,0,0,0);

    const notifications = details
      .filter((d) => d.IsFiled === 0)
      .map((d) => ({
        ...d,
        dl: Math.ceil((new Date(d.DeadlineDate) - today) / 86400000),
      }))
      .filter((d) => d.dl <= daysAhead)
      .map((d) => ({
        DetailID:      d.ID,
        MonitorHdrID:  d.MonitorHdrID,
        ClientID:      d.ClientID,
        ClientCode:    clientMap[d.ClientID]?.ClientID  || "—",
        ClientName:    clientMap[d.ClientID]?.TradeName || clientMap[d.ClientID]?.LNF || "Unknown",
        ClientType:    clientMap[d.ClientID]?.Type      || "—",
        FormCode:      d.FormCode,
        FormName:      formMap[d.FormCode]?.FormName    || d.FormCode,
        Category:      formMap[d.FormCode]?.Category    || "—",
        PeriodType:    hdrMap[d.MonitorHdrID]?.PeriodType    || "—",
        PeriodYear:    hdrMap[d.MonitorHdrID]?.PeriodYear    || "—",
        PeriodMonth:   hdrMap[d.MonitorHdrID]?.PeriodMonth   || null,
        PeriodQuarter: hdrMap[d.MonitorHdrID]?.PeriodQuarter || null,
        DeadlineDate:  d.DeadlineDate,
        DaysLeft:      d.dl,
        Severity:      d.dl < 0 ? "overdue" : d.dl <= 3 ? "critical" : "warning",
      }))
      .sort((a, b) => a.DaysLeft - b.DaysLeft);

    res.status(200).json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    console.error("getnotifications error:", err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET monitor summary — quick stats
// ─────────────────────────────────────────────────────────────
module.exports.getmonitorsummary = async function (req, res) {
  try {
    const details = await safeSelect({ tableName: "tblmonitordtl", fields: ["*"] });

    const today = new Date(); today.setHours(0,0,0,0);
    let filed = 0, overdue = 0, dueThisWeek = 0, upcoming = 0;

    details.forEach((d) => {
      if (d.IsFiled === 1) { filed++; return; }
      const dl = Math.ceil((new Date(d.DeadlineDate) - today) / 86400000);
      if (dl < 0)       overdue++;
      else if (dl <= 7) dueThisWeek++;
      else              upcoming++;
    });

    res.status(200).json({
      success: true,
      data: { totalForms: details.length, filed, overdue, dueThisWeek, upcoming },
    });
  } catch (err) {
    console.error("getmonitorsummary error:", err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};