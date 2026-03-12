// ============================================================
// controller/filingTracker/filingTracker.js
// Manages tblclientfilings + tblbirforms
// Columns from tblclients: ID, ClientID, LNF, TradeName, Type, Status, RetentionType
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const { logDeletion } = require("../deletedlog/deletedlog");

// ── GET ALL CLIENTS WITH FILING PROGRESS ─────────────────────
module.exports.selectfilingtracker = async function (req, res) {
  const clientResult = await select({ tableName: "tblclients", fields: ["*"] });
  const clients = Array.isArray(clientResult?.data) ? clientResult.data : [];

  const filingResult = await select({ tableName: "tblclientfilings", fields: ["*"] });
  const filings = Array.isArray(filingResult?.data) ? filingResult.data : [];

  const formResult = await select({ tableName: "tblbirforms", fields: ["*"] });
  const formMap = {};
  (formResult?.data || []).forEach((f) => { formMap[f.FormCode] = f; });

  const data = clients.map((client) => {
    const clientFilings = filings
      .filter((f) => f.ClientID === client.ID)
      .map((f) => ({
        ...f,
        FormName:    formMap[f.FormCode]?.FormName    || f.FormCode,
        Category:    formMap[f.FormCode]?.Category    || "Other",
        DueSchedule: formMap[f.FormCode]?.DueSchedule || "—",
      }));

    const totalFilings = clientFilings.length;
    const filedCount   = clientFilings.filter((f) => f.IsFiled === 1).length;
    const progressPct  = totalFilings > 0 ? Math.round((filedCount / totalFilings) * 100) : 0;

    return {
      ID: client.ID, ClientID: client.ClientID, LNF: client.LNF,
      TradeName: client.TradeName, Type: client.Type, Status: client.Status,
      RetentionType: client.RetentionType, DateRegistered: client.DateRegistered,
      DateExpiration: client.DateExpiration, EFPSAccount: client.EFPSAccount,
      Filings: clientFilings, TotalFilings: totalFilings,
      FiledCount: filedCount, ProgressPct: progressPct,
    };
  });

  res.status(200).json({ success: true, data });
};

// ── GET SINGLE CLIENT WITH FILINGS ───────────────────────────
module.exports.selectfilingtrackerbyid = async function (req, res) {
  const { id } = req.query;

  const clientResult = await select({
    tableName: "tblclients", fields: ["*"],
    where: ["ID = ?"], whereValue: [id],
  });
  const client = clientResult?.data?.[0];
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const filingResult = await select({
    tableName: "tblclientfilings", fields: ["*"],
    where: ["ClientID = ?"], whereValue: [id],
  });
  const filings = Array.isArray(filingResult?.data) ? filingResult.data : [];

  const formResult = await select({ tableName: "tblbirforms", fields: ["*"] });
  const formMap = {};
  (formResult?.data || []).forEach((f) => { formMap[f.FormCode] = f; });

  const clientFilings = filings.map((f) => ({
    ...f,
    FormName:    formMap[f.FormCode]?.FormName    || f.FormCode,
    Category:    formMap[f.FormCode]?.Category    || "Other",
    DueSchedule: formMap[f.FormCode]?.DueSchedule || "—",
  }));

  const totalFilings = clientFilings.length;
  const filedCount   = clientFilings.filter((f) => f.IsFiled === 1).length;
  const progressPct  = totalFilings > 0 ? Math.round((filedCount / totalFilings) * 100) : 0;

  res.status(200).json({
    success: true,
    data: { ...client, Filings: clientFilings, TotalFilings: totalFilings, FiledCount: filedCount, ProgressPct: progressPct },
  });
};

// ── ASSIGN BIR FORMS TO A CLIENT ─────────────────────────────
// Body: { clientid: <tblclients.ID integer>, formcodes: ["1601-C", "2550M"] }
module.exports.postfilingtracker = async function (req, res) {
  const { clientid, formcodes = [] } = req.body;

  if (!clientid || !formcodes.length)
    return res.status(400).json({ success: false, message: "clientid and formcodes[] are required." });

  const clientCheck = await select({ tableName: "tblclients", fields: ["ID"], where: ["ID = ?"], whereValue: [clientid] });
  if (!clientCheck?.data?.length)
    return res.status(404).json({ success: false, message: "Client not found." });

  const results = [], skipped = [];
  for (const code of formcodes) {
    const existing = await select({ tableName: "tblclientfilings", fields: ["ID"], where: ["ClientID = ?", "FormCode = ?"], whereValue: [clientid, code] });
    if (existing?.data?.length > 0) { skipped.push(code); continue; }
    const inserted = await insert({ tableName: "tblclientfilings", fieldValue: { ClientID: clientid, FormCode: code, IsFiled: 0, FiledDate: null, Remarks: null } });
    results.push(inserted);
  }

  res.status(200).json({ success: true, data: results, skipped });
};

// ── TOGGLE FILING STATUS ──────────────────────────────────────
// Body: { id, clientid, formcode, isfiled, fileddate?, remarks? }
module.exports.updatefilingtracker = async function (req, res) {
  const { id, clientid, formcode, isfiled, fileddate, remarks } = req.body;

  const data = await update({
    tableName: "tblclientfilings",
    fieldValue: {
      ID: id, ClientID: clientid, FormCode: formcode,
      IsFiled: isfiled ? 1 : 0,
      FiledDate: isfiled ? (fileddate || new Date().toISOString().slice(0, 10)) : null,
      Remarks: remarks || null,
    },
  });

  const allFilings = await select({ tableName: "tblclientfilings", fields: ["IsFiled"], where: ["ClientID = ?"], whereValue: [clientid] });
  const list = Array.isArray(allFilings?.data) ? allFilings.data : [];
  const total = list.length;
  const filed = list.filter((f) => f.IsFiled === 1).length;

  res.status(200).json({ success: true, data, progressPct: total > 0 ? Math.round((filed / total) * 100) : 0, filedCount: filed, totalFilings: total });
};

// ── REMOVE A FORM FROM A CLIENT ───────────────────────────────
module.exports.deletefilingtracker = async function (req, res) {
  const { id } = req.query;
  const existing = await select({ tableName: "tblclientfilings", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const record = existing?.data?.[0];

  const data = await remove({ tableName: "tblclientfilings", where: ["ID = ?"], whereValue: [id] });

  if (record) await logDeletion("ClientFiling", record.ID, `${record.FormCode} — Client #${record.ClientID}`, record, req.body?.deletedBy || req.user?.username || "system");

  res.status(200).json({ success: true, data });
};

// ── GET ALL BIR FORMS (for dropdowns) ────────────────────────
module.exports.selectbirforms = async function (req, res) {
  const result = await select({ tableName: "tblbirforms", fields: ["*"] });
  res.status(200).json({ success: true, data: Array.isArray(result?.data) ? result.data : [] });
};

// ── FILING TRACKER SUMMARY ────────────────────────────────────
module.exports.getfilingtrackersummary = async function (req, res) {
  const clients = Array.isArray((await select({ tableName: "tblclients", fields: ["*"] }))?.data) ? (await select({ tableName: "tblclients", fields: ["*"] })).data : [];
  const filings = Array.isArray((await select({ tableName: "tblclientfilings", fields: ["*"] }))?.data) ? (await select({ tableName: "tblclientfilings", fields: ["*"] })).data : [];

  const progressMap = {};
  filings.forEach((f) => {
    if (!progressMap[f.ClientID]) progressMap[f.ClientID] = { total: 0, filed: 0 };
    progressMap[f.ClientID].total += 1;
    if (f.IsFiled === 1) progressMap[f.ClientID].filed += 1;
  });

  let complete = 0, pending = 0, overdue = 0, upcoming = 0;
  clients.forEach((c) => {
    const p = progressMap[c.ID];
    if (!p || p.total === 0) { upcoming++; return; }
    if (p.filed === p.total)  complete++;
    else if (p.filed > 0)     pending++;
    else                      overdue++;
  });

  res.status(200).json({
    success: true,
    data: {
      totalClients: clients.length,
      active:   clients.filter((c) => c.Status === "Active").length,
      inactive: clients.filter((c) => c.Status === "Inactive").length,
      complete, pending, overdue, upcoming,
      soleProprietorship: clients.filter((c) => c.Type === "Sole Proprietorship").length,
      corporation:        clients.filter((c) => c.Type === "Corporation").length,
      coop:               clients.filter((c) => c.Type === "COOP").length,
    },
  });
};