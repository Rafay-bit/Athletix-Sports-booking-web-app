// routes/bookings.js — CRUD routes for the bookings table
const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// ── GET /api/bookings ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT b.bookingid, u.username, f.name AS facility,
             t.starttime, t.endtime, b.bookingdate,
             b.finalprice, b.status, b.createdat
      FROM bookings b
      JOIN users     u ON b.userid     = u.userid
      JOIN facilities f ON b.facilityid = f.facilityid
      JOIN timeslots  t ON b.slotid     = t.slotid
      ORDER BY b.bookingdate DESC
    `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/bookings/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.id)
            .query(`
        SELECT b.bookingid, u.username, f.name AS facility,
               t.starttime, t.endtime, b.bookingdate,
               b.finalprice, b.status, b.createdat
        FROM bookings b
        JOIN users      u ON b.userid     = u.userid
        JOIN facilities f ON b.facilityid = f.facilityid
        JOIN timeslots  t ON b.slotid     = t.slotid
        WHERE b.bookingid = @bookingid
      `);
        if (!result.recordset.length)
            return res.status(404).json({ success: false, error: 'Booking not found' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/bookings ─────────────────────────────────────────────────────────
// Body: { userid, facilityid, slotid, bookingdate, finalprice, status }
router.post('/', async (req, res) => {
    const { userid, facilityid, slotid, bookingdate, finalprice, status } = req.body;
    if (!userid || !facilityid || !slotid || !bookingdate)
        return res.status(400).json({
            success: false,
            error: 'userid, facilityid, slotid, and bookingdate are required',
        });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, userid)
            .input('facilityid', sql.Int, facilityid)
            .input('slotid', sql.Int, slotid)
            .input('bookingdate', sql.Date, bookingdate)
            .input('finalprice', sql.Decimal(10, 2), finalprice || 0.00)
            .input('status', sql.VarChar(20), status || 'pending')
            .query(`
        INSERT INTO bookings (userid, facilityid, slotid, bookingdate, finalprice, status)
        OUTPUT INSERTED.bookingid
        VALUES (@userid, @facilityid, @slotid, @bookingdate, @finalprice, @status)
      `);
        res.status(201).json({ success: true, data: { bookingid: result.recordset[0].bookingid } });
    } catch (err) {
        // Unique-constraint violation = double-booking attempt
        if (err.number === 2627 || err.number === 2601)
            return res.status(409).json({ success: false, error: 'This slot is already booked for the selected date.' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── PUT /api/bookings/:id ──────────────────────────────────────────────────────
// Body: any subset of { finalprice, status }
router.put('/:id', async (req, res) => {
    const { finalprice, status } = req.body;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.id)
            .input('finalprice', sql.Decimal(10, 2), finalprice || null)
            .input('status', sql.VarChar(20), status || null)
            .query(`
        UPDATE bookings
        SET
          finalprice = COALESCE(@finalprice, finalprice),
          status     = COALESCE(@status,     status)
        WHERE bookingid = @bookingid
      `);
        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ success: false, error: 'Booking not found' });
        res.json({ success: true, message: 'Booking updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── DELETE /api/bookings/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.id)
            .query('DELETE FROM bookings WHERE bookingid = @bookingid');
        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ success: false, error: 'Booking not found' });
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
