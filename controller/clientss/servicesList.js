// ============================================================
// serviceslist.js — with deletion logging
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const { logDeletion } = require("../deletedlog/deletedlog");

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

  const existing = await select({
    tableName: "tblserviceslist",
    fields: ["*"],
    where: ["ID = ?"],
    whereValue: [id],
  });
  const record = existing?.data?.[0];

  const data = await remove({
    tableName: "tblserviceslist",
    where: ["ID = ?"],
    whereValue: [id],
  });

  if (record) {
    const deletedBy = req.body?.deletedBy || req.user?.username || "system";
    await logDeletion(
      "Service",
      record.ID,
      record.ServiceName || `Service #${record.ID}`,
      record,
      deletedBy
    );
  }

  res.status(200).json({ success: true, data });
};