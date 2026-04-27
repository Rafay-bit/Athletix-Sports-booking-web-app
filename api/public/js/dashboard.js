// dashboard.js — User dashboard logic (student / staff)

const API = '';
let currentUser = null;

// ── Auth guard ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const raw = sessionStorage.getItem('user');
    if (!raw) { window.location.href = '/'; return; }
    currentUser = JSON.parse(raw);
    if (currentUser.role === 'admin') { window.location.href = '/admin.html'; return; }

    // Populate sidebar
    document.getElementById('userAvatar').textContent = currentUser.fullname ? currentUser.fullname.charAt(0) : 'U';
    document.getElementById('userName').textContent = currentUser.fullname || currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role;

    // Nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('sec-' + item.dataset.section).classList.add('active');
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('user');
        window.location.href = '/';
    });

    // Search availability
    document.getElementById('searchBtn').addEventListener('click', loadAvailability);

    // Load initial data
    loadFacilities();
    loadBookings();
    loadAuctions();
    loadEquipment();
    loadNotifications();
});

// ── FACILITIES ──────────────────────────────────────────────
async function loadFacilities() {
    const grid = document.getElementById('facilityGrid');
    try {
        const [facRes, ratRes] = await Promise.all([
            fetch(API + '/api/features/facility-ratings'),
            fetch(API + '/api/features/facility-health')
        ]);
        const facData = await facRes.json();
        const healthData = await ratRes.json();

        // Merge ratings and health data
        const ratings = {};
        if (facData.success) {
            facData.data.forEach(r => { ratings[r.name] = r; });
        }
        const health = {};
        if (healthData.success) {
            healthData.data.forEach(h => { health[h.name] = h; });
        }

        // Get all facility names from ratings (since they come from view)
        const facilities = facData.success ? facData.data : [];

        if (!facilities.length) {
            grid.innerHTML = '<div class="empty-state"><div class="icon">🏟️</div><p>No facilities found</p></div>';
            return;
        }

        const icons = { 'cricket': '🏏', 'swimming': '🏊', 'tennis': '🎾', 'badminton': '🏸', 'football': '⚽', 'futsal': '⚽', 'indoor': '🏀', 'gym': '💪', 'squash': '🎯', 'pool': '🏊' };

        grid.innerHTML = facilities.map((f, i) => {
            const avgRating = f.average_rating ? parseFloat(f.average_rating).toFixed(1) : '—';
            const reviews = f.total_reviews || 0;
            const h = health[f.name] || {};
            const icon = Object.keys(icons).find(k => f.name.toLowerCase().includes(k));

            return `
            <div class="facility-card stagger-${(i % 12) + 1}">
                <div class="facility-card-header">
                    <span class="rating-badge">${avgRating}</span>
                    <span class="type-icon">${icons[icon] || '🏟️'}</span>
                </div>
                <div class="facility-card-body">
                    <div class="name">${f.name}</div>
                    <div class="facility-card-stats">
                        <div class="stat">
                            <span class="stat-label">Rating</span>
                            <span class="stat-val">${avgRating}★</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Reviews</span>
                            <span class="stat-val">${reviews}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Bookings</span>
                            <span class="stat-val">${h.active_days || 0}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        grid.innerHTML = '<div class="empty-state"><p>Failed to load facilities</p></div>';
    }
}

// ── MY BOOKINGS ─────────────────────────────────────────────
async function loadBookings() {
    const tbody = document.getElementById('bookingsTableBody');
    try {
        const res = await fetch(API + '/api/bookings');
        const data = await res.json();

        if (!data.success || !data.data.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">No bookings found</td></tr>';
            return;
        }

        // Filter bookings for current user
        const myBookings = data.data.filter(b => b.username === currentUser.username);

        if (!myBookings.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">You have no bookings yet</td></tr>';
            return;
        }

        tbody.innerHTML = myBookings.map(b => `
            <tr>
                <td style="font-family:var(--font-display);font-size:1.1rem">#${b.bookingid}</td>
                <td>${b.facility}</td>
                <td>${formatDate(b.bookingdate)}</td>
                <td>${formatTime(b.starttime)} — ${formatTime(b.endtime)}</td>
                <td style="color:var(--accent-gold)">Rs ${parseFloat(b.finalprice).toLocaleString()}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Failed to load bookings</td></tr>';
    }
}

// ── SEARCH AVAILABILITY ─────────────────────────────────────
async function loadAvailability() {
    const date = document.getElementById('searchDate').value;
    const container = document.getElementById('availabilityResults');
    if (!date) { container.innerHTML = '<div class="empty-state"><p>Please select a date</p></div>'; return; }

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const res = await fetch(API + '/api/features/available-facilities?date=' + date);
        const data = await res.json();

        if (!data.success || !data.data.length) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No available slots for this date</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="table-wrap" style="animation-delay:0.1s">
                <table>
                    <thead><tr><th>Facility</th><th>Start</th><th>End</th></tr></thead>
                    <tbody>
                        ${data.data.map(s => `
                            <tr>
                                <td>${s.name}</td>
                                <td style="color:var(--accent-green)">${formatTime(s.starttime)}</td>
                                <td style="color:var(--accent-green)">${formatTime(s.endtime)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = '<div class="empty-state"><p>Failed to search. Is the server running?</p></div>';
    }
}

// ── AUCTIONS ────────────────────────────────────────────────
async function loadAuctions() {
    const grid = document.getElementById('auctionGrid');
    try {
        const res = await fetch(API + '/api/features/active-auctions');
        const data = await res.json();

        if (!data.success || !data.data.length) {
            grid.innerHTML = '<div class="empty-state"><div class="icon">⚡</div><p>No active auctions right now</p></div>';
            return;
        }

        grid.innerHTML = data.data.map((a, i) => `
            <div class="auction-card stagger-${(i % 6) + 1}">
                <div class="auction-card-top">
                    <div class="facility-name">${a.facility}</div>
                    <div class="auction-date">📅 ${formatDate(a.bookingdate)}</div>
                </div>
                <div class="auction-card-body">
                    <div class="auction-bid-display">
                        <div class="label">Current Highest Bid</div>
                        <div class="amount">Rs ${a.current_highest_bid ? parseFloat(a.current_highest_bid).toLocaleString() : '—'}</div>
                    </div>
                    <div style="text-align:center">
                        <span class="badge badge-open_bid">LIVE AUCTION</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<div class="empty-state"><p>Failed to load auctions</p></div>';
    }
}

// ── EQUIPMENT ───────────────────────────────────────────────
async function loadEquipment() {
    const grid = document.getElementById('equipmentGrid');
    try {
        const res = await fetch(API + '/api/features/equipment-availability');
        const data = await res.json();

        if (!data.success || !data.data.length) {
            grid.innerHTML = '<div class="empty-state"><div class="icon">🎾</div><p>No equipment data available</p></div>';
            return;
        }

        grid.innerHTML = data.data.map((eq, i) => {
            const available = eq.available_stock;
            const stockColor = available > 5 ? 'var(--accent-green)' : available > 0 ? 'var(--accent-gold)' : 'var(--accent-red)';
            return `
            <div class="facility-card stagger-${(i % 12) + 1}">
                <div class="facility-card-header" style="height:40px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(26,83,92,0.1))">
                    <span class="type-icon" style="font-size:1.3rem">🎾</span>
                </div>
                <div class="facility-card-body">
                    <div class="name" style="font-size:1rem">${eq.itemname}</div>
                    <div class="facility-card-stats">
                        <div class="stat">
                            <span class="stat-label">Rate/hr</span>
                            <span class="stat-val" style="color:var(--accent-gold)">Rs ${parseFloat(eq.hourlyrate).toFixed(0)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Stock</span>
                            <span class="stat-val">${eq.totalstock}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Available</span>
                            <span class="stat-val" style="color:${stockColor}">${available}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        grid.innerHTML = '<div class="empty-state"><p>Failed to load equipment data</p></div>';
    }
}

// ── NOTIFICATIONS ───────────────────────────────────────────
async function loadNotifications() {
    const list = document.getElementById('notifList');
    try {
        // We don't have a dedicated notifications endpoint, so we use the user-status
        // For now, show a placeholder until we add a notifications endpoint
        const res = await fetch(API + '/api/features/user-status/' + currentUser.userid);
        const data = await res.json();

        let html = '';
        if (data.success) {
            const d = data.data;
            if (d.active_penalties > 0) {
                html += `<div class="notif-item penalty stagger-1"><div class="notif-dot"></div><div><div class="notif-text">⚠️ You have <strong>${d.active_penalties}</strong> active penalty notification(s). Please resolve them to continue booking.</div></div></div>`;
            }
            html += `<div class="notif-item ${d.can_book ? 'unread' : ''} stagger-2"><div class="notif-dot"></div><div><div class="notif-text">${d.can_book ? '✅ Your account is in good standing. You are eligible to make new bookings.' : '🚫 Your account is currently restricted from making new bookings due to pending penalties.'}</div></div></div>`;
        }

        if (!html) html = '<div class="empty-state"><div class="icon">🔔</div><p>No notifications</p></div>';
        list.innerHTML = html;
    } catch (err) {
        list.innerHTML = '<div class="empty-state"><p>Failed to load notifications</p></div>';
    }
}

// ── HELPERS ─────────────────────────────────────────────────
function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(t) {
    if (!t) return '—';
    // Handle time strings like "10:00:00"
    const parts = t.split(':');
    const h = parseInt(parts[0]);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}
