// routes/register.js  (or add this to your existing routes file)
// npm install bcrypt  (if not already installed)

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db'); // your existing db connection

router.post('/register', async (req, res) => {
  const {
    FullName,
    Username,
    Password,
    designation,
    Position,
    Designation_Location,
    roles,
    UserLevel,
    mainSuperVisorID,
  } = req.body;

  // ── Validation ──
  if (!Username || !Password || !designation || !roles || !UserLevel || !mainSuperVisorID) {
    return res.status(400).json({ success: false, error: 'All required fields must be filled.' });
  }

  if (Username.length > 15) {
    return res.status(400).json({ success: false, error: 'Username must be 15 characters or less.' });
  }

  try {
    // ── Check if username already exists ──
    const [existing] = await db.promise().query(
      'SELECT LoginID FROM tbllogin WHERE Username = ?',
      [Username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Username already exists.' });
    }

    // ── Hash password with bcrypt (salt rounds: 10) ──
    const hashedPassword = await bcrypt.hash(Password, 10);

    // ── Generate placeholder tokens ──
    const personal_key = `PK-${Username.toUpperCase()}-${Date.now()}`;
    const access_token = `TKN-${Username.toUpperCase()}-${Date.now()}`;

    // ── Insert into tbllogin ──
    const insertQuery = `
      INSERT INTO tbllogin (
        Username,
        Password,
        Position,
        Designation_Location,
        roles,
        personal_key,
        UserLevel,
        FullName,
        access_token,
        failed_login_attempts,
        is_disable,
        notification_unread,
        filepath_profilepicture,
        filepath_esignature,
        designation,
        mainSuperVisorID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, '', '', ?, ?)
    `;

    const values = [
      Username,
      hashedPassword,
      Position || null,
      Designation_Location || null,
      roles,
      personal_key,
      UserLevel,
      FullName || null,
      access_token,
      designation,
      mainSuperVisorID,
    ];

    const [result] = await db.promise().query(insertQuery, values);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      LoginID: result.insertId,
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;