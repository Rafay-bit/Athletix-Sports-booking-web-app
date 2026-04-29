const express = require('express');
const app = express();
app.use(express.json());

const path = require('path');
const sql = require('mssql/msnodesqlv8');
const config = {
    server: 'DESKTOP-A4D8U2L\\SQLEXPRESS',
    database: 'sports_facility_db',
    driver: 'ODBC Driver 18 for SQL Server',
    options: {
        trustedConnection: true
    }
};

app.use(express.static(path.join(__dirname, 'public')));

// ── Swagger Documentation Setup ──
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Athletix Sports API',
            version: '1.0.0',
            description: 'API Documentation for Athletix Sports Booking & Auction System',
            contact: { name: 'Athletix Dev Team' },
            servers: [{ url: 'http://localhost:3000' }]
        },
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        }
    },
    apis: ['./server.js'] // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


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

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Array of user objects
 */
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

// GET /bookings — list all bookings (with joined names, including userid)
app.get('/bookings', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT b.bookingid, b.userid, u.username, f.name AS facility,
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

// GET /my-bookings/:userid — active bookings (pending, confirmed, open_bid) for a specific user
app.get('/my-bookings/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query(`
                SELECT b.bookingid, b.userid, u.username, f.name AS facility,
                       f.is_auctionable,
                       t.starttime, t.endtime, b.bookingdate,
                       b.finalprice, b.status, b.createdat,
                       COALESCE((SELECT MAX(bi.bidamount) FROM bids bi WHERE bi.bookingid = b.bookingid), 0) AS highest_bid
                FROM bookings b
                JOIN users      u ON b.userid     = u.userid
                JOIN facilities f ON b.facilityid = f.facilityid
                JOIN timeslots  t ON b.slotid     = t.slotid
                WHERE b.userid = @userid
                  AND LOWER(b.status) != 'cancelled'
                ORDER BY b.createdat DESC
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /auction-booking — create a booking for an auctionable facility (status=open_bid) + initial bid
app.post('/auction-booking', async (req, res) => {
    const { userid, facilityid, slotid, bookingdate, startingbid } = req.body;
    if (!userid || !facilityid || !slotid || !bookingdate || !startingbid)
        return res.status(400).json({ error: 'userid, facilityid, slotid, bookingdate, startingbid are required' });
    if (startingbid % 500 !== 0)
        return res.status(400).json({ error: 'Starting bid must be a multiple of 500' });
    try {
        const pool = await sql.connect(config);
        // Create booking with status 'open_bid'
        const bookingResult = await pool.request()
            .input('userid',      sql.Int,          userid)
            .input('facilityid',  sql.Int,          facilityid)
            .input('slotid',      sql.Int,          slotid)
            .input('bookingdate', sql.Date,         bookingdate)
            .input('finalprice',  sql.Decimal(10,2), startingbid)
            .query(`
                INSERT INTO bookings (userid, facilityid, slotid, bookingdate, finalprice, status)
                OUTPUT INSERTED.bookingid
                VALUES (@userid, @facilityid, @slotid, @bookingdate, @finalprice, 'open_bid')
            `);
        const bookingid = bookingResult.recordset[0].bookingid;
        // Insert the starting bid
        await pool.request()
            .input('bookingid',  sql.Int,          bookingid)
            .input('userid',     sql.Int,          userid)
            .input('bidamount',  sql.Decimal(10,2), startingbid)
            .query('INSERT INTO bids (bookingid, userid, bidamount) VALUES (@bookingid, @userid, @bidamount)');
        res.status(201).json({ bookingid, startingbid });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601)
            return res.status(409).json({ error: 'That slot is already booked for this date' });
        res.status(500).json({ error: err.message });
    }
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


/**
 * @swagger
 * /login:
 *   post:
 *     summary: Authenticate user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password !== '1234') return res.status(401).json({ error: 'Incorrect password' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .query(`
                SELECT u.userid, u.username, u.email, u.role, u.fullname, u.membershipid, 
                       m.tiername, m.discountpct
                FROM users u
                LEFT JOIN memberships m ON u.membershipid = m.membershipid
                WHERE u.email = @email
            `);
        if (!result.recordset.length) return res.status(401).json({ error: 'No account found with that email' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /bids:
 *   post:
 *     summary: Place a bid on an auction
 *     tags: [Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingid: { type: integer }
 *               userid: { type: integer }
 *               bidamount: { type: number }
 *     responses:
 *       200:
 *         description: Bid placed
 *       400:
 *         description: Invalid bid
 */
app.post('/bids', async (req, res) => {
    const { bookingid, userid, bidamount } = req.body;
    if (!bookingid || !userid || !bidamount) return res.status(400).json({ error: 'Missing parameters' });
    // Ensure numeric comparison works regardless of body type
    const bidAmt = Number(bidamount);
    if (!bidAmt || bidAmt <= 0) return res.status(400).json({ error: 'Invalid bid amount' });
    if (bidAmt % 500 !== 0) return res.status(400).json({ error: 'Bid must be a multiple of 500' });

    try {
        const pool = await sql.connect(config);
        const highestBidResult = await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .query('SELECT TOP 1 userid, bidamount FROM bids WHERE bookingid = @bookingid ORDER BY bidamount DESC');

        // Force Number() — mssql returns Decimal objects for DECIMAL columns
        const currentHighest = highestBidResult.recordset.length > 0
            ? Number(highestBidResult.recordset[0].bidamount)
            : 0;
        const prevUser = highestBidResult.recordset.length > 0
            ? highestBidResult.recordset[0].userid
            : null;

        if (bidAmt <= currentHighest) {
            return res.status(400).json({
                error: `Bid must be higher than current highest bid (Rs ${currentHighest.toLocaleString()})`
            });
        }

        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('userid',    sql.Int, userid)
            .input('bidamount', sql.Decimal(10, 2), bidAmt)
            .query('INSERT INTO bids (bookingid, userid, bidamount) VALUES (@bookingid, @userid, @bidamount)');

        // Notify previous highest bidder if it was a different user
        if (prevUser && Number(prevUser) !== Number(userid)) {
            await pool.request()
                .input('userid', sql.Int, prevUser)
                .input('msg', sql.VarChar(500),
                    `⚡ You've been outbid on booking #${bookingid}! New highest bid: Rs ${bidAmt.toLocaleString()}. Place a higher bid to win!`)
                .query('INSERT INTO notifications (userid, message) VALUES (@userid, @msg)');
        }

        // Return newHighestBid so the frontend can update the display immediately
        res.json({ success: true, newHighestBid: bidAmt });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /notifications/:userid
app.get('/notifications/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query('SELECT * FROM notifications WHERE userid = @userid ORDER BY createdat DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /auctions-extended:
 *   get:
 *     summary: List active auctions with top bidder and timing
 *     tags: [Auctions]
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/auctions-extended', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT
                a.bookingid,
                a.facility,
                a.bookingdate,
                a.current_highest_bid,
                t.starttime,
                t.endtime,
                b.createdat,
                b.userid AS owner_userid,
                top_bid.userid AS top_bidder_userid,
                top_u.username AS top_bidder_username
            FROM view_active_auctions a
            JOIN bookings b ON a.bookingid = b.bookingid
            JOIN timeslots t ON b.slotid = t.slotid
            OUTER APPLY (
                SELECT TOP 1 userid, bidamount
                FROM bids
                WHERE bookingid = a.bookingid
                ORDER BY bidamount DESC
            ) top_bid
            LEFT JOIN users top_u ON top_bid.userid = top_u.userid
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// ═══════════════════════════════════════════════════════════════
//  LOGIN & AUCTIONS/NOTIFICATIONS EXTENSION
// ═══════════════════════════════════════════════════════════════

// POST /login
app.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .query('SELECT userid, username, email, role FROM users WHERE email = @email');
        if (!result.recordset.length) return res.status(401).json({ error: 'Invalid email' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /bids
app.post('/bids', async (req, res) => {
    const { bookingid, userid, bidamount } = req.body;
    if (!bookingid || !userid || !bidamount) return res.status(400).json({ error: 'Missing parameters' });
    if (bidamount % 500 !== 0) return res.status(400).json({ error: 'Bid must be a multiple of 500' });
    
    try {
        const pool = await sql.connect(config);
        // Get current highest bid
        const highestBidResult = await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .query('SELECT TOP 1 userid, bidamount FROM bids WHERE bookingid = @bookingid ORDER BY bidamount DESC');
        
        const currentHighest = highestBidResult.recordset.length > 0 ? highestBidResult.recordset[0].bidamount : 0;
        const prevUser = highestBidResult.recordset.length > 0 ? highestBidResult.recordset[0].userid : null;

        if (bidamount <= currentHighest) {
            return res.status(400).json({ error: 'Bid must be higher than current highest bid' });
        }

        // Insert new bid
        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('userid', sql.Int, userid)
            .input('bidamount', sql.Decimal(10,2), bidamount)
            .query('INSERT INTO bids (bookingid, userid, bidamount) VALUES (@bookingid, @userid, @bidamount)');

        // Notify previous user if different
        if (prevUser && prevUser !== userid) {
            await pool.request()
                .input('userid', sql.Int, prevUser)
                .input('msg', sql.VarChar(255), `You have been outbid on booking #${bookingid}. New bid: Rs ${bidamount}`)
                .query('INSERT INTO notifications (userid, message) VALUES (@userid, @msg)');
        }

        res.json({ success: true, message: 'Bid placed successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /notifications/:userid
app.get('/notifications/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query('SELECT * FROM notifications WHERE userid = @userid ORDER BY createdat DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /auctions-extended
app.get('/auctions-extended', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT a.bookingid, a.facility, a.bookingdate, a.current_highest_bid, t.starttime, t.endtime
            FROM view_active_auctions a
            JOIN bookings b ON a.bookingid = b.bookingid
            JOIN timeslots t ON b.slotid = t.slotid
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /availability:
 *   get:
 *     summary: Check facility availability for a date
 *     tags: [Facilities]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *         required: true
 *         description: YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Success
 */
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

/**
 * @swagger
 * /active-auctions:
 *   get:
 *     summary: List simple active auctions
 *     tags: [Auctions]
 *     responses:
 *       200:
 *         description: Success
 */
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

// 13. GET /booking-rentals/:bookingid — equipment rented for a booking
app.get('/booking-rentals/:bookingid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.bookingid)
            .query(`
                SELECT er.rentalid, e.itemname AS equipment_name,
                       er.qty AS quantity, e.hourlyrate AS rate,
                       (er.qty * e.hourlyrate) AS subtotal
                FROM equipment_rentals er
                JOIN equipment e ON er.itemid = e.itemid
                WHERE er.bookingid = @bookingid
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /equipment-rentals:
 *   post:
 *     summary: Rent equipment for a booking
 *     tags: [Equipment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingid: { type: integer }
 *               itemid: { type: integer }
 *               qty: { type: integer }
 *     responses:
 *       201:
 *         description: Rented
 */
app.post('/equipment-rentals', async (req, res) => {
    const { bookingid, itemid, qty } = req.body;
    if (!bookingid || !itemid || !qty) return res.status(400).json({ error: 'bookingid, itemid, and qty are required' });
    try {
        const pool = await sql.connect(config);
        // Verify stock first
        const stockRes = await pool.request()
            .input('itemid', sql.Int, itemid)
            .query('SELECT itemname, totalstock - (SELECT ISNULL(SUM(qty),0) FROM equipment_rentals WHERE itemid = @itemid) as available FROM equipment WHERE itemid = @itemid');
        
        if (!stockRes.recordset.length) return res.status(404).json({ error: 'Equipment not found' });
        if (stockRes.recordset[0].available < qty) return res.status(400).json({ error: `Not enough stock. Only ${stockRes.recordset[0].available} left.` });

        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('itemid', sql.Int, itemid)
            .input('qty', sql.Int, qty)
            .query('INSERT INTO equipment_rentals (bookingid, itemid, qty) VALUES (@bookingid, @itemid, @qty)');
        
        res.status(201).json({ success: true, message: 'Equipment rented successfully' });
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

// ═══════════════════════════════════════════════════════════════
//  LOGIN — Email + Password
// ═══════════════════════════════════════════════════════════════
// POST /login  { email, password }
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    // Simple fixed-password check for this phase
    if (password !== '1234') return res.status(401).json({ error: 'Invalid password' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .query(`
                SELECT u.userid, u.username, u.email, u.role, u.fullname, u.membershipid, 
                       m.tiername, m.discountpct
                FROM users u
                LEFT JOIN memberships m ON u.membershipid = m.membershipid
                WHERE u.email = @email
            `);
        if (!result.recordset.length) return res.status(401).json({ error: 'No account found with that email' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  FACILITIES LIST (with is_auctionable flag)
// ═══════════════════════════════════════════════════════════════
app.get('/facilities', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT facilityid, name, description, capacity, is_auctionable, isactive, base_price
            FROM facilities WHERE isactive = 1
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  BIDS ENGINE
// ═══════════════════════════════════════════════════════════════
// POST /bids  { bookingid, userid, bidamount }
app.post('/bids', async (req, res) => {
    const { bookingid, userid, bidamount } = req.body;
    if (!bookingid || !userid || !bidamount) return res.status(400).json({ error: 'Missing parameters' });
    if (bidamount % 500 !== 0) return res.status(400).json({ error: 'Bid must be a multiple of 500' });
    try {
        const pool = await sql.connect(config);
        // Get current highest bid
        const highestBidResult = await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .query('SELECT TOP 1 userid, bidamount FROM bids WHERE bookingid = @bookingid ORDER BY bidamount DESC');
        const currentHighest = highestBidResult.recordset.length > 0 ? Number(highestBidResult.recordset[0].bidamount) : 0;
        const prevUser = highestBidResult.recordset.length > 0 ? highestBidResult.recordset[0].userid : null;
        if (bidamount <= currentHighest) {
            return res.status(400).json({ error: `Bid must be higher than current highest bid (Rs ${currentHighest})` });
        }
        // Insert bid
        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('userid', sql.Int, userid)
            .input('bidamount', sql.Decimal(10, 2), bidamount)
            .query('INSERT INTO bids (bookingid, userid, bidamount) VALUES (@bookingid, @userid, @bidamount)');
        // Notify previous highest bidder if different user
        if (prevUser && prevUser !== userid) {
            await pool.request()
                .input('userid', sql.Int, prevUser)
                .input('msg', sql.VarChar(500), `⚡ You've been outbid on Booking #${bookingid}! New highest bid: Rs ${bidamount.toLocaleString()}. Place a higher bid to win!`)
                .query('INSERT INTO notifications (userid, message) VALUES (@userid, @msg)');
        }
        res.json({ success: true, newHighestBid: bidamount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
// GET /notifications/:userid
app.get('/notifications/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query('SELECT * FROM notifications WHERE userid = @userid ORDER BY createdat DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /notifications/:userid/read — mark all as read
app.put('/notifications/:userid/read', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query('UPDATE notifications SET isread = 1 WHERE userid = @userid');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  AUCTIONS EXTENDED (with starttime + endtime for timer)
// ═══════════════════════════════════════════════════════════════
app.get('/auctions-extended', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                a.bookingid,
                a.facility,
                a.bookingdate,
                a.current_highest_bid,
                t.starttime,
                t.endtime,
                b.userid AS owner_userid
            FROM view_active_auctions a
            JOIN bookings b ON a.bookingid = b.bookingid
            JOIN timeslots t ON b.slotid = t.slotid
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 1 — Advanced Booking & Automation Logic
// ═══════════════════════════════════════════════════════════════

// 1. GET /availability?date=YYYY-MM-DD  -> sp_get_available_facilities
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

// 2. GET /next-available-slots
app.get('/next-available-slots', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_next_available_slots');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. GET /waitlist-priority
app.get('/waitlist-priority', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_waitlist_priority');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. GET /booking-conflicts
app.get('/booking-conflicts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_booking_conflicts');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. GET /active-auctions
app.get('/active-auctions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_active_auctions');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. GET /user-bids/:userid
app.get('/user-bids/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .execute('sp_get_user_bids');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. GET /auction-winners
app.get('/auction-winners', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_auction_winners');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. GET /monthly-revenue
app.get('/monthly-revenue', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_monthly_revenue');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. GET /discounted-price
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

// 10. GET /validate-coupon
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

// 11. GET /user-status/:userid
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

// 12. GET /equipment-availability
app.get('/equipment-availability', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_equipment_availability');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 13. GET /booking-rentals/:bookingid
app.get('/booking-rentals/:bookingid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.bookingid)
            .execute('sp_get_booking_rentals');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 14. GET /top-facilities
app.get('/top-facilities', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_top_facilities');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 15. GET /peak-hours
app.get('/peak-hours', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_peak_hours');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 16. GET /power-users
app.get('/power-users', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_power_users');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 17. GET /facility-health
app.get('/facility-health', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_facility_health');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 18. GET /facility-ratings
app.get('/facility-ratings', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_facility_ratings');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════

// POST /login — email + fixed password "1234"
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password !== '1234') return res.status(401).json({ error: 'Incorrect password' });
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .query(`
                SELECT u.userid, u.username, u.email, u.role, u.fullname, u.membershipid, 
                       m.tiername, m.discountpct
                FROM users u
                LEFT JOIN memberships m ON u.membershipid = m.membershipid
                WHERE u.email = @email
            `);
        if (!result.recordset.length) return res.status(401).json({ error: 'No account found with that email' });
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  FACILITIES
// ═══════════════════════════════════════════════════════════════

// GET /facilities — all active facilities with is_auctionable flag
app.get('/facilities', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT facilityid, name, description, capacity, is_auctionable, isactive, base_price
            FROM facilities WHERE isactive = 1
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  USER-SCOPED BOOKINGS
// ═══════════════════════════════════════════════════════════════

// GET /my-bookings/:userid — non-cancelled bookings for this user
app.get('/my-bookings/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query(`
                SELECT b.bookingid, b.userid, u.username, f.name AS facility,
                       t.starttime, t.endtime, b.bookingdate,
                       b.finalprice, b.status, b.createdat
                FROM bookings b
                JOIN users      u ON b.userid     = u.userid
                JOIN facilities f ON b.facilityid = f.facilityid
                JOIN timeslots  t ON b.slotid     = t.slotid
                WHERE b.userid = @userid
                  AND LOWER(b.status) != 'cancelled'
                ORDER BY b.bookingdate DESC
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  BIDS ENGINE
// ═══════════════════════════════════════════════════════════════

// POST /bids — place a bid (must be multiple of 500, must beat current highest)
app.post('/bids', async (req, res) => {
    const { bookingid, userid, bidamount } = req.body;
    if (!bookingid || !userid || !bidamount) return res.status(400).json({ error: 'Missing parameters' });
    if (bidamount % 500 !== 0) return res.status(400).json({ error: 'Bid must be a multiple of 500' });
    try {
        const pool = await sql.connect(config);
        const highestBidResult = await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .query('SELECT TOP 1 userid, bidamount FROM bids WHERE bookingid = @bookingid ORDER BY bidamount DESC');
        const currentHighest = highestBidResult.recordset.length > 0 ? Number(highestBidResult.recordset[0].bidamount) : 0;
        const prevUser = highestBidResult.recordset.length > 0 ? highestBidResult.recordset[0].userid : null;
        if (bidamount <= currentHighest) {
            return res.status(400).json({ error: `Bid must be higher than current highest bid (Rs ${currentHighest})` });
        }
        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('userid', sql.Int, userid)
            .input('bidamount', sql.Decimal(10, 2), bidamount)
            .query('INSERT INTO bids (bookingid, userid, bidamount) VALUES (@bookingid, @userid, @bidamount)');
        if (prevUser && prevUser !== userid) {
            await pool.request()
                .input('userid', sql.Int, prevUser)
                .input('msg', sql.VarChar(500), `\u26a1 You've been outbid on Booking #${bookingid}! New highest bid: Rs ${bidamount.toLocaleString()}. Place a higher bid to win!`)
                .query('INSERT INTO notifications (userid, message) VALUES (@userid, @msg)');
        }
        res.json({ success: true, newHighestBid: bidamount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /auction-finalize/:bookingid — mark auction winner booking as confirmed
app.post('/auction-finalize/:bookingid', async (req, res) => {
    const bookingid = parseInt(req.params.bookingid);
    try {
        const pool = await sql.connect(config);
        // Get highest bidder
        const bidResult = await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .query('SELECT TOP 1 userid, bidamount FROM bids WHERE bookingid = @bookingid ORDER BY bidamount DESC');
        if (!bidResult.recordset.length) return res.status(404).json({ error: 'No bids found for this auction' });
        const { userid, bidamount } = bidResult.recordset[0];
        // Update booking: set winner's userid and confirmed status
        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('userid', sql.Int, userid)
            .input('price', sql.Decimal(10, 2), bidamount)
            .query('UPDATE bookings SET userid = @userid, finalprice = @price, status = \'confirmed\' WHERE bookingid = @bookingid');
        // Notify winner
        await pool.request()
            .input('userid', sql.Int, userid)
            .input('msg', sql.VarChar(500), `\u2705 You won the auction for Booking #${bookingid}! Final bid: Rs ${Number(bidamount).toLocaleString()}. Your booking is now confirmed.`)
            .query('INSERT INTO notifications (userid, message) VALUES (@userid, @msg)');
        res.json({ success: true, winner_userid: userid, final_price: bidamount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

// GET /notifications/:userid
app.get('/notifications/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query('SELECT * FROM notifications WHERE userid = @userid ORDER BY createdat DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /notifications/:userid/read — mark all as read
app.put('/notifications/:userid/read', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query('UPDATE notifications SET isread = 1 WHERE userid = @userid');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  AUCTIONS EXTENDED (timer data)
// ═══════════════════════════════════════════════════════════════

// GET /auctions-extended — active auctions with full slot time info
app.get('/auctions-extended', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT
                a.bookingid,
                a.facility,
                a.bookingdate,
                a.current_highest_bid,
                t.starttime,
                t.endtime,
                b.userid AS owner_userid
            FROM view_active_auctions a
            JOIN bookings b ON a.bookingid = b.bookingid
            JOIN timeslots t ON b.slotid = t.slotid
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  MODULE 1 — Advanced Booking & Automation Logic
// ═══════════════════════════════════════════════════════════════

// 1. GET /availability?date=YYYY-MM-DD
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

// 2. GET /next-available-slots
app.get('/next-available-slots', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_next_available_slots');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. GET /waitlist-priority
app.get('/waitlist-priority', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_waitlist_priority');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. GET /booking-conflicts
app.get('/booking-conflicts', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_booking_conflicts');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. GET /active-auctions
app.get('/active-auctions', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_active_auctions');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. GET /user-bids/:userid
app.get('/user-bids/:userid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .execute('sp_get_user_bids');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. GET /auction-winners
app.get('/auction-winners', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_auction_winners');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. GET /monthly-revenue
app.get('/monthly-revenue', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_monthly_revenue');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. GET /discounted-price
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

// 10. GET /validate-coupon
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

// 11. GET /user-status/:userid
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

// 12. GET /equipment-availability
app.get('/equipment-availability', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_equipment_availability');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 13. GET /booking-rentals/:bookingid
app.get('/booking-rentals/:bookingid', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.bookingid)
            .execute('sp_get_booking_rentals');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 14. GET /top-facilities
app.get('/top-facilities', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_top_facilities');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 15. GET /peak-hours
app.get('/peak-hours', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_peak_hours');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 16. GET /power-users
app.get('/power-users', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_power_users');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 17. GET /facility-health
app.get('/facility-health', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_facility_health');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 18. GET /facility-ratings
app.get('/facility-ratings', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_facility_ratings');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------------
//  ADMIN MODULE
// ---------------------------------------------------------------

app.get('/admin/stats', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT * FROM view_admin_stats');
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/admin/bookings', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`SELECT b.bookingid, u.fullname, f.name AS facility, t.starttime, t.endtime, b.bookingdate, b.finalprice, b.status FROM bookings b JOIN users u ON b.userid = u.userid JOIN facilities f ON b.facilityid = f.facilityid JOIN timeslots t ON b.slotid = t.slotid ORDER BY b.createdat DESC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/facilities/:id', async (req, res) => {
    const { base_price } = req.body;
    if (!base_price) return res.status(400).json({ error: 'base_price is required' });
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id).input('price', sql.Decimal(10, 2), base_price).query('UPDATE facilities SET base_price = @price WHERE facilityid = @id');
        res.json({ message: 'Facility price updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/facilities', async (req, res) => {
    const { name, base_price, is_auctionable, capacity } = req.body;
    if (!name || !base_price) return res.status(400).json({ error: 'Name and base_price are required' });
    try {
        const pool = await sql.connect(config);
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('price', sql.Decimal(10, 2), base_price)
            .input('is_auction', sql.Bit, is_auctionable ? 1 : 0)
            .input('capacity', sql.Int, capacity || 20)
            .query('INSERT INTO facilities (name, base_price, is_auctionable, capacity) VALUES (@name, @price, @is_auction, @capacity)');
        res.status(201).json({ message: 'Facility added successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/facilities/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM facilities WHERE facilityid = @id');
        res.json({ message: 'Facility deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});




app.get('/facilities/:id/reviews', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().input('fid', sql.Int, req.params.id).query(`
            SELECT r.rating, r.comment, u.fullname
            FROM reviews r
            JOIN users u ON r.userid = u.userid
            WHERE r.facilityid = @fid
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
