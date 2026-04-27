// routes/auth.js — Login endpoint with bcrypt password verification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../db');

// POST /api/auth/login
// Body: { username, password }   (password is plain-text from the login form)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, error: 'Username and password are required' });

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.VarChar(50), username)
            .query(`
                SELECT userid, username, passwordhash, email, role, fullname,
                       phonenumber, membershipid, createdat, lastlogin
                FROM users WHERE username = @username
            `);

        if (!result.recordset.length)
            return res.status(401).json({ success: false, error: 'Invalid username or password' });

        const user = result.recordset[0];

        // Compare plain-text password against the bcrypt hash stored in DB
        const match = await bcrypt.compare(password, user.passwordhash);
        if (!match)
            return res.status(401).json({ success: false, error: 'Invalid username or password' });

        // Update last login timestamp
        await pool.request()
            .input('userid', sql.Int, user.userid)
            .query('UPDATE users SET lastlogin = GETDATE() WHERE userid = @userid');

        // Return user data (exclude password hash)
        const { passwordhash, ...safeUser } = user;
        res.json({ success: true, data: safeUser });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
