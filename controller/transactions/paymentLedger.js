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
        b.TransactionHDRID AS BillingID,
        b.ClientID,
        COALESCE(c.TradeName, c.LNF, b.ClientID) AS ClientName,
        b.PaymentDate,
        b.Gross,
        b.Discount,
        COALESCE(b.ServiceFee, t.ServiceFee, 0) AS ServiceFee,
        b.Net,
        b.PaymentAmount,
        b.PaymentMethod,
        b.PaymentReference,
        b.PaymentStatus
      FROM tblbillinghdr b
      LEFT JOIN tblclients c ON b.ClientID = c.ClientID
      LEFT JOIN tbltransactionHDR t ON b.TransactionHDRID = t.ID
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
        SUM(ServiceFee)    AS TotalServiceFee,
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
  console.log("HIT: payment.js");
  try {
    const { clientid } = req.query;
    if (!clientid || clientid === "__none__")
      return res.status(200).json({ success: true, data: [] });

    const sql = `
      SELECT
        b.ID,
        b.TransactionHDRID,
        b.TransactionHDRID                        AS BillingID,
        b.ClientID,
        COALESCE(c.TradeName, c.LNF, b.ClientID) AS ClientName,
        b.PaymentDate                             AS Date,
        b.Gross,
        b.Discount,
        COALESCE(b.ServiceFee, t.ServiceFee, 0)  AS ServiceFee,
        b.Net,
        b.PaymentAmount                           AS Amount,
        COALESCE(
          NULLIF(b.PaymentMethod, ''),
          (
            SELECT NULLIF(b2.PaymentMethod, '')
            FROM tblbillinghdr b2
            WHERE b2.TransactionHDRID = b.TransactionHDRID
              AND b2.PaymentMethod IS NOT NULL
              AND b2.PaymentMethod != ''
            ORDER BY b2.ID DESC
            LIMIT 1
          )
        )                                         AS PaymentMethod,
        b.PaymentReference                        AS ReferenceNumber,
        b.BankName,
        b.PaymentStatus                           AS Status
      FROM tblbillinghdr b
      LEFT JOIN tblclients c        ON b.ClientID          = c.ClientID
      LEFT JOIN tbltransactionHDR t ON b.TransactionHDRID  = t.ID
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
      billingid,
      clientid,
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

    console.log("postpayment body:", JSON.stringify(req.body));
    console.log("paymentmethod value:", paymentmethod);


    if (!billingid)
      return res.status(400).json({ success: false, message: "billingid is required." });

    const paymentDate   = date || checkDate || null;
    const paymentAmount = parseFloat(amount || checkAmount || 0);
    const paymentRef    = referenceNumber || checkNumber || null;
    const finalStatus   = paymentstatus === "Posted" ? "Posted" : "Paid";

    // ✅ FIX: also fetch ServiceFee from the transaction header
    const hdr = await rawQuery(
      `SELECT ClientID, GrossTotal, Discount, ServiceFee, NetTotal
       FROM tbltransactionHDR WHERE ID = ? LIMIT 1`,
      [billingid]
    );

    if (!hdr.length)
      return res.status(404).json({ success: false, message: "Transaction not found." });

    const { ClientID, GrossTotal, Discount, ServiceFee, NetTotal } = hdr[0];

    // ✅ FIX: insert ServiceFee into tblbillinghdr so it's stored and retrievable later
    await rawQuery(
      `INSERT INTO tblbillinghdr
         (TransactionHDRID, ClientID, Gross, Discount, ServiceFee, Net,
          PaymentAmount, PaymentDate, PaymentMethod,
          PaymentReference, BankName, PaymentStatus,
          CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        billingid,
        ClientID || clientid,
        parseFloat(GrossTotal  || 0),
        parseFloat(Discount    || 0),
        parseFloat(ServiceFee  || 0),
        parseFloat(NetTotal    || 0),
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