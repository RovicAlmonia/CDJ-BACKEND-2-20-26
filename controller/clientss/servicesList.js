const { select, insert, update, remove } = require("../../models/mainModel");
const db = require("../../config/dbConnection");

// ── Direct DB helper to log any deletion into tbldeleted_log ──
// Called after a successful delete — never throws, never blocks the response
const logDeletion = (module, recordId, recordLabel, deletedData, deletedBy) => {
  return new Promise((resolve) => {
    const sql = `
      INSERT INTO tbldeleted_log 
        (Module, RecordID, RecordLabel, DeletedData, DeletedBy, DeletedAt, ExpiresAt)
      VALUES 
        (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY))
    `;
    db.query(
      sql,
      [
        module,
        String(recordId),
        recordLabel,
        JSON.stringify(deletedData),
        deletedBy || "system",
      ],
      (err) => {
        if (err) console.error(`[deletedLog] Failed to log ${module} deletion:`, err);
        resolve(); // always resolve — deletion log must never block the main response
      }
    );
  });
};

module.exports.selectserviceslist = async function (req, res) {
  const result = await select({ tableName: "tblserviceslist", fields: ["*"] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selectserviceslistbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({
    tableName: "tblserviceslist",
    fields: ["*"],
    where: ["ID = ?"],
    whereValue: [id],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.postserviceslist = async function (req, res) {
  const { serviceid, servicename, servicerate, servicerenewalmonths } = req.body;
  const data = await insert({
    tableName: "tblserviceslist",
    fieldValue: {
      ServiceID: serviceid,
      ServiceName: servicename,
      ServiceRate: servicerate,
      ServiceRenewalMonths: parseInt(servicerenewalmonths) || 12,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.updateserviceslist = async function (req, res) {
  const { id, serviceid, servicename, servicerate, servicerenewalmonths } = req.body;
  const data = await update({
    tableName: "tblserviceslist",
    fieldValue: {
      ID: id,
      ServiceID: serviceid,
      ServiceName: servicename,
      ServiceRate: servicerate,
      ServiceRenewalMonths: parseInt(servicerenewalmonths) || 12,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.deleteserviceslist = async function (req, res) {
  const { id } = req.query;

  // 1. Fetch the record BEFORE deleting so we have a full snapshot
  const existing = await select({
    tableName: "tblserviceslist",
    fields: ["*"],
    where: ["ID = ?"],
    whereValue: [id],
  });

  const record = existing?.data?.[0];

  // 2. Perform the actual hard delete from the original table
  const data = await remove({
    tableName: "tblserviceslist",
    where: ["ID = ?"],
    whereValue: [id],
  });

  // 3. Log deletion directly to tbldeleted_log via DB — no http/axios needed
  //    deletedBy comes from req.body (sent by frontend) or req.user (JWT middleware)
  if (record) {
    const deletedBy = req.body?.deletedBy || req.user?.username || "system";
    await logDeletion(
      "Service",                                      // Module
      record.ID,                                      // RecordID
      record.ServiceName || `Service #${record.ID}`,  // RecordLabel (human-readable)
      record,                                         // Full row snapshot as JSON
      deletedBy                                       // Who deleted it
    );
  }

  res.status(200).json({ success: true, data });
};