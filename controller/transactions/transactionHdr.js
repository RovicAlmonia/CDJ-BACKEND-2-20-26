// ============================================================
// transactionhdr.js — with deletion logging
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const db = require("../../config/dbConnection");

const logDeletion = (module, recordId, recordLabel, deletedData, deletedBy) => {
  return new Promise((resolve) => {
    const sql = `
      INSERT INTO tbldeleted_log 
        (Module, RecordID, RecordLabel, DeletedData, DeletedBy, DeletedAt, ExpiresAt)
      VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY))
    `;
    db.query(sql, [module, String(recordId), recordLabel, JSON.stringify(deletedData), deletedBy || "system"], (err) => {
      if (err) console.error(`[deletedLog] Failed to log ${module} deletion:`, err);
      resolve();
    });
  });
};

// ── helper: insert a notification row ────────────────────────
const pushNotification = (id_number, first_name, last_name, type_of_notification) => {
  const sql = `INSERT INTO tbl_notifications (id_number, first_name, last_name, type_of_notification, notif_status) VALUES (?, ?, ?, ?, 0)`;
  db.query(sql, [id_number, first_name, last_name, type_of_notification], (err) => {
    if (err) console.error("pushNotification error:", err);
  });
};

// ── helper: get client name ───────────────────────────────────
const getClientName = (clientid, callback) => {
  const sql = `SELECT TradeName, LNF FROM tblclients WHERE ClientID = ? LIMIT 1`;
  db.query(sql, [clientid], (err, rows) => {
    if (err || !rows || rows.length === 0) return callback("", "");
    const row = rows[0];
    const name = row.TradeName || row.LNF || "";
    const parts = name.split(" ");
    callback(parts[0] || name, parts.slice(1).join(" ") || "");
  });
};

module.exports.selecttransactionhdr = async function (req, res) {
  const result = await select({ tableName: "tbltransactionhdr", fields: ["*"] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selecttransactionhdrbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({ tableName: "tbltransactionhdr", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.posttransactionhdr = async function (req, res) {
  const { transactiondate, clientid, particulars, grosstotal, discount, nettotal, status } = req.body;
  try {
    const data = await insert({
      tableName: "tbltransactionhdr",
      fieldValue: { TransactionDate: transactiondate, ClientID: clientid, Particulars: particulars, GrossTotal: grosstotal, Discount: discount, NetTotal: nettotal, Status: status || "Active" },
    });
    getClientName(clientid, (first, last) => {
      pushNotification(clientid, first, last, `New Transaction — ${particulars || "No particulars"} (₱${parseFloat(nettotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })})`);
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("posttransactionhdr error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports.updatetransactionhdr = async function (req, res) {
  const { id, transactiondate, clientid, particulars, grosstotal, discount, nettotal, status } = req.body;
  const data = await update({
    tableName: "tbltransactionhdr",
    fieldValue: { ID: id, TransactionDate: transactiondate, ClientID: clientid, Particulars: particulars, GrossTotal: grosstotal, Discount: discount, NetTotal: nettotal, Status: status },
  });
  res.status(200).json({ success: true, data });
};

module.exports.deletetransactionhdr = async function (req, res) {
  const { id } = req.query;

  const existing = await select({ tableName: "tbltransactionhdr", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const record = existing?.data?.[0];

  const data = await remove({ tableName: "tbltransactionhdr", where: ["ID = ?"], whereValue: [id] });

  if (record) {
    const deletedBy = req.body?.deletedBy || req.user?.username || "system";
    const label = `Transaction #${record.ID} — ${record.Particulars || "No particulars"} · ₱${parseFloat(record.NetTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    await logDeletion("Transaction", record.ID, label, record, deletedBy);
  }

  res.status(200).json({ success: true, data });
};