// ============================================================
// transactionhdr.js — with deletion logging + status update
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const db = require("../../config/dbConnection");
const { logDeletion } = require("../deletedlog/deletedlog");

// ── helper: insert a notification row ────────────────────────
const pushNotification = (id_number, first_name, last_name, type_of_notification) => {
  const sql = `INSERT INTO tbl_notifications (id_number, first_name, last_name, type_of_notification, notif_status) VALUES (?, ?, ?, ?, 0)`;
  db.query(sql, [id_number, first_name, last_name, type_of_notification], (err) => {
    if (err) console.error("pushNotification error:", err);
  });
};

// ── helper: get client name ───────────────────────────────────
const getClientName = (clientid, callback) => {
  const sql = `SELECT TradeName, LNF FROM tblclients WHERE ClientID = ? LIMIT 1`;
  db.query(sql, [clientid], (err, rows) => {
    if (err || !rows || rows.length === 0) return callback("", "");
    const row = rows[0];
    const name = row.TradeName || row.LNF || "";
    const parts = name.split(" ");
    callback(parts[0] || name, parts.slice(1).join(" ") || "");
  });
};

module.exports.selecttransactionhdr = async function (req, res) {
  const result = await select({ tableName: "tbltransactionhdr", fields: ["*"] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selecttransactionhdrbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({ tableName: "tbltransactionhdr", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

// ── Services Availed: one row per transaction, all payments summed ─
module.exports.selectclientservices = async function (req, res) {
  try {
    const { clientid } = req.query;
    if (!clientid) {
      return res.status(400).json({ success: false, message: "clientid is required." });
    }

    const sql = `
      SELECT
        t.ID              AS BillingID,
        t.TransactionDate,
        t.Particulars,
        t.GrossTotal,
        t.Discount,
        t.ServiceFee,
        t.NetTotal,
        t.Status,
        t.PreparedBy,
        t.CreatedAt,
        COALESCE(SUM(b.PaymentAmount), 0)                AS TotalPaid,
        (t.NetTotal - COALESCE(SUM(b.PaymentAmount), 0)) AS Balance
      FROM tbltransactionhdr t
      LEFT JOIN tblbillinghdr b
             ON b.TransactionHDRID = t.ID
      WHERE t.ClientID = ?
      GROUP BY
        t.ID, t.TransactionDate, t.Particulars,
        t.GrossTotal, t.Discount, t.ServiceFee, t.NetTotal,
        t.Status, t.PreparedBy, t.CreatedAt
      ORDER BY t.ID DESC
    `;

    db.query(sql, [clientid], (err, rows) => {
      if (err) {
        console.error("selectclientservices error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch client services." });
      }
      res.status(200).json({ success: true, data: rows || [] });
    });
  } catch (error) {
    console.error("selectclientservices error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── Transaction Ledger: full history for a client ─────────────
module.exports.selecttransactionledger = async function (req, res) {
  try {
    const { clientid } = req.query;
    if (!clientid) {
      return res.status(400).json({ success: false, message: "clientid is required." });
    }

    const sql = `
      SELECT
        t.ID              AS BillingID,
        t.TransactionDate AS Date,
        t.ClientID,
        t.Particulars,
        t.GrossTotal,
        t.Discount,
        t.ServiceFee,
        t.NetTotal,
        t.Status,
        t.PreparedBy,
        t.CreatedAt
      FROM tbltransactionhdr t
      WHERE t.ClientID = ?
      ORDER BY t.ID DESC
    `;

    db.query(sql, [clientid], (err, rows) => {
      if (err) {
        console.error("selecttransactionledger error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch transaction ledger." });
      }
      res.status(200).json({ success: true, data: rows || [] });
    });
  } catch (error) {
    console.error("selecttransactionledger error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── Payment Ledger: all payment rows for a client, with transaction details ─
module.exports.selectpaymentledgerbyclient = async function (req, res) {
  console.log("HIT: transactionhdr");
  try {
    const { clientid } = req.query;
    if (!clientid) {
      return res.status(400).json({ success: false, message: "clientid is required." });
    }

    const sql = `
      SELECT
        b.ID                                          AS PaymentID,
        b.TransactionHDRID                            AS BillingID,
        b.ClientID,
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
        )                                             AS PaymentMethod,
        b.PaymentDate                                 AS Date,
        b.PaymentReference                            AS ReferenceNumber,
        b.BankName,
        b.PaymentAmount                               AS Amount,
        b.PaymentStatus                               AS Status,
        t.GrossTotal                                  AS Gross,
        t.Discount,
        t.ServiceFee,
        t.NetTotal                                    AS Net,
        t.Particulars
      FROM tblbillinghdr b
      LEFT JOIN tbltransactionhdr t
             ON t.ID = b.TransactionHDRID
      WHERE b.ClientID = ?
      ORDER BY b.ID DESC
    `;

    db.query(sql, [clientid], (err, rows) => {
      if (err) {
        console.error("selectpaymentledgerbyclient error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch payment ledger." });
      }
      res.status(200).json({ success: true, data: rows || [] });
    });
  } catch (error) {
    console.error("selectpaymentledgerbyclient error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports.posttransactionhdr = async function (req, res) {
  const {
    transactiondate, clientid, particulars,
    grosstotal, discount, servicefee, nettotal,
    status, preparedby,
  } = req.body;
  try {
    const data = await insert({
      tableName: "tbltransactionhdr",
      fieldValue: {
        TransactionDate: transactiondate,
        ClientID:        clientid,
        Particulars:     particulars,
        GrossTotal:      grosstotal,
        Discount:        discount,
        ServiceFee:      parseFloat(servicefee) || 0,
        NetTotal:        nettotal,
        Status:          status || "Active",
        PreparedBy:      preparedby || null,
      },
    });
    getClientName(clientid, (first, last) => {
      pushNotification(
        clientid, first, last,
        `New Transaction — ${particulars || "No particulars"} (₱${parseFloat(nettotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })})`
      );
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("posttransactionhdr error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports.updatetransactionhdr = async function (req, res) {
  const {
    id, transactiondate, clientid, particulars,
    grosstotal, discount, servicefee, nettotal,
    status, preparedby,
  } = req.body;
  const data = await update({
    tableName: "tbltransactionhdr",
    fieldValue: {
      ID:              id,
      TransactionDate: transactiondate,
      ClientID:        clientid,
      Particulars:     particulars,
      GrossTotal:      grosstotal,
      Discount:        discount,
      ServiceFee:      parseFloat(servicefee) || 0,
      NetTotal:        nettotal,
      Status:          status,
      PreparedBy:      preparedby || null,
    },
  });
  res.status(200).json({ success: true, data });
};

// ── update only the Status field (called after payment) ──────
module.exports.updatetransactionstatus = async function (req, res) {
  try {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ success: false, message: "id and status are required." });
    }
    const data = await update({
      tableName: "tbltransactionhdr",
      fieldValue: { ID: id, Status: status },
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("updatetransactionstatus error:", error);
    res.status(500).json({ success: false, message: "Failed to update transaction status." });
  }
};

module.exports.deletetransactionhdr = async function (req, res) {
  const { id } = req.query;

  const existing = await select({ tableName: "tbltransactionhdr", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const record = existing?.data?.[0];

  const data = await remove({ tableName: "tbltransactionhdr", where: ["ID = ?"], whereValue: [id] });

  if (record) {
    const deletedBy = req.body?.deletedBy || req.user?.username || "system";
    const label = `Transaction #${record.ID} — ${record.Particulars || "No particulars"} · ₱${parseFloat(record.NetTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    await logDeletion("Transaction", record.ID, label, record, deletedBy);
  }

  res.status(200).json({ success: true, data });
};