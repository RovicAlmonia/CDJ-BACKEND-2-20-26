const { select, insert, update, remove } = require("../../models/mainModel");

module.exports.selectserviceslist = async function (req, res) {
  const result = await select({
    tableName: "tblserviceslist",
    fields: ["*"],
  });
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
  const { serviceid, servicename, servicerate } = req.body;
  const data = await insert({
    tableName: "tblserviceslist",
    fieldValue: {
      ServiceID: serviceid,
      ServiceName: servicename,
      ServiceRate: servicerate,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.updateserviceslist = async function (req, res) {
  const { id, serviceid, servicename, servicerate } = req.body;
  const data = await update({
    tableName: "tblserviceslist",
    fieldValue: {
      ID: id,
      ServiceID: serviceid,
      ServiceName: servicename,
      ServiceRate: servicerate,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.deleteserviceslist = async function (req, res) {
  const { id } = req.query;
  const data = await remove({
    tableName: "tblserviceslist",
    where: ["ID = ?"],
    whereValue: [id],
  });
  res.status(200).json({ success: true, data });
};