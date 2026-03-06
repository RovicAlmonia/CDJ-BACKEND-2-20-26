const db = require("../../config/dbConnection");
const { insert, update } = require("../../models/mainModel");

const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// ── selectpaymentledger ───────────────────────────────────────────────────────
const selectpaymentledger = async (req, res) => {
  try {
    const { month, year } = req.query;
    let whereClause = "";
    const values = [];
    if (month && year) {
      whereClause = "WHERE MONTH(b.PaymentDate) = ? AND YEAR(b.PaymentDate) = ?";
      values.push(parseInt(month), parseInt(year));
    } else if (year) {
      whereClause = "WHERE YEAR(b.PaymentDate) = ?";
      values.push(parseInt(year));
    }
    const sql = `
      SELECT
        b.ID,
        b.TransactionHDRID,
        b.ClientID,
        COALESCE(c.TradeName, c.LNF, b.ClientID) AS ClientName,
        b.PaymentDate,
        b.Gross,
        b.Discount,
        b.Net,
        b.PaymentAmount,
        b.PaymentMethod,
        b.PaymentReference,
        b.PaymentStatus
      FROM tblbillinghdr b
      LEFT JOIN tblclients c ON b.ClientID = c.ClientID
      ${whereClause}
      ORDER BY b.PaymentDate DESC, b.ID DESC
    `;
    const result = await rawQuery(sql, values);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectpaymentledger error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment ledger." });
  }
};

// ── selectpaymentledgersummary ────────────────────────────────────────────────
const selectpaymentledgersummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    let whereClause = "";
    const values = [];
    if (month && year) {
      whereClause = "WHERE MONTH(PaymentDate) = ? AND YEAR(PaymentDate) = ?";
      values.push(parseInt(month), parseInt(year));
    } else if (year) {
      whereClause = "WHERE YEAR(PaymentDate) = ?";
      values.push(parseInt(year));
    }
    const sql = `
      SELECT
        COUNT(ID)          AS TotalRecords,
        SUM(Gross)         AS TotalGross,
        SUM(Discount)      AS TotalDiscount,
        SUM(Net)           AS TotalNet,
        SUM(PaymentAmount) AS TotalPaid,
        SUM(CASE WHEN PaymentStatus = 'Paid'   THEN 1 ELSE 0 END) AS CountPaid,
        SUM(CASE WHEN PaymentStatus = 'Active' THEN 1 ELSE 0 END) AS CountActive,
        SUM(CASE WHEN PaymentStatus = 'Posted' THEN 1 ELSE 0 END) AS CountPosted
      FROM tblbillinghdr
      ${whereClause}
    `;
    const result = await rawQuery(sql, values);
    res.status(200).json({ success: true, data: result[0] || {} });
  } catch (error) {
    console.error("selectpaymentledgersummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch summary." });
  }
};

// ── selectpaymentledgerbyclient ───────────────────────────────────────────────
const selectpaymentledgerbyclient = async (req, res) => {
  try {
    const { clientid } = req.query;
    if (!clientid || clientid === "__none__")
      return res.status(200).json({ success: true, data: [] });

    const sql = `
      SELECT
        b.ID,
        b.TransactionHDRID,
        b.ClientID,
        COALESCE(c.TradeName, c.LNF, b.ClientID) AS ClientName,
        b.PaymentDate  AS Date,
        b.Gross,
        b.Discount,
        b.Net,
        b.PaymentAmount    AS Amount,
        b.PaymentMethod,
        b.PaymentReference AS ReferenceNumber,
        b.BankName,
        b.PaymentStatus    AS Status
      FROM tblbillinghdr b
      LEFT JOIN tblclients c ON b.ClientID = c.ClientID
      WHERE b.ClientID = ?
        AND b.PaymentStatus IN ('Paid', 'Posted')
      ORDER BY b.PaymentDate DESC, b.ID DESC
    `;
    const result = await rawQuery(sql, [clientid]);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectpaymentledgerbyclient error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment ledger." });
  }
};

// ── postpayment ───────────────────────────────────────────────────────────────
const postpayment = async (req, res) => {
  try {
    const {
      billingid,       // This is actually TransactionHDRID
      paymentmethod,
      paymentstatus,
      referenceNumber,
      amount,
      date,
      checkDate,
      checkNumber,
      checkAmount,
      bankName,
      preparedBy,
    } = req.body;

    if (!billingid)
      return res.status(400).json({ success: false, message: "billingid is required." });

    const paymentDate   = date || checkDate || null;
    const paymentAmount = parseFloat(amount || checkAmount || 0);
    const paymentRef    = referenceNumber || checkNumber || null;
    const finalStatus   = paymentstatus === "Posted" ? "Posted" : "Paid";

    // Look up ClientID + amounts from the transaction header
    const hdr = await rawQuery(
      `SELECT ClientID, GrossTotal, Discount, NetTotal
       FROM tbltransactionHDR WHERE ID = ? LIMIT 1`,
      [billingid]
    );

    if (!hdr.length)
      return res.status(404).json({ success: false, message: "Transaction not found." });

    const { ClientID, GrossTotal, Discount, NetTotal } = hdr[0];

    await rawQuery(
      `INSERT INTO tblbillinghdr
         (TransactionHDRID, ClientID, Gross, Discount, Net,
          PaymentAmount, PaymentDate, PaymentMethod,
          PaymentReference, BankName, PaymentStatus,
          CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        billingid,
        ClientID,
        parseFloat(GrossTotal || 0),
        parseFloat(Discount   || 0),
        parseFloat(NetTotal   || 0),
        paymentAmount,
        paymentDate,
        paymentmethod || null,
        paymentRef,
        bankName || null,
        finalStatus,
      ]
    );

    res.status(200).json({ success: true, message: `Payment recorded as ${finalStatus}.` });
  } catch (error) {
    console.error("postpayment error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  selectpaymentledger,
  selectpaymentledgersummary,
  selectpaymentledgerbyclient,
  postpayment,
};