const { select, insert, update, remove } = require("../../models/mainModel");

module.exports.selecttransactiondtl = async function (req, res) {
  const result = await select({
    tableName: "tbltransactiondtl",
    fields: ["*"],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selecttransactiondtlbyhdr = async function (req, res) {
  const { hdrid } = req.query;
  const result = await select({
    tableName: "tbltransactiondtl",
    fields: ["*"],
    where: ["TransactionHDRID = ?"],
    whereValue: [hdrid],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.posttransactiondtl = async function (req, res) {
  const {
    transactionhdrid,
    serviceid,
    servicename,
    rate,
    qty,
    gross,
    discount,
    net,
  } = req.body;

  const data = await insert({
    tableName: "tbltransactiondtl",
    fieldValue: {
      TransactionHDRID: transactionhdrid,
      ServiceID: serviceid,
      ServiceName: servicename,
      Rate: rate,
      QTY: qty,
      Gross: gross,
      Discount: discount,
      Net: net,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.updatetransactiondtl = async function (req, res) {
  const {
    id,
    transactionhdrid,
    serviceid,
    servicename,
    rate,
    qty,
    gross,
    discount,
    net,
  } = req.body;

  const data = await update({
    tableName: "tbltransactiondtl",
    fieldValue: {
      ID: id,
      TransactionHDRID: transactionhdrid,
      ServiceID: serviceid,
      ServiceName: servicename,
      Rate: rate,
      QTY: qty,
      Gross: gross,
      Discount: discount,
      Net: net,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.deletetransactiondtl = async function (req, res) {
  const { id } = req.query;
  const data = await remove({
    tableName: "tbltransactiondtl",
    where: ["ID = ?"],
    whereValue: [id],
  });
  res.status(200).json({ success: true, data });
};

// Delete all DTL rows for a given HDR (used when deleting HDR)
module.exports.deletetransactiondtlbyhdr = async function (req, res) {
  const { hdrid } = req.query;
  const data = await remove({
    tableName: "tbltransactiondtl",
    where: ["TransactionHDRID = ?"],
    whereValue: [hdrid],
  });
  res.status(200).json({ success: true, data });
};