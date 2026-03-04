const db = require("../../config/dbConnection");

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — called by other controllers when they delete a record
// ─────────────────────────────────────────────────────────────────────────────
const logDeletion = (module, recordId, recordLabel, deletedData, deletedBy) => {
  return new Promise((resolve) => {
    const sql = `
      INSERT INTO tbldeleted_log
        (Module, RecordID, RecordLabel, DeletedData, DeletedBy, DeletedAt)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    db.query(
      sql,
      [
        module,
        String(recordId),
        recordLabel,
        JSON.stringify(deletedData),
        deletedBy || "system",
      ],
      (err) => {
        if (err) console.error(`[deletedLog] Failed to log ${module} deletion:`, err);
        resolve(); // never blocks the delete response
      }
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET  /selectdeletedlog
// Query params: module (optional), search (optional)
// Returns all non-restored deleted records
// ─────────────────────────────────────────────────────────────────────────────
const selectDeletedLog = (req, res) => {
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
      IsRestored,
      RestoredBy,
      RestoredAt,
      Notes
    FROM tbldeleted_log
    WHERE IsRestored = 0
  `;

  const params = [];

  if (module && module !== "All") {
    sql += " AND Module = ?";
    params.push(module);
  }

  if (search && search.trim() !== "") {
    sql += " AND (RecordLabel LIKE ? OR DeletedBy LIKE ? OR Module LIKE ?)";
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  sql += " ORDER BY DeletedAt DESC";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("[selectDeletedLog] Error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch deleted log." });
    }
    return res.json({ success: true, data: results });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET  /selectdeletedlogsummary
// Returns count per module (non-restored only)
// ─────────────────────────────────────────────────────────────────────────────
const selectDeletedLogSummary = (req, res) => {
  const sql = `
    SELECT Module, COUNT(*) AS Count
    FROM tbldeleted_log
    WHERE IsRestored = 0
    GROUP BY Module
    ORDER BY Module
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("[selectDeletedLogSummary] Error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch summary." });
    }
    return res.json({ success: true, data: results });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /postdeletedlog
// Manually log a deletion (optional — most controllers use logDeletion helper)
// Body: { module, recordid, recordlabel, deleteddata, deletedby }
// ─────────────────────────────────────────────────────────────────────────────
const postDeletedLog = (req, res) => {
  const { module, recordid, recordlabel, deleteddata, deletedby } = req.body;

  if (!module || !recordid) {
    return res.status(400).json({ success: false, message: "Module and RecordID are required." });
  }

  const sql = `
    INSERT INTO tbldeleted_log
      (Module, RecordID, RecordLabel, DeletedData, DeletedBy, DeletedAt)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;

  db.query(
    sql,
    [
      module,
      String(recordid),
      recordlabel || null,
      deleteddata ? JSON.stringify(deleteddata) : null,
      deletedby || "system",
    ],
    (err, result) => {
      if (err) {
        console.error("[postDeletedLog] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to log deletion." });
      }
      return res.json({ success: true, data: { insertId: result.insertId } });
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /restoredeletedlog
// Marks a log entry as restored and returns the original data snapshot
// Body: { id, restoredby }
// ─────────────────────────────────────────────────────────────────────────────
const restoreDeletedLog = (req, res) => {
  const { id, restoredby } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "ID is required." });
  }

  const selectSql = `SELECT * FROM tbldeleted_log WHERE ID = ? AND IsRestored = 0`;

  db.query(selectSql, [id], (err, rows) => {
    if (err) {
      console.error("[restoreDeletedLog] Fetch error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch record." });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Record not found or already restored." });
    }

    const record = rows[0];

    const updateSql = `
      UPDATE tbldeleted_log
      SET IsRestored = 1, RestoredBy = ?, RestoredAt = NOW()
      WHERE ID = ?
    `;

    db.query(updateSql, [restoredby || "system", id], (updateErr) => {
      if (updateErr) {
        console.error("[restoreDeletedLog] Update error:", updateErr);
        return res.status(500).json({ success: false, message: "Failed to restore record." });
      }

      let deletedData = {};
      try {
        deletedData =
          typeof record.DeletedData === "string"
            ? JSON.parse(record.DeletedData)
            : record.DeletedData || {};
      } catch (parseErr) {
        console.warn("[restoreDeletedLog] Could not parse DeletedData:", parseErr);
      }

      return res.json({
        success: true,
        message: "Record restored successfully.",
        data: {
          module:      record.Module,
          recordId:    record.RecordID,
          recordLabel: record.RecordLabel,
          deletedData,
        },
      });
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /permanentdeletelog
// Permanently removes a log entry (cannot be undone)
// Query param: id
// ─────────────────────────────────────────────────────────────────────────────
const permanentDeleteLog = (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, message: "ID is required." });
  }

  const sql = `DELETE FROM tbldeleted_log WHERE ID = ?`;

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("[permanentDeleteLog] Error:", err);
      return res.status(500).json({ success: false, message: "Failed to permanently delete log entry." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Log entry not found." });
    }

    return res.json({ success: true, message: "Log entry permanently deleted." });
  });
};

module.exports = {
  logDeletion,
  selectDeletedLog,
  selectDeletedLogSummary,
  postDeletedLog,
  restoreDeletedLog,
  permanentDeleteLog,
};