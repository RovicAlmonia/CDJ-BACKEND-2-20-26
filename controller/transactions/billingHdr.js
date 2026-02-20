const { select, insert, update, remove } = require("../../models/mainModel");

module.exports.selectbillinghdr = async function (req, res) {
  const result = await select({ tableName: "tblbillinghdr", fields: ["*"] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selectbillinghdrbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({
    tableName: "tblbillinghdr",
    fields: ["*"],
    where: ["ID = ?"],
    whereValue: [id],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selectbillinghdrbyclient = async function (req, res) {
  const { clientid } = req.query;
  const result = await select({
    tableName: "tblbillinghdr",
    fields: ["*"],
    where: ["ClientID = ?"],
    whereValue: [clientid],
  });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.postbillinghdr = async function (req, res) {
  const {
    clientid, gross, discount, net,
    paymentamount, paymentdate, paymentmethod, paymentreference, paymentstatus,
  } = req.body;

  const data = await insert({
    tableName: "tblbillinghdr",
    fieldValue: {
      ClientID:         clientid,
      Gross:            gross,
      Discount:         discount,
      Net:              net,
      PaymentAmount:    paymentamount,
      PaymentDate:      paymentdate   || null,
      PaymentMethod:    paymentmethod || null,
      PaymentReference: paymentreference || null,
      PaymentStatus:    paymentstatus || "Unpaid",
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.updatebillinghdr = async function (req, res) {
  const {
    id, clientid, gross, discount, net,
    paymentamount, paymentdate, paymentmethod, paymentreference, paymentstatus,
  } = req.body;

  const data = await update({
    tableName: "tblbillinghdr",
    fieldValue: {
      ClientID:         clientid,
      Gross:            gross,
      Discount:         discount,
      Net:              net,
      PaymentAmount:    paymentamount,
      PaymentDate:      paymentdate   || null,
      PaymentMethod:    paymentmethod || null,
      PaymentReference: paymentreference || null,
      PaymentStatus:    paymentstatus || "Unpaid",
    },
    where: ["ID = ?"],          // ← tells the model WHICH row to update
    whereValue: [id],
  });
  res.status(200).json({ success: true, data });
};

module.exports.deletebillinghdr = async function (req, res) {
  const { id } = req.query;
  const data = await remove({
    tableName: "tblbillinghdr",
    where: ["ID = ?"],
    whereValue: [id],
  });
  res.status(200).json({ success: true, data });
};