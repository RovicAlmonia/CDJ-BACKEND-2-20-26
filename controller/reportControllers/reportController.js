const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");
pdfMake.vfs = pdfFonts.vfs ?? pdfFonts?.pdfMake?.vfs ?? {};
console.log("vfs keys:", Object.keys(pdfMake.vfs).slice(0, 3));

const db = require("../../config/dbConnection");
const { buildSingleReceiptDoc, buildCombinedReceiptDoc } = require("../reports/receiptFormat");

// ── promisify db.query ────────────────────────────────────────
const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

// ── helper: fetch transaction header ─────────────────────────
const getHdr = async (hdrId) => {
  const rows = await query(`SELECT * FROM tbltransactionhdr WHERE ID = ?`, [hdrId]);
  return rows[0] || null;
};

// ── helper: fetch line items ──────────────────────────────────
const getDtls = async (hdrId) => {
  const rows = await query(
    `SELECT d.*, s.ServiceName
     FROM tbltransactiondtl d
     LEFT JOIN tblserviceslist s ON s.ServiceID = d.ServiceID
     WHERE d.TransactionHdrID = ?`,
    [hdrId]
  );
  return rows;
};

// ── helper: fetch client name ─────────────────────────────────
const getClientName = async (clientId) => {
  const rows = await query(
    `SELECT TradeName, LNF FROM tblclients WHERE ClientID = ?`,
    [clientId]
  );
  if (!rows[0]) return String(clientId);
  return rows[0].TradeName || rows[0].LNF || String(clientId);
};

// ── helper: fetch payments from tblbillinghdr ────────────────
// Exact columns from the real table schema:
// ID, TransactionHDRID, ClientID, Gross, Discount, Net,
// PaymentAmount, PaymentDate, PaymentMethod, PaymentReference,
// BankName, PaymentStatus, CreatedAt, UpdatedAt, ServiceFee
const getPayments = async (hdrId) => {
  try {
    const rows = await query(
      `SELECT
         ID,
         TransactionHDRID,
         ClientID,
         PaymentMethod,
         PaymentDate      AS Date,
         PaymentReference AS ReferenceNumber,
         BankName,
         Gross,
         Discount,
         ServiceFee,
         Net,
         PaymentAmount    AS Amount,
         PaymentStatus    AS Status,
         CreatedAt
       FROM tblbillinghdr
       WHERE TransactionHDRID = ?
       ORDER BY PaymentDate ASC, ID ASC`,
      [hdrId]
    );
    console.log(`getPayments for hdrId ${hdrId}: found ${rows.length} row(s)`);
    return rows;
  } catch (err) {
    console.warn("getPayments error:", err.message);
    return [];
  }
};

// ── helper: stream PDF response ───────────────────────────────
const streamPdf = (res, docDef) => {
  try {
    const pdfDoc = pdfMake.createPdf(docDef);
    pdfDoc.getBuffer((buffer) => {
      if (!buffer || buffer.length === 0) {
        console.error("PDF buffer is empty!");
        return res.status(500).json({ message: "PDF buffer was empty." });
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=receipt.pdf");
      res.setHeader("Content-Length", buffer.length);
      res.end(buffer);
    });
  } catch (err) {
    console.error("streamPdf error:", err);
    res.status(500).json({ message: "PDF generation failed.", error: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
// GET /api/reports/receipt/:hdrId   — single transaction receipt
// ════════════════════════════════════════════════════════════════
const getSingleReceipt = async (req, res) => {
  try {
    const { hdrId } = req.params;
    console.log("getSingleReceipt called, hdrId:", hdrId);

    const hdr = await getHdr(hdrId);
    if (!hdr) return res.status(404).json({ message: "Transaction not found." });

    const [dtls, payments, clientName] = await Promise.all([
      getDtls(hdrId),
      getPayments(hdrId),
      getClientName(hdr.ClientID),
    ]);

    console.log("payments found:", payments.length);

    const docDef = buildSingleReceiptDoc(hdr, dtls, clientName, payments);
    streamPdf(res, docDef);
  } catch (err) {
    console.error("getSingleReceipt error:", err);
    res.status(500).json({ message: "Failed to generate receipt.", error: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
// GET /api/reports/receipt/combined/:clientId  — combined receipt
// ════════════════════════════════════════════════════════════════
const getCombinedReceipt = async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log("getCombinedReceipt called, clientId:", clientId);

    const hdrs = await query(
      `SELECT * FROM tbltransactionhdr
       WHERE ClientID = ? AND Status != 'Paid'
       ORDER BY TransactionDate ASC`,
      [clientId]
    );

    if (!hdrs.length) {
      return res.status(404).json({ message: "No unpaid transactions found." });
    }

    const clientName = await getClientName(clientId);

    const groups = await Promise.all(
      hdrs.map(async (hdr) => ({
        hdr,
        dtls:     await getDtls(hdr.ID),
        payments: await getPayments(hdr.ID),
      }))
    );

    const totals = {
      combinedGross:      groups.reduce((s, g) => s + parseFloat(g.hdr.GrossTotal  || 0), 0),
      combinedDiscount:   groups.reduce((s, g) => s + parseFloat(g.hdr.Discount    || 0), 0),
      combinedServiceFee: groups.reduce((s, g) => s + parseFloat(g.hdr.ServiceFee  || 0), 0),
      combinedNet:        groups.reduce((s, g) => s + parseFloat(g.hdr.NetTotal    || 0), 0),
    };

    const docDef = buildCombinedReceiptDoc(groups, clientName, totals);
    streamPdf(res, docDef);
  } catch (err) {
    console.error("getCombinedReceipt error:", err);
    res.status(500).json({ message: "Failed to generate combined receipt.", error: err.message });
  }
};

module.exports = { getSingleReceipt, getCombinedReceipt };