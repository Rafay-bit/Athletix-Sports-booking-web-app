const express = require('express');
const app = express();
app.use(express.json());

const sql = require('mssql/msnodesqlv8');

const config = {
    server: 'DESKTOP-A4D8U2L\\SQLEXPRESS',
    database: 'sports_facility_db',
    driver: 'ODBC Driver 18 for SQL Server',
    options: {
        trustedConnection: true
    }
};

// ── Global safety nets ───────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled async error:', reason);
    // Do NOT exit — keep the server alive
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = 3000;
const server = app.listen(PORT, () => {
    console.log(`Server Running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌  Port ${PORT} is already in use.`);
        console.error(`   Run this to free it:  Stop-Process -Name node -Force\n`);
    } else {
        console.error('Server error:', err.message);
    }
    process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
//  USERS — CRUD
// ═══════════════════════════════════════════════════════════════

// GET /users — list all users
app.get('/users', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT userid, username, email, role, fullname, phonenumber, membershipid, createdat, lastlogin
            FROM users
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /users/:id — single user
app.get('/users/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.id)
            .query(`
                SELECT userid, username, email, role, fullname, phonenumber, membershipid, createdat, lastlogin
                FROM users WHERE userid = @userid
            `);
        if (!result.recordset.length) return res.status(404).json({ error: 'User not found' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /users — create user
// Body: { username, passwordhash, email, role, fullname, phonenumber, membershipid }
app.post('/users', async (req, res) => {
    const { username, passwordhash, email, role, fullname, phonenumber, membershipid } = req.body;
    if (!username || !passwordhash || !email || !role)
        return res.status(400).json({ error: 'username, passwordhash, email, role are required' });
    try {
        const pool = await sql.connect(config);
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
        res.status(201).json({ userid: result.recordset[0].userid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /users/:id — update user
// Body (any of): { email, fullname, phonenumber, membershipid, role }
app.put('/users/:id', async (req, res) => {
    const { email, fullname, phonenumber, membershipid, role } = req.body;
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.id)
            .input('email', sql.VarChar(100), email || null)
            .input('fullname', sql.VarChar(100), fullname || null)
            .input('phonenumber', sql.VarChar(20), phonenumber || null)
            .input('membershipid', sql.Int, membershipid || null)
            .input('role', sql.VarChar(20), role || null)
            .query(`
                UPDATE users SET
                    email        = COALESCE(@email,        email),
                    fullname     = COALESCE(@fullname,     fullname),
                    phonenumber  = COALESCE(@phonenumber,  phonenumber),
                    membershipid = COALESCE(@membershipid, membershipid),
                    role         = COALESCE(@role,         role)
                WHERE userid = @userid
            `);
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /users/:id — delete user
app.delete('/users/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.id)
            .query('DELETE FROM users WHERE userid = @userid');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  BOOKINGS — CRUD
// ═══════════════════════════════════════════════════════════════

// GET /bookings — list all bookings (with joined names)
app.get('/bookings', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT b.bookingid, u.username, f.name AS facility,
                   t.starttime, t.endtime, b.bookingdate,
                   b.finalprice, b.status, b.createdat
            FROM bookings b
            JOIN users      u ON b.userid     = u.userid
            JOIN facilities f ON b.facilityid = f.facilityid
            JOIN timeslots  t ON b.slotid     = t.slotid
            ORDER BY b.bookingdate DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /bookings/:id — single booking
app.get('/bookings/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
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
        if (!result.recordset.length) return res.status(404).json({ error: 'Booking not found' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /bookings — create booking
// Body: { userid, facilityid, slotid, bookingdate, finalprice, status }
app.post('/bookings', async (req, res) => {
    const { userid, facilityid, slotid, bookingdate, finalprice, status } = req.body;
    if (!userid || !facilityid || !slotid || !bookingdate)
        return res.status(400).json({ error: 'userid, facilityid, slotid, bookingdate are required' });
    try {
        const pool = await sql.connect(config);
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
        res.status(201).json({ bookingid: result.recordset[0].bookingid });
    } catch (err) {
        // Double-booking unique constraint
        if (err.number === 2627 || err.number === 2601)
            return res.status(409).json({ error: 'Slot already booked for that date' });
        res.status(500).json({ error: err.message });
    }
});

// PUT /bookings/:id — update status or price
// Body (any of): { finalprice, status }
app.put('/bookings/:id', async (req, res) => {
    const { finalprice, status } = req.body;
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.id)
            .input('finalprice', sql.Decimal(10, 2), finalprice || null)
            .input('status', sql.VarChar(20), status || null)
            .query(`
                UPDATE bookings SET
                    finalprice = COALESCE(@finalprice, finalprice),
                    status     = COALESCE(@status,     status)
                WHERE bookingid = @bookingid
            `);
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Booking not found' });
        res.json({ message: 'Booking updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /bookings/:id — delete booking
app.delete('/bookings/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.id)
            .query('DELETE FROM bookings WHERE bookingid = @bookingid');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Booking not found' });
        res.json({ message: 'Booking deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 1 — Advanced Booking & Automation Logic
// ═══════════════════════════════════════════════════════════════

// 1. GET /availability?date=YYYY-MM-DD  → sp_get_available_facilities
app.get('/availability', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('targetdate', sql.Date, date)
            .execute('sp_get_available_facilities');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. GET /next-available-slots  → view_next_available_slots
app.get('/next-available-slots', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_next_available_slots');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. GET /waitlist-priority  → view_waitlist_priority
app.get('/waitlist-priority', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_waitlist_priority');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. GET /booking-conflicts  → view_booking_conflicts
app.get('/booking-conflicts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_booking_conflicts');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 2 — Bidding Engine
// ═══════════════════════════════════════════════════════════════

// 5. GET /active-auctions  → view_active_auctions
app.get('/active-auctions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_active_auctions');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. GET /user-bids/:userid  → sp_get_user_bids
app.get('/user-bids/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .execute('sp_get_user_bids');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. GET /auction-winners  → view_auction_winners
app.get('/auction-winners', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_auction_winners');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 3 — Financials & Monetization
// ═══════════════════════════════════════════════════════════════

// 8. GET /monthly-revenue  → view_monthly_revenue
app.get('/monthly-revenue', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_monthly_revenue');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. GET /discounted-price?userid=1&baseprice=100  → sp_calculate_discounted_price
app.get('/discounted-price', async (req, res) => {
    const { userid, baseprice } = req.query;
    if (!userid || !baseprice) return res.status(400).json({ error: 'userid and baseprice are required' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, parseInt(userid))
            .input('baseprice', sql.Decimal(10, 2), parseFloat(baseprice))
            .execute('sp_calculate_discounted_price');
        res.json(result.recordset[0] || { message: 'User has no membership' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 10. GET /validate-coupon?code=SUMMER20  → sp_validate_coupon
app.get('/validate-coupon', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code query param required' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('code', sql.VarChar(20), code)
            .execute('sp_validate_coupon');
        if (!result.recordset.length) return res.status(404).json({ error: 'Invalid coupon code' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 11. GET /user-status/:userid  → sp_check_user_status
app.get('/user-status/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .execute('sp_check_user_status');
        const { active_penalties } = result.recordset[0];
        res.json({ userid: parseInt(req.params.userid), active_penalties, can_book: active_penalties === 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 4 — Inventory & Equipment
// ═══════════════════════════════════════════════════════════════

// 12. GET /equipment-availability  → view_equipment_availability
app.get('/equipment-availability', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_equipment_availability');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 13. GET /booking-rentals/:bookingid  → sp_get_booking_rentals
app.get('/booking-rentals/:bookingid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.bookingid)
            .execute('sp_get_booking_rentals');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 5 — Admin Analytics & Reports
// ═══════════════════════════════════════════════════════════════

// 14. GET /top-facilities  → view_top_facilities
app.get('/top-facilities', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_top_facilities');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 15. GET /peak-hours  → view_peak_hours
app.get('/peak-hours', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_peak_hours');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 16. GET /power-users  → view_power_users
app.get('/power-users', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_power_users');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 17. GET /facility-health  → view_facility_health
app.get('/facility-health', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_facility_health');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 18. GET /facility-ratings  → view_facility_ratings
app.get('/facility-ratings', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_facility_ratings');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
