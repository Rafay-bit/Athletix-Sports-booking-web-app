import re

with open('server.js', 'r', encoding='utf-8') as f:
    js = f.read()

new_endpoints = """
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
"""

# Insert before MODULE 1
js = js.replace('// ═══════════════════════════════════════════════════════════════\n//  MODULE 1', new_endpoints + '\n// ═══════════════════════════════════════════════════════════════\n//  MODULE 1')

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(js)
