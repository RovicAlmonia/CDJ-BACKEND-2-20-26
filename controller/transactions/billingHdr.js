// ============================================================
// billinghdr.js — with deletion logging
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

module.exports.selectbillinghdr = async function (req, res) {
  const result = await select({ tableName: "tblbillinghdr", fields: ["*"] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selectbillinghdrbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({ tableName: "tblbillinghdr", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selectbillinghdrbyclient = async function (req, res) {
  const { clientid } = req.query;
  const result = await select({ tableName: "tblbillinghdr", fields: ["*"], where: ["ClientID = ?"], whereValue: [clientid] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

// ── Payment Ledger: all payments for a client, with ServiceFee ─
module.exports.selectpaymentledgerbyclient = async function (req, res) {
  console.log("HIT: billinghdr");
  try {
    const { clientid } = req.query;
    if (!clientid) {
      return res.status(400).json({ success: false, message: "clientid is required." });
    }

    const sql = `
      SELECT
        b.ID,
        b.ID                 AS BillingID,
        b.TransactionHDRID,
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
        )                    AS PaymentMethod,
        b.PaymentDate        AS Date,
        b.PaymentReference   AS ReferenceNumber,
        b.BankName,
        t.GrossTotal         AS Gross,
        t.Discount,
        t.ServiceFee,
        t.NetTotal           AS Net,
        b.PaymentAmount      AS Amount,
        b.PaymentStatus      AS Status,
        b.CreatedAt
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
  // 👇 ADD THIS TEMPORARILY
  console.log("First row PaymentMethod:", rows?.[0]?.PaymentMethod);
  console.log("First row raw:", JSON.stringify(rows?.[0]));
  res.status(200).json({ success: true, data: rows || [] });
});
    
  } catch (error) {
    console.error("selectpaymentledgerbyclient error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports.postbillinghdr = async function (req, res) {
  const {
    clientid, gross, discount, servicefee, net,
    paymentamount, paymentdate, paymentmethod,
    paymentreference, bankname, paymentstatus,
  } = req.body;
  try {
    const data = await insert({
      tableName: "tblbillinghdr",
      fieldValue: {
        ClientID:         clientid,
        Gross:            gross,
        Discount:         discount,
        ServiceFee:       parseFloat(servicefee) || 0,
        Net:              net,
        PaymentAmount:    paymentamount,
        PaymentDate:      paymentdate      || null,
        PaymentMethod:    paymentmethod    || null,
        PaymentReference: paymentreference || null,
        BankName:         bankname         || null,
        PaymentStatus:    paymentstatus    || "Unpaid",
      },
    });
    getClientName(clientid, (first, last) => {
      pushNotification(
        clientid, first, last,
        `New Billing — ${paymentstatus || "Unpaid"} · ₱${parseFloat(net || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })} · ${paymentmethod || "No method"}`
      );
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("postbillinghdr error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports.updatebillinghdr = async function (req, res) {
  const {
    id, clientid, gross, discount, servicefee, net,
    paymentamount, paymentdate, paymentmethod,
    paymentreference, bankname, paymentstatus,
  } = req.body;
  const data = await update({
    tableName: "tblbillinghdr",
    fieldValue: {
      ClientID:         clientid,
      Gross:            gross,
      Discount:         discount,
      ServiceFee:       parseFloat(servicefee) || 0,
      Net:              net,
      PaymentAmount:    paymentamount,
      PaymentDate:      paymentdate      || null,
      PaymentMethod:    paymentmethod    || null,
      PaymentReference: paymentreference || null,
      BankName:         bankname         || null,
      PaymentStatus:    paymentstatus    || "Unpaid",
    },
    where:      ["ID = ?"],
    whereValue: [id],
  });
  res.status(200).json({ success: true, data });
};

module.exports.deletebillinghdr = async function (req, res) {
  const { id } = req.query;

  const existing = await select({ tableName: "tblbillinghdr", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const record = existing?.data?.[0];

  const data = await remove({ tableName: "tblbillinghdr", where: ["ID = ?"], whereValue: [id] });

  if (record) {
    const deletedBy = req.body?.deletedBy || req.user?.username || "system";
    const label = `Billing #${record.ID} — ${record.ClientID} · ₱${parseFloat(record.Net || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })} · ${record.PaymentStatus || "Unpaid"}`;
    await logDeletion("Billing", record.ID, label, record, deletedBy);
  }

  res.status(200).json({ success: true, data });
};