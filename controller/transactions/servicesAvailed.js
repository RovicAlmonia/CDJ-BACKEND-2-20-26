const mainModel = require("../../models/mainModel");
const db = require("../../config/dbConnection");

// helper: run raw SQL using the db connection directly
const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// GET all services availed — joins transactiondtl + transactionhdr + clientss
const selectservicesavailed = async (req, res) => {
  try {
    const sql = `
      SELECT 
        td.ID,
        td.TransactionHdrID,
        th.TransactionDate,
        th.Particulars,
        th.Status,
        c.ClientID,
        COALESCE(c.TradeName, c.LNF, c.ClientID) AS ClientName,
        td.ServiceID,
        td.ServiceName,
        td.Rate,
        td.QTY,
        td.Gross,
        td.Discount,
        td.Net,
        th.GrossTotal,
        th.NetTotal
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionhdr th ON td.TransactionHDRID = th.ID
      LEFT JOIN tblclients c ON th.ClientID = c.ClientID
      ORDER BY th.TransactionDate DESC, th.ID DESC, td.ID ASC
    `;
    const result = await rawQuery(sql);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectservicesavailed error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch services availed." });
  }
};

// GET services availed filtered by clientid
const selectservicesavailedbyclient = async (req, res) => {
  try {
    const { clientid } = req.query;
    if (!clientid) return res.status(400).json({ success: false, message: "clientid is required." });
    const sql = `
      SELECT 
        td.ID,
        td.TransactionHdrID,
        th.TransactionDate,
        th.Particulars,
        th.Status,
        c.ClientID,
        COALESCE(c.TradeName, c.LNF, c.ClientID) AS ClientName,
        td.ServiceID,
        td.ServiceName,
        td.Rate,
        td.QTY,
        td.Gross,
        td.Discount,
        td.Net
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionhdr th ON td.TransactionHDRID = th.ID
      LEFT JOIN tblclients c ON th.ClientID = c.ClientID
      WHERE th.ClientID = ?
      ORDER BY th.TransactionDate DESC, td.ID ASC
    `;
    const result = await rawQuery(sql, [clientid]);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectservicesavailedbyclient error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch." });
  }
};

// GET services availed grouped by service — summary
const selectservicesavailedsummary = async (req, res) => {
  try {
    const sql = `
      SELECT 
        td.ServiceID,
        td.ServiceName,
        COUNT(DISTINCT th.ClientID) AS UniqueClients,
        COUNT(td.ID)                AS TimesAvailed,
        SUM(td.QTY)                 AS TotalQty,
        SUM(td.Gross)               AS TotalGross,
        SUM(td.Discount)            AS TotalDiscount,
        SUM(td.Net)                 AS TotalNet
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionhdr th ON td.TransactionHDRID = th.ID
      GROUP BY td.ServiceID, td.ServiceName
      ORDER BY TimesAvailed DESC
    `;
    const result = await rawQuery(sql);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectservicesavailedsummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch summary." });
  }
};

module.exports = {
  selectservicesavailed,
  selectservicesavailedbyclient,
  selectservicesavailedsummary,
};