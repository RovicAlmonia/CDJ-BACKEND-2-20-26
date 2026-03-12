// ============================================================
// revenueReport.js — Revenue Report Controller
// ============================================================
const db = require("../../config/dbConnection");

const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// ── GET /revenue-summary
// Monthly revenue totals for a given year
module.exports.selectrevenuemonthly = async function (req, res) {
  try {
    const { year } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const sql = `
      SELECT
        MONTH(th.TransactionDate)           AS Month,
        MONTHNAME(th.TransactionDate)       AS MonthName,
        COUNT(DISTINCT th.ID)               AS TotalTransactions,
        COUNT(DISTINCT th.ClientID)         AS UniqueClients,
        COALESCE(SUM(th.GrossTotal), 0)     AS TotalGross,
        COALESCE(SUM(th.Discount), 0)       AS TotalDiscount,
        COALESCE(SUM(th.NetTotal), 0)       AS TotalNet,
        COALESCE(SUM(
          CASE WHEN b.PaymentStatus IN ('Paid','Posted')
          THEN b.PaymentAmount ELSE 0 END
        ), 0)                               AS TotalCollected,
        COALESCE(SUM(th.NetTotal), 0)
          - COALESCE(SUM(
              CASE WHEN b.PaymentStatus IN ('Paid','Posted')
              THEN b.PaymentAmount ELSE 0 END
            ), 0)                           AS TotalOutstanding
      FROM tbltransactionhdr th
      LEFT JOIN tblbillinghdr b ON b.TransactionHDRID = th.ID
      WHERE YEAR(th.TransactionDate) = ?
      GROUP BY MONTH(th.TransactionDate), MONTHNAME(th.TransactionDate)
      ORDER BY MONTH(th.TransactionDate) ASC
    `;

    const result = await rawQuery(sql, [targetYear]);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectrevenuemonthly error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch monthly revenue." });
  }
};

// ── GET /revenue-by-service
// Revenue breakdown per service for a given year (optional month)
module.exports.selectrevenuebyservice = async function (req, res) {
  try {
    const { year, month } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    let whereClause = "WHERE YEAR(th.TransactionDate) = ?";
    const params = [targetYear];

    if (month) {
      whereClause += " AND MONTH(th.TransactionDate) = ?";
      params.push(parseInt(month));
    }

    const sql = `
      SELECT
        td.ServiceName,
        td.ServiceID,
        COUNT(td.ID)              AS TimesAvailed,
        SUM(td.QTY)               AS TotalQty,
        COALESCE(SUM(td.Gross), 0)    AS TotalGross,
        COALESCE(SUM(td.Discount), 0) AS TotalDiscount,
        COALESCE(SUM(td.Net), 0)      AS TotalNet
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionhdr th ON td.TransactionHDRID = th.ID
      ${whereClause}
      GROUP BY td.ServiceName, td.ServiceID
      ORDER BY TotalNet DESC
    `;

    const result = await rawQuery(sql, params);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectrevenuebyservice error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch revenue by service." });
  }
};

// ── GET /revenue-by-client
// Top clients by revenue for a given year (optional month)
module.exports.selectrevenuebyclient = async function (req, res) {
  try {
    const { year, month, limit } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const rowLimit   = parseInt(limit) || 10;

    let whereClause = "WHERE YEAR(th.TransactionDate) = ?";
    const params = [targetYear];

    if (month) {
      whereClause += " AND MONTH(th.TransactionDate) = ?";
      params.push(parseInt(month));
    }

    const sql = `
      SELECT
        th.ClientID,
        COALESCE(c.TradeName, c.LNF, th.ClientID) AS ClientName,
        c.Type                                      AS ClientType,
        COUNT(DISTINCT th.ID)                       AS TotalTransactions,
        COALESCE(SUM(th.GrossTotal), 0)             AS TotalGross,
        COALESCE(SUM(th.Discount), 0)               AS TotalDiscount,
        COALESCE(SUM(th.NetTotal), 0)               AS TotalNet,
        COALESCE(SUM(
          CASE WHEN b.PaymentStatus IN ('Paid','Posted')
          THEN b.PaymentAmount ELSE 0 END
        ), 0)                                       AS TotalCollected
      FROM tbltransactionhdr th
      LEFT JOIN tblclients c ON th.ClientID = c.ClientID
      LEFT JOIN tblbillinghdr b ON b.TransactionHDRID = th.ID
      ${whereClause}
      GROUP BY th.ClientID, c.TradeName, c.LNF, c.Type
      ORDER BY TotalNet DESC
      LIMIT ?
    `;
    params.push(rowLimit);

    const result = await rawQuery(sql, params);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectrevenuebyclient error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch revenue by client." });
  }
};

// ── GET /revenue-summary-totals
// Single-row KPI totals for the selected year (+ optional month)
module.exports.selectrevenuesummary = async function (req, res) {
  try {
    const { year, month } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    let whereClause = "WHERE YEAR(th.TransactionDate) = ?";
    const params = [targetYear];

    if (month) {
      whereClause += " AND MONTH(th.TransactionDate) = ?";
      params.push(parseInt(month));
    }

    const sql = `
      SELECT
        COUNT(DISTINCT th.ID)               AS TotalTransactions,
        COUNT(DISTINCT th.ClientID)         AS UniqueClients,
        COALESCE(SUM(th.GrossTotal), 0)     AS TotalGross,
        COALESCE(SUM(th.Discount), 0)       AS TotalDiscount,
        COALESCE(SUM(th.NetTotal), 0)       AS TotalNet,
        COALESCE(SUM(
          CASE WHEN b.PaymentStatus IN ('Paid','Posted')
          THEN b.PaymentAmount ELSE 0 END
        ), 0)                               AS TotalCollected,
        COALESCE(SUM(th.NetTotal), 0)
          - COALESCE(SUM(
              CASE WHEN b.PaymentStatus IN ('Paid','Posted')
              THEN b.PaymentAmount ELSE 0 END
            ), 0)                           AS TotalOutstanding
      FROM tbltransactionhdr th
      LEFT JOIN tblbillinghdr b ON b.TransactionHDRID = th.ID
      ${whereClause}
    `;

    const result = await rawQuery(sql, params);
    res.status(200).json({ success: true, data: result[0] || {} });
  } catch (error) {
    console.error("selectrevenuesummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch revenue summary." });
  }
};

// ── GET /revenue-available-years
// Returns distinct years that have transaction data
module.exports.selectrevenueyears = async function (req, res) {
  try {
    const sql = `
      SELECT DISTINCT YEAR(TransactionDate) AS Year
      FROM tbltransactionhdr
      ORDER BY Year DESC
    `;
    const result = await rawQuery(sql);
    res.status(200).json({ success: true, data: result.map((r) => r.Year) });
  } catch (error) {
    console.error("selectrevenueyears error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch years." });
  }
};