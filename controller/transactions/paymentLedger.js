const db = require("../../config/dbConnection");

const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// GET all payment ledger records joined with client name, filtered by month/year
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

// GET summary totals for the ledger (optionally filtered by month/year)
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
        COUNT(ID)             AS TotalRecords,
        SUM(Gross)            AS TotalGross,
        SUM(Discount)         AS TotalDiscount,
        SUM(Net)              AS TotalNet,
        SUM(PaymentAmount)    AS TotalPaid,
        SUM(CASE WHEN PaymentStatus = 'Paid'    THEN 1 ELSE 0 END) AS CountPaid,
        SUM(CASE WHEN PaymentStatus = 'Unpaid'  THEN 1 ELSE 0 END) AS CountUnpaid,
        SUM(CASE WHEN PaymentStatus = 'Partial' THEN 1 ELSE 0 END) AS CountPartial
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

module.exports = {
  selectpaymentledger,
  selectpaymentledgersummary,
};