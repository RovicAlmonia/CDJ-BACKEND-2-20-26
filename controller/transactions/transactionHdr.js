const { select, insert, update, remove } = require("../../models/mainModel");

module.exports.selecttransactionhdr = async function (req, res) {
  const result = await select({
    tableName: "tbltransactionhdr",
    fields: ["*"],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selecttransactionhdrbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({
    tableName: "tbltransactionhdr",
    fields: ["*"],
    where: ["ID = ?"],
    whereValue: [id],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.posttransactionhdr = async function (req, res) {
  const {
    transactiondate,
    clientid,
    particulars,
    grosstotal,
    discount,
    nettotal,
    status,
  } = req.body;

  const data = await insert({
    tableName: "tbltransactionhdr",
    fieldValue: {
      TransactionDate: transactiondate,
      ClientID: clientid,
      Particulars: particulars,
      GrossTotal: grosstotal,
      Discount: discount,
      NetTotal: nettotal,
      Status: status || "Active",
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.updatetransactionhdr = async function (req, res) {
  const {
    id,
    transactiondate,
    clientid,
    particulars,
    grosstotal,
    discount,
    nettotal,
    status,
  } = req.body;

  const data = await update({
    tableName: "tbltransactionhdr",
    fieldValue: {
      ID: id,
      TransactionDate: transactiondate,
      ClientID: clientid,
      Particulars: particulars,
      GrossTotal: grosstotal,
      Discount: discount,
      NetTotal: nettotal,
      Status: status,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.deletetransactionhdr = async function (req, res) {
  const { id } = req.query;
  const data = await remove({
    tableName: "tbltransactionhdr",
    where: ["ID = ?"],
    whereValue: [id],
  });
  res.status(200).json({ success: true, data });
};