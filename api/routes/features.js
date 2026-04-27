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

/**
 * 5. Live Auction Leaderboard
 * View: view_active_auctions
 * GET /api/features/active-auctions
 * Lists all open_bid bookings with their current highest bid.
 */
router.get('/active-auctions', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM view_active_auctions');
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

module.exports = router;
