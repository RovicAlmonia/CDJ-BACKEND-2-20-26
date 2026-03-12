// ============================================================
// clientLedger.js — Services Availed + Payment Ledger by ClientID
// ============================================================
const db = require("../../config/dbConnection");
const { select, insert, update } = require("../../models/mainModel");

const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, values, (err, result) => (err ? reject(err) : resolve(result)))
  );

// ── GET: Services Availed — JOIN tblbillinghdr + tbltransactionhdr ───
// GET /selectclientservices?clientid=CDO-2019-003
module.exports.selectclientservices = async function (req, res) {
  const { clientid } = req.query;
  if (!clientid || clientid === "__none__")
    return res.status(200).json({ success: true, data: [] });

  try {
    const data = await rawQuery(
      `SELECT
         b.ID                AS BillingID,
         b.TransactionHDRID,
         b.ClientID,
         b.Gross             AS GrossTotal,
         b.Discount,
         b.Net               AS NetTotal,
         b.Net               AS Total,
         b.PaymentAmount     AS TotalPaid,
         b.PaymentDate,
         b.PaymentMethod,
         b.PaymentReference,
         b.PaymentStatus     AS Status,
         b.CreatedAt,
         b.UpdatedAt,
         t.TransactionDate,
         t.Particulars,
         t.PreparedBy
       FROM tblbillinghdr b
       LEFT JOIN tbltransactionhdr t ON b.TransactionHDRID = t.ID
       WHERE b.ClientID = ?
       ORDER BY t.TransactionDate DESC, b.ID DESC`,
      [clientid]
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("selectclientservices error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── GET: Transaction Ledger ───────────────────────────────────
// GET /selecttransactionledger?clientid=CDO-2019-003
module.exports.selecttransactionledger = async function (req, res) {
  const { clientid } = req.query;
  if (!clientid || clientid === "__none__")
    return res.status(200).json({ success: true, data: [] });

  try {
    const data = await rawQuery(
      `SELECT
         b.ID                AS BillingID,
         b.TransactionHDRID,
         b.ClientID,
         b.Gross             AS GrossTotal,
         b.Discount,
         b.Net               AS NetTotal,
         b.Net               AS Total,
         b.PaymentAmount,
         b.PaymentDate,
         b.PaymentMethod,
         b.PaymentReference,
         b.PaymentStatus     AS Status,
         t.TransactionDate   AS Date,
         t.Particulars,
         t.PreparedBy
       FROM tblbillinghdr b
       LEFT JOIN tbltransactionhdr t ON b.TransactionHDRID = t.ID
       WHERE b.ClientID = ?
       ORDER BY t.TransactionDate DESC, b.ID DESC`,
      [clientid]
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("selecttransactionledger error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── GET: Payment Ledger ───────────────────────────────────────
// GET /selectpaymentledger?clientid=CDO-2019-003
module.exports.selectpaymentledger = async function (req, res) {
  const { clientid } = req.query;
  if (!clientid || clientid === "__none__")
    return res.status(200).json({ success: true, data: [] });

  const result = await select({
    tableName: "tbltransactionhdr",
    fields: ["*"],
    where: ["ClientID = ?"],
    whereValue: [clientid],
  });

  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

// ── POST: Add Payment ─────────────────────────────────────────
// POST /postpayment
module.exports.postpayment = async function (req, res) {
  const {
    billingid,
    clientid,
    paymentmethod,
    referenceNumber,
    amount,
    date,
    checkDate,
    checkNumber,
    checkAmount,
    bank,
    preparedBy,
  } = req.body;

  const paymentDate   = date || checkDate || null;
  const paymentAmount = parseFloat(amount || checkAmount || 0);
  const paymentRef    = referenceNumber || checkNumber || null;
  const bankName      = bank || null;

  try {
    let gross = 0, discount = 0, net = 0, resolvedClientId = clientid;

    if (billingid) {
      const billing = await select({
        tableName: "tblbillinghdr",
        fields: ["*"],
        where: ["IDTransaction = ?"],
        whereValue: [billingid],
      });
      const record = billing?.data?.[0];
      if (record) {
        gross            = parseFloat(record.GrossTotal || 0);
        discount         = parseFloat(record.Discount   || 0);
        net              = parseFloat(record.NetTotal    || 0);
        resolvedClientId = record.ClientID || clientid;
      }
    }

    const data = await insert({
      tableName: "tbltransactionhdr",
      fieldValue: {
        ClientID:         resolvedClientId,
        Gross:            gross,
        Discount:         discount,
        Net:              net,
        PaymentAmount:    paymentAmount,
        PaymentDate:      paymentDate,
        PaymentMethod:    paymentmethod || null,
        PaymentReference: paymentRef,
        PaymentStatus:    "Paid",
        Bank:             bankName,
        PreparedBy:       preparedBy || "system",
      },
    });

    if (billingid) {
      await update({
        tableName: "tblbillinghdr",
        fieldValue: { Status: "Paid" },
        where: ["IDTransaction = ?"],
        whereValue: [billingid],
      });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("postpayment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};