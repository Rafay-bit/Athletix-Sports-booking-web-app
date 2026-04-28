// routes/features.js
// All 18 advanced DQL endpoints (Views & Stored Procedures)
// Module 1: Advanced Booking & Automation Logic  (features 1–4)
// Module 2: The Bidding Engine                    (features 5–7)
// Module 3: Financials & Monetization             (features 8–11)
// Module 4: Inventory & Equipment                 (features 12–13)
// Module 5: Admin Analytics & Reports             (features 14–18)

const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — Advanced Booking & Automation Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Smart Availability Search
 * SP: sp_get_available_facilities
 * GET /api/features/available-facilities?date=YYYY-MM-DD
 * Returns all facility+slot combinations that are open on a given date.
 */
router.get('/available-facilities', async (req, res) => {
    const { date } = req.query;
    if (!date)
        return res.status(400).json({ success: false, error: 'Query param "date" (YYYY-MM-DD) is required' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('targetdate', sql.Date, date)
            .execute('sp_get_available_facilities');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 2. Next-Available Slot Suggester
 * View: view_next_available_slots
 * GET /api/features/next-available-slots
 * Returns 10 upcoming empty slots across all active facilities.
 */
router.get('/next-available-slots', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_next_available_slots');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 3. Waitlist Auto-Promotion Selector
 * View: view_waitlist_priority
 * GET /api/features/waitlist-priority
 * Returns the highest-priority user in each waitlist.
 */
router.get('/waitlist-priority', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_waitlist_priority');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 4. Conflict Prevention Check
 * View: view_booking_conflicts
 * GET /api/features/booking-conflicts
 * Returns bookings that overlap with scheduled maintenance.
 */
router.get('/booking-conflicts', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_booking_conflicts');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — The Bidding Engine
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/features/timeslots — all time slots from DB
router.get('/timeslots', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT slotid,
                   CONVERT(VARCHAR(5), starttime, 108) AS starttime,
                   CONVERT(VARCHAR(5), endtime,   108) AS endtime
            FROM timeslots ORDER BY starttime
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Live Auction Leaderboard
router.get('/active-auctions', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT b.bookingid,
                   f.name                                          AS facility,
                   CONVERT(VARCHAR(10), b.bookingdate, 23)         AS bookingdate,
                   CONVERT(VARCHAR(5),  t.starttime, 108)          AS starttime,
                   CONVERT(VARCHAR(5),  t.endtime,   108)          AS endtime,
                   b.userid                                        AS creator_userid,
                   ISNULL(MAX(bi.bidamount), 0)                    AS current_highest_bid
            FROM   bookings  b
            JOIN   facilities f ON b.facilityid = f.facilityid
            JOIN   timeslots  t ON b.slotid     = t.slotid
            LEFT JOIN bids bi   ON b.bookingid  = bi.bookingid
            WHERE  b.status = 'open_bid'
            GROUP BY b.bookingid, f.name, b.bookingdate, t.starttime, t.endtime, b.userid
            ORDER BY b.bookingdate, t.starttime
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 6. User Bid History Tracker
 * SP: sp_get_user_bids
 * GET /api/features/user-bids/:userid
 * Returns all bids placed by a specific user with Winning/Outbid status.
 */
router.get('/user-bids/:userid', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .execute('sp_get_user_bids');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 7. Winning Bid Finalizer
 * View: view_auction_winners
 * GET /api/features/auction-winners
 * Shows the winning bidder and final price for every completed auction.
 */
router.get('/auction-winners', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_auction_winners');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — Financials & Monetization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 8. Monthly Revenue Heatmap
 * View: view_monthly_revenue
 * GET /api/features/monthly-revenue
 * Returns total revenue grouped by month (YYYY-MM).
 */
router.get('/monthly-revenue', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_monthly_revenue');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 9. Membership Discount Calculator
 * SP: sp_calculate_discounted_price
 * GET /api/features/discounted-price?userid=1&baseprice=100.00
 * Returns the discounted final price for a user based on their membership tier.
 */
router.get('/discounted-price', async (req, res) => {
    const { userid, baseprice } = req.query;
    if (!userid || !baseprice)
        return res.status(400).json({ success: false, error: 'Query params "userid" and "baseprice" are required' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, parseInt(userid))
            .input('baseprice', sql.Decimal(10, 2), parseFloat(baseprice))
            .execute('sp_calculate_discounted_price');
        res.json({ success: true, data: result.recordset[0] || { message: 'User has no membership' } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 10. Coupon Validator
 * SP: sp_validate_coupon
 * GET /api/features/validate-coupon?code=SUMMER20
 * Verifies a coupon code and returns its discount value.
 */
router.get('/validate-coupon', async (req, res) => {
    const { code } = req.query;
    if (!code)
        return res.status(400).json({ success: false, error: 'Query param "code" is required' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('code', sql.VarChar(20), code)
            .execute('sp_validate_coupon');
        if (!result.recordset.length)
            return res.status(404).json({ success: false, error: 'Coupon not found or invalid' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 11. Unpaid Penalty Block Check
 * SP: sp_check_user_status
 * GET /api/features/user-status/:userid
 * Returns the number of unread penalty notifications for a user.
 * If active_penalties > 0 the user should be blocked from new bookings.
 */
router.get('/user-status/:userid', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .execute('sp_check_user_status');
        const { active_penalties } = result.recordset[0];
        res.json({
            success: true,
            data: {
                userid: parseInt(req.params.userid),
                active_penalties,
                can_book: active_penalties === 0,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — Inventory & Equipment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 12. Real-Time Inventory Check
 * View: view_equipment_availability
 * GET /api/features/equipment-availability
 * Shows each item, its hourly rate, and how many units are currently rented.
 */
router.get('/equipment-availability', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_equipment_availability');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 13. Rental Attachment Query
 * SP: sp_get_booking_rentals
 * GET /api/features/booking-rentals/:bookingid
 * Returns the list of equipment rented for a specific booking.
 */
router.get('/booking-rentals/:bookingid', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.bookingid)
            .execute('sp_get_booking_rentals');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5 — Admin Analytics & Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 14. Top 5 Most Popular Facilities
 * View: view_top_facilities
 * GET /api/features/top-facilities
 * Returns the 5 facilities ranked by total booking count.
 */
router.get('/top-facilities', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_top_facilities');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 15. Peak Usage Hours
 * View: view_peak_hours
 * GET /api/features/peak-hours
 * Shows which time slots see the highest booking frequency.
 */
router.get('/peak-hours', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_peak_hours');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 16. User Engagement Leaderboard
 * View: view_power_users
 * GET /api/features/power-users
 * Returns the top 10 users by total number of bookings.
 */
router.get('/power-users', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_power_users');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 17. Facility Health Report
 * View: view_facility_health
 * GET /api/features/facility-health
 * Compares maintenance days vs active booking days per facility.
 */
router.get('/facility-health', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_facility_health');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 18. Feedback & Sentiment Analysis
 * View: view_facility_ratings
 * GET /api/features/facility-ratings
 * Returns average rating and review count per facility.
 */
router.get('/facility-ratings', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_facility_ratings');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Full Facilities List (with facilityid, price_per_hour for booking modal)
// GET /api/features/facilities-full
// ─────────────────────────────────────────────────────────────────────────────
router.get('/facilities-full', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT f.facilityid, f.name,
                   CAST(f.description AS VARCHAR(MAX)) AS description,
                   f.capacity, f.is_auctionable,
                   ISNULL(f.base_price, 0) AS base_price,
                   CAST(ISNULL(AVG(CAST(r.rating AS FLOAT)), 0) AS DECIMAL(3,1)) AS average_rating,
                   COUNT(r.reviewid) AS total_reviews
            FROM facilities f
            LEFT JOIN reviews r ON f.facilityid = r.facilityid
            WHERE f.isactive = 1
            GROUP BY f.facilityid, f.name, CAST(f.description AS VARCHAR(MAX)),
                     f.capacity, f.is_auctionable, f.base_price
            ORDER BY f.name
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Available Slots for Next 3 Days (fixed timing, future-only)
// GET /api/features/available-slots-3days
// ─────────────────────────────────────────────────────────────────────────────
router.get('/available-slots-3days', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT f.name,
                   t.slotid,
                   CONVERT(VARCHAR(5), t.starttime, 108) AS starttime,
                   CONVERT(VARCHAR(5), t.endtime,   108) AS endtime,
                   CONVERT(VARCHAR(10), DATEADD(day, n.n, CAST(GETDATE() AS DATE)), 23) AS available_date
            FROM   (VALUES (1),(2),(3)) n(n)
            CROSS JOIN facilities f
            CROSS JOIN timeslots t
            WHERE  f.isactive = 1
              AND  NOT EXISTS (
                       SELECT 1 FROM bookings b
                       WHERE b.facilityid  = f.facilityid
                         AND b.slotid      = t.slotid
                         AND b.bookingdate = DATEADD(day, n.n, CAST(GETDATE() AS DATE))
                         AND b.status NOT IN ('cancelled')
                   )
            ORDER BY available_date, f.name, t.starttime
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Available Timeslots for a Given Facility + Date (for booking modal)
// GET /api/features/facility-slots/:facilityid?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/facility-slots/:facilityid', async (req, res) => {
    const { date } = req.query;
    if (!date)
        return res.status(400).json({ success: false, error: '"date" query param (YYYY-MM-DD) is required' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('facilityid', sql.Int, req.params.facilityid)
            .input('date',       sql.Date, date)
            .query(`
                SELECT t.slotid,
                       CONVERT(VARCHAR(5), t.starttime, 108) AS starttime,
                       CONVERT(VARCHAR(5), t.endtime,   108) AS endtime
                FROM   timeslots t
                WHERE  NOT EXISTS (
                           SELECT 1 FROM bookings b
                           WHERE b.facilityid  = @facilityid
                             AND b.slotid      = t.slotid
                             AND b.bookingdate = @date
                             AND b.status NOT IN ('cancelled')
                       )
                ORDER BY t.starttime
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Place a Bid (validates > current highest, then inserts)
// POST /api/features/place-bid
// Body: { bookingid, userid, bidamount }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/place-bid', async (req, res) => {
    const { bookingid, userid, bidamount } = req.body;
    if (!bookingid || !userid || !bidamount)
        return res.status(400).json({ success: false, error: 'bookingid, userid, and bidamount are required' });

    try {
        const pool = await getPool();

        // Get & validate against current highest bid
        const cur = await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .query(`SELECT ISNULL(MAX(bidamount), 0) AS maxbid FROM bids WHERE bookingid = @bookingid`);

        const maxbid = parseFloat(cur.recordset[0].maxbid);
        if (parseFloat(bidamount) <= maxbid)
            return res.status(400).json({
                success: false,
                error:   `Bid must exceed current highest of Rs ${maxbid.toLocaleString()}`
            });

        // Insert the new winning bid
        await pool.request()
            .input('bookingid', sql.Int,             bookingid)
            .input('userid',    sql.Int,             userid)
            .input('bidamount', sql.Decimal(10, 2),  bidamount)
            .query(`INSERT INTO bids (bookingid, userid, bidamount, bidtime)
                    VALUES (@bookingid, @userid, @bidamount, GETDATE())`);

        res.json({ success: true, message: 'Bid placed!', new_bid: bidamount });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Equipment linked to facilities that a user has booked
// GET /api/features/user-equipment/:userid
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user-equipment/:userid', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userid', sql.Int, req.params.userid)
            .query(`
                SELECT eq.itemid AS equipmentid,
                       eq.itemname,
                       eq.hourlyrate,
                       eq.totalstock,
                       -- Calculate available stock system-wide
                       eq.totalstock - ISNULL((
                           SELECT SUM(er2.qty)
                           FROM   equipment_rentals er2
                           JOIN   bookings b2 ON er2.bookingid = b2.bookingid
                           WHERE  er2.itemid = eq.itemid
                             AND  b2.status NOT IN ('cancelled', 'completed')
                       ), 0) AS available_stock,
                       -- Show the user's booked facilities as context
                       (SELECT STRING_AGG(fname, ', ')
                        FROM (SELECT DISTINCT f.name AS fname
                              FROM   bookings b
                              JOIN   facilities f ON b.facilityid = f.facilityid
                              WHERE  b.userid = @userid AND b.status IN ('confirmed', 'pending')
                             ) distinct_facs
                       ) AS facility_name
                FROM   equipment eq
                WHERE  EXISTS (
                    -- Only return equipment if the user actually has an active booking
                    SELECT 1 
                    FROM   bookings b 
                    WHERE  b.userid = @userid 
                      AND  b.status IN ('confirmed', 'pending')
                )
                ORDER BY eq.itemname
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/features/rent-equipment — Rent equipment against a booking
// Body: { bookingid, itemid, qty }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/rent-equipment', async (req, res) => {
    const { bookingid, itemid, qty } = req.body;
    if (!bookingid || !itemid || !qty || qty < 1)
        return res.status(400).json({ success: false, error: 'bookingid, itemid, and qty (>=1) are required' });
    try {
        const pool = await getPool();

        // Check available stock
        const stockCheck = await pool.request()
            .input('itemid', sql.Int, itemid)
            .query(`
                SELECT eq.totalstock - ISNULL((
                    SELECT SUM(er2.qty)
                    FROM   equipment_rentals er2
                    JOIN   bookings b2 ON er2.bookingid = b2.bookingid
                    WHERE  er2.itemid = eq.itemid
                      AND  b2.status NOT IN ('cancelled', 'completed')
                ), 0) AS available
                FROM equipment eq
                WHERE eq.itemid = @itemid
            `);

        if (!stockCheck.recordset.length)
            return res.status(404).json({ success: false, error: 'Equipment not found' });

        const available = stockCheck.recordset[0].available;
        if (qty > available)
            return res.status(400).json({ success: false, error: `Only ${available} units available` });

        // Insert the rental
        await pool.request()
            .input('bookingid', sql.Int, bookingid)
            .input('itemid', sql.Int, itemid)
            .input('qty', sql.Int, qty)
            .query('INSERT INTO equipment_rentals (bookingid, itemid, qty) VALUES (@bookingid, @itemid, @qty)');

        res.json({ success: true, message: `Rented ${qty} unit(s) successfully` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/features/booking-equipment/:bookingid — Equipment rented for a booking
// ─────────────────────────────────────────────────────────────────────────────
router.get('/booking-equipment/:bookingid', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('bookingid', sql.Int, req.params.bookingid)
            .query(`
                SELECT er.rentalid, eq.itemname, er.qty, eq.hourlyrate
                FROM equipment_rentals er
                JOIN equipment eq ON er.itemid = eq.itemid
                WHERE er.bookingid = @bookingid
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
