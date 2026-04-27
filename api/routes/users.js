// routes/users.js — CRUD routes for the users table
const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// ── GET /api/users ─────────────────────────────────────────────────────────────
// Returns all users (password hash is excluded for safety)
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT userid, username, email, role, fullname, phonenumber,
             membershipid, createdat, lastlogin
      FROM users
    `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/users/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, req.params.id)
            .query(`
        SELECT userid, username, email, role, fullname, phonenumber,
               membershipid, createdat, lastlogin
        FROM users WHERE userid = @userid
      `);
        if (!result.recordset.length)
            return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/users ────────────────────────────────────────────────────────────
// Body: { username, passwordhash, email, role, fullname, phonenumber, membershipid }
router.post('/', async (req, res) => {
    const { username, passwordhash, email, role, fullname, phonenumber, membershipid } = req.body;
    if (!username || !passwordhash || !email || !role)
        return res.status(400).json({ success: false, error: 'username, passwordhash, email, and role are required' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.VarChar(50), username)
            .input('passwordhash', sql.VarChar(255), passwordhash)
            .input('email', sql.VarChar(100), email)
            .input('role', sql.VarChar(20), role)
            .input('fullname', sql.VarChar(100), fullname || null)
            .input('phonenumber', sql.VarChar(20), phonenumber || null)
            .input('membershipid', sql.Int, membershipid || null)
            .query(`
        INSERT INTO users (username, passwordhash, email, role, fullname, phonenumber, membershipid)
        OUTPUT INSERTED.userid
        VALUES (@username, @passwordhash, @email, @role, @fullname, @phonenumber, @membershipid)
      `);
        res.status(201).json({ success: true, data: { userid: result.recordset[0].userid } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── PUT /api/users/:id ─────────────────────────────────────────────────────────
// Body: any subset of { email, fullname, phonenumber, membershipid, role }
router.put('/:id', async (req, res) => {
    const { email, fullname, phonenumber, membershipid, role } = req.body;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, req.params.id)
            .input('email', sql.VarChar(100), email || null)
            .input('fullname', sql.VarChar(100), fullname || null)
            .input('phonenumber', sql.VarChar(20), phonenumber || null)
            .input('membershipid', sql.Int, membershipid || null)
            .input('role', sql.VarChar(20), role || null)
            .query(`
        UPDATE users
        SET
          email        = COALESCE(@email,        email),
          fullname     = COALESCE(@fullname,     fullname),
          phonenumber  = COALESCE(@phonenumber,  phonenumber),
          membershipid = COALESCE(@membershipid, membershipid),
          role         = COALESCE(@role,         role)
        WHERE userid = @userid
      `);
        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, req.params.id)
            .query('DELETE FROM users WHERE userid = @userid');
        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
