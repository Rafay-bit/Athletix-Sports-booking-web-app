
# Read the current server.js
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Keep only the top part: express setup + users CRUD + bookings CRUD
# Cut at the first extension block marker (keeping what was before it)
cut_marker = '// ═══════════════════════════════════════════════════════════════\r\n//  MODULE 1'
idx = content.find(cut_marker)
# Also check the older extension block
ext_marker = '// ═══════════════════════════════════════════════════════════════\r\n//  LOGIN'
idx2 = content.find(ext_marker)

# Use whichever comes first (and is valid)
cuts = [i for i in [idx, idx2] if i > 0]
cut_at = min(cuts) if cuts else len(content)

base = content[:cut_at].rstrip()

# New clean extension (all non-CRUD routes)
extension = r"""


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
            .query('SELECT userid, username, email, role, fullname FROM users WHERE email = @email');
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
"""

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(base + extension)

print("server.js cleaned and rebuilt successfully")
import subprocess
result = subprocess.run(['node', '--check', 'server.js'], capture_output=True, text=True)
print("Syntax check:", result.returncode, result.stderr or "OK")
