const db = require("../../config/dbConnection");

const rawQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// ── GET all deleted records (non-restored, within 60 days) ────
const selectDeletedLog = async (req, res) => {
  try {
    const { module, search } = req.query;

    let sql = `
      SELECT 
        ID,
        Module,
        RecordID,
        RecordLabel,
        DeletedData,
        DeletedBy,
        DeletedAt,
        ExpiresAt,
        IsRestored,
        RestoredBy,
        RestoredAt,
        DATEDIFF(ExpiresAt, NOW()) AS DaysUntilExpiry
      FROM tbldeleted_log
      WHERE IsRestored = 0
        AND ExpiresAt > NOW()
    `;
    const params = [];

    if (module && module !== "All") {
      sql += ` AND Module = ?`;
      params.push(module);
    }

    if (search) {
      sql += ` AND (RecordLabel LIKE ? OR DeletedBy LIKE ? OR Module LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += ` ORDER BY DeletedAt DESC`;

    const result = await rawQuery(sql, params);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectDeletedLog error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch deleted records." });
  }
};

// ── POST a new deletion log entry ─────────────────────────────
// Called internally from other delete controllers
// Body: { module, recordId, recordLabel, deletedData (object), deletedBy }
const postDeletedLog = async (req, res) => {
  try {
    const { module, recordId, recordLabel, deletedData, deletedBy } = req.body;

    if (!module || !recordId || !recordLabel || !deletedData || !deletedBy) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const sql = `
      INSERT INTO tbldeleted_log (Module, RecordID, RecordLabel, DeletedData, DeletedBy, DeletedAt, ExpiresAt)
      VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY))
    `;
    await rawQuery(sql, [
      module,
      String(recordId),
      recordLabel,
      JSON.stringify(deletedData),
      deletedBy,
    ]);

    res.status(200).json({ success: true, message: "Deletion logged successfully." });
  } catch (error) {
    console.error("postDeletedLog error:", error);
    res.status(500).json({ success: false, message: "Failed to log deletion." });
  }
};

// ── PUT restore a deleted record ──────────────────────────────
// Body: { id, restoredBy }
// NOTE: Actual re-insertion into original table must be handled per-module
//       in the frontend or via a separate restore endpoint per module.
const restoreDeletedLog = async (req, res) => {
  try {
    const { id, restoredBy } = req.body;

    if (!id || !restoredBy) {
      return res.status(400).json({ success: false, message: "id and restoredBy are required." });
    }

    // Fetch the record first so we can return the data for re-insertion
    const [record] = await rawQuery(
      `SELECT * FROM tbldeleted_log WHERE ID = ? AND IsRestored = 0`,
      [id]
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found or already restored." });
    }

    // Mark as restored
    await rawQuery(
      `UPDATE tbldeleted_log SET IsRestored = 1, RestoredBy = ?, RestoredAt = NOW() WHERE ID = ?`,
      [restoredBy, id]
    );

    res.status(200).json({
      success: true,
      message: "Record marked as restored.",
      data: {
        module: record.Module,
        recordId: record.RecordID,
        deletedData: typeof record.DeletedData === "string"
          ? JSON.parse(record.DeletedData)
          : record.DeletedData,
      },
    });
  } catch (error) {
    console.error("restoreDeletedLog error:", error);
    res.status(500).json({ success: false, message: "Failed to restore record." });
  }
};

// ── DELETE permanently remove a single log entry ──────────────
const permanentDeleteLog = async (req, res) => {
  try {
    const { id } = req.query;
    await rawQuery(`DELETE FROM tbldeleted_log WHERE ID = ?`, [id]);
    res.status(200).json({ success: true, message: "Record permanently deleted." });
  } catch (error) {
    console.error("permanentDeleteLog error:", error);
    res.status(500).json({ success: false, message: "Failed to permanently delete record." });
  }
};

// ── GET summary counts per module ─────────────────────────────
const selectDeletedLogSummary = async (req, res) => {
  try {
    const sql = `
      SELECT 
        Module,
        COUNT(*) AS Count
      FROM tbldeleted_log
      WHERE IsRestored = 0 AND ExpiresAt > NOW()
      GROUP BY Module
      ORDER BY Count DESC
    `;
    const result = await rawQuery(sql);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("selectDeletedLogSummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch summary." });
  }
};

module.exports = {
  selectDeletedLog,
  postDeletedLog,
  restoreDeletedLog,
  permanentDeleteLog,
  selectDeletedLogSummary,
};