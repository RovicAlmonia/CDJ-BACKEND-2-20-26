// ============================================================
// servicesavailed.js
// ============================================================
const mainModel = require("../../models/mainModel");
const db = require("../../config/dbConnection");

const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const selectservicesavailed = async (req, res) => {
  try {
    const sql = `
      SELECT 
        td.ID, td.TransactionHDRID, th.TransactionDate, th.Particulars, th.Status,
        c.ClientID, COALESCE(c.TradeName, c.LNF, c.ClientID) AS ClientName,
        c.RetentionType, td.ServiceID, td.ServiceName, td.Rate, td.QTY,
        td.Gross, td.Discount, td.Net, th.GrossTotal, th.NetTotal,
        sl.ServiceRenewalMonths
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionHDR th ON td.TransactionHDRID = th.ID
      LEFT JOIN tblclients c ON th.ClientID = c.ClientID
      LEFT JOIN tblserviceslist sl ON LOWER(TRIM(td.ServiceName)) = LOWER(TRIM(sl.ServiceName))
      ORDER BY th.TransactionDate DESC, th.ID DESC, td.ID ASC
    `;
    const result = await rawQuery(sql);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectservicesavailed error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch services availed." });
  }
};

const selectservicesavailedbyclient = async (req, res) => {
  try {
    const { clientid } = req.query;
    if (!clientid)
      return res.status(400).json({ success: false, message: "clientid is required." });
    const sql = `
      SELECT 
        td.ID, td.TransactionHDRID, th.TransactionDate, th.Particulars, th.Status,
        c.ClientID, COALESCE(c.TradeName, c.LNF, c.ClientID) AS ClientName,
        c.RetentionType, td.ServiceID, td.ServiceName, td.Rate, td.QTY,
        td.Gross, td.Discount, td.Net, sl.ServiceRenewalMonths
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionHDR th ON td.TransactionHDRID = th.ID
      LEFT JOIN tblclients c ON th.ClientID = c.ClientID
      LEFT JOIN tblserviceslist sl ON LOWER(TRIM(td.ServiceName)) = LOWER(TRIM(sl.ServiceName))
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

const selectservicesavailedsummary = async (req, res) => {
  try {
    const sql = `
      SELECT 
        td.ServiceID, td.ServiceName, sl.ServiceRenewalMonths,
        COUNT(DISTINCT th.ClientID) AS UniqueClients,
        COUNT(td.ID) AS TimesAvailed, SUM(td.QTY) AS TotalQty,
        SUM(td.Gross) AS TotalGross, SUM(td.Discount) AS TotalDiscount,
        SUM(td.Net) AS TotalNet
      FROM tbltransactiondtl td
      INNER JOIN tbltransactionHDR th ON td.TransactionHDRID = th.ID
      LEFT JOIN tblserviceslist sl ON LOWER(TRIM(td.ServiceName)) = LOWER(TRIM(sl.ServiceName))
      GROUP BY td.ServiceID, td.ServiceName, sl.ServiceRenewalMonths
      ORDER BY TimesAvailed DESC
    `;
    const result = await rawQuery(sql);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectservicesavailedsummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch summary." });
  }
};

// ── For ClientInt popup — Services Availed table ─────────────────────────────
// FIX: added TotalPaid subquery so frontend can show remaining balance on "Add More"
const selectclientservices = async (req, res) => {
  try {
    const { clientid } = req.query;
    if (!clientid || clientid === "__none__")
      return res.status(200).json({ success: true, data: [] });

    const hdrSql = `
      SELECT
        th.ID            AS TransactionHDRID,
        th.TransactionDate,
        YEAR(th.TransactionDate) AS Year,
        th.ClientID,
        th.Particulars,
        th.GrossTotal,
        th.Discount,
        th.NetTotal      AS Total,
        th.Status,
        th.PreparedBy,
        COALESCE(
          -- New rows: matched by TransactionHDRID (preferred)
          (SELECT SUM(b.PaymentAmount)
           FROM tblbillinghdr b
           WHERE b.TransactionHDRID = th.ID
             AND b.PaymentStatus IN ('Posted', 'Paid')
          ),
          -- Legacy rows: no TransactionHDRID stored yet — match by ClientID + Net amount
          (SELECT SUM(b.PaymentAmount)
           FROM tblbillinghdr b
           WHERE b.TransactionHDRID IS NULL
             AND b.ClientID = th.ClientID
             AND b.Net = th.NetTotal
             AND b.PaymentStatus IN ('Posted', 'Paid')
          ),
          0
        )                AS TotalPaid
      FROM tbltransactionHDR th
      WHERE th.ClientID = ?
      ORDER BY th.TransactionDate DESC, th.ID DESC
    `;
    const headers = await rawQuery(hdrSql, [clientid]);

    if (!headers.length)
      return res.status(200).json({ success: true, data: [] });

    const ids = headers.map((h) => h.TransactionHDRID);
    const dtlSql = `
      SELECT
        td.TransactionHDRID, td.ServiceID, td.ServiceName,
        td.Rate, td.QTY, td.Gross, td.Discount, td.Net AS Amount
      FROM tbltransactiondtl td
      WHERE td.TransactionHDRID IN (?)
      ORDER BY td.ID ASC
    `;
    const details = await rawQuery(dtlSql, [ids]);

    const detailMap = {};
    details.forEach((d) => {
      if (!detailMap[d.TransactionHDRID]) detailMap[d.TransactionHDRID] = [];
      detailMap[d.TransactionHDRID].push(d);
    });

    const data = headers.map((h) => ({
      ...h,
      BillingID: h.TransactionHDRID,
      details: detailMap[h.TransactionHDRID] || [],
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("selectclientservices error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch client services." });
  }
};

// ── For ClientInt popup — Transaction Ledger dialog ──────────────────────────
const selecttransactionledger = async (req, res) => {
  try {
    const { clientid } = req.query;
    if (!clientid || clientid === "__none__")
      return res.status(200).json({ success: true, data: [] });

    const sql = `
      SELECT
        th.ID            AS BillingID,
        th.TransactionDate AS Date,
        YEAR(th.TransactionDate) AS Year,
        th.ClientID,
        th.Particulars,
        th.GrossTotal,
        th.Discount,
        th.NetTotal      AS Total,
        th.Status
      FROM tbltransactionHDR th
      WHERE th.ClientID = ?
      ORDER BY th.TransactionDate DESC, th.ID DESC
    `;
    const result = await rawQuery(sql, [clientid]);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selecttransactionledger error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch transaction ledger." });
  }
};

module.exports = {
  selectservicesavailed,
  selectservicesavailedbyclient,
  selectservicesavailedsummary,
  selectclientservices,
  selecttransactionledger,
};