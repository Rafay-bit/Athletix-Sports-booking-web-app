// dashboard.js — User dashboard (booking, filtering, bidding — full feature set)
'use strict';

const API = '';
let currentUser   = null;
let allFacilities = [];   // cached for filter/modal

// ─── AUTH GUARD & INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const raw = sessionStorage.getItem('user');
    if (!raw) { window.location.href = '/'; return; }
    currentUser = JSON.parse(raw);
    if (currentUser.role === 'admin') { window.location.href = '/admin.html'; return; }

    document.getElementById('userAvatar').textContent =
        currentUser.fullname ? currentUser.fullname.charAt(0).toUpperCase() : 'U';
    document.getElementById('userName').textContent  = currentUser.fullname || currentUser.username;
    document.getElementById('userRole').textContent  = currentUser.role;

    // Nav switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('sec-' + item.dataset.section).classList.add('active');
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('user');
        window.location.href = '/';
    });

    buildBookingModal();

    loadFacilities();
    loadBookings();
    loadAuctions();
    loadEquipment();
    loadNotifications();
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING MODAL
// ═══════════════════════════════════════════════════════════════════════════════
let selectedFacility = null;
let selectedDate     = null;
let selectedSlot     = null;

function buildBookingModal() {
    if (document.getElementById('bookingModal')) return;
    const el = document.createElement('div');
    el.id        = 'bookingModal';
    el.className = 'modal-overlay hidden';
    el.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="modalFacilityName">Book Facility</h3>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-form-group">
                    <span class="modal-label">Select Date — Next 3 Days Only</span>
                    <div class="date-pills" id="datePills"></div>
                </div>
                <div class="modal-form-group" id="slotsGroup" style="display:none">
                    <span class="modal-label">Available Time Slots</span>
                    <div class="slots-grid" id="slotsGrid"></div>
                </div>
                <!-- Shown only for auctionable facilities -->
                <div class="modal-form-group modal-auction-group" id="auctionBidGroup" style="display:none">
                    <span class="modal-label">⚡ Starting Bid Amount (Rs)</span>
                    <input type="number" id="startingBidInput" class="bid-input"
                           placeholder="Enter your opening bid (e.g. 500)" min="1" step="50"
                           style="width:100%;font-size:1rem;padding:12px 14px">
                    <div class="modal-auction-note">
                        You are opening a live auction. All users can outbid you until
                        <strong>6 hours before the slot starts</strong>. The highest bidder wins.
                    </div>
                </div>
                <div id="modalError" class="modal-error hidden"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline btn-sm" onclick="closeModal()">CANCEL</button>
                <button class="btn btn-primary" id="confirmBookBtn" disabled onclick="confirmBooking()">CONFIRM BOOKING</button>
            </div>
        </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeModal(); });
}

// Called by facility card onclick — uses facilityid to look up cached data
function openBookingModal(facilityId) {
    selectedFacility = allFacilities.find(f => f.facilityid === facilityId);
    if (!selectedFacility) return;
    selectedDate = null;
    selectedSlot = null;

    const isAuction = !!selectedFacility.is_auctionable;
    const btn       = document.getElementById('confirmBookBtn');
    const bidGroup  = document.getElementById('auctionBidGroup');
    const bidInput  = document.getElementById('startingBidInput');

    // Update modal header and button label based on type
    document.getElementById('modalFacilityName').textContent =
        isAuction ? '⚡ OPEN AUCTION: ' + selectedFacility.name
                  : 'BOOK: ' + selectedFacility.name;
    btn.textContent    = isAuction ? 'START AUCTION' : 'CONFIRM BOOKING';
    btn.disabled       = true;
    bidGroup.style.display  = isAuction ? 'flex' : 'none';
    if (bidInput) bidInput.value = '';

    document.getElementById('slotsGroup').style.display = 'none';
    document.getElementById('modalError').classList.add('hidden');

    // Build next-3-days date pills
    const pills = document.getElementById('datePills');
    pills.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
        const d       = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const label   = d.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' });
        const pill    = document.createElement('div');
        pill.className    = 'date-pill';
        pill.textContent  = label;
        pill.dataset.date = dateStr;
        pill.addEventListener('click', () => {
            document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedDate = dateStr;
            selectedSlot = null;
            document.getElementById('confirmBookBtn').disabled = true;
            loadSlotsForModal(selectedFacility.facilityid, dateStr);
        });
        pills.appendChild(pill);
    }

    document.getElementById('bookingModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('bookingModal').classList.add('hidden');
    document.body.style.overflow = '';
    selectedFacility = selectedDate = selectedSlot = null;
}

async function loadSlotsForModal(facilityid, date) {
    const grid  = document.getElementById('slotsGrid');
    const group = document.getElementById('slotsGroup');
    group.style.display = 'block';
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">Loading slots…</div>';

    try {
        const res  = await fetch(`${API}/api/features/facility-slots/${facilityid}?date=${date}`);
        const data = await res.json();

        if (!data.success || !data.data.length) {
            grid.innerHTML = '<div style="color:var(--accent-gold);font-size:0.85rem;padding:8px 0">No available slots for this date — all booked.</div>';
            return;
        }

        grid.innerHTML = '';
        data.data.forEach(slot => {
            const btn = document.createElement('div');
            btn.className = 'slot-pill';
            btn.textContent = `${formatTime(slot.starttime)} – ${formatTime(slot.endtime)}`;
            btn.dataset.slotid = slot.slotid;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.slot-pill').forEach(s => s.classList.remove('active'));
                btn.classList.add('active');
                selectedSlot = slot;
                document.getElementById('confirmBookBtn').disabled = false;
            });
            grid.appendChild(btn);
        });
    } catch {
        grid.innerHTML = '<div style="color:var(--accent-red);font-size:0.85rem;padding:8px 0">Failed to load slots. Is server running?</div>';
    }
}

async function confirmBooking() {
    if (!selectedFacility || !selectedDate || !selectedSlot) return;

    const isAuction = !!selectedFacility.is_auctionable;
    const btn       = document.getElementById('confirmBookBtn');
    const errDiv    = document.getElementById('modalError');
    btn.disabled    = true;
    btn.textContent = isAuction ? 'STARTING AUCTION…' : 'BOOKING…';
    errDiv.classList.add('hidden');

    // For auctionable facilities — validate bid amount first
    let startingBid = 0;
    if (isAuction) {
        startingBid = parseFloat(document.getElementById('startingBidInput')?.value || 0);
        if (!startingBid || startingBid <= 0) {
            errDiv.textContent = 'Please enter a valid starting bid amount.';
            errDiv.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'START AUCTION';
            return;
        }
    }

    try {
        // Step 1: Create the booking
        const bookRes = await fetch(`${API}/api/bookings`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                userid:      currentUser.userid,
                facilityid:  selectedFacility.facilityid,
                slotid:      selectedSlot.slotid,
                bookingdate: selectedDate,
                finalprice:  0,
                status:      isAuction ? 'open_bid' : 'confirmed'
            })
        });
        const bookData = await bookRes.json();

        if (!bookData.success) {
            errDiv.textContent = bookData.error || 'Booking failed. Try another slot.';
            errDiv.classList.remove('hidden');
            return;
        }

        const newBookingId = bookData.data.bookingid;

        // Step 2: For auctions, place the initial bid
        if (isAuction) {
            const bidRes = await fetch(`${API}/api/features/place-bid`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    bookingid: newBookingId,
                    userid:    currentUser.userid,
                    bidamount: startingBid
                })
            });
            const bidData = await bidRes.json();
            if (!bidData.success) {
                // Booking created but bid failed — still show partial success
                errDiv.textContent = '⚠️ Auction opened but bid placement failed: ' + (bidData.error || '');
                errDiv.classList.remove('hidden');
            } else {
                closeModal();
                showToast(`⚡ Auction #${newBookingId} is LIVE! Rs ${startingBid.toLocaleString()} opening bid placed.`);
                loadAuctions();
                loadBookings();
            }
        } else {
            closeModal();
            showToast(`✅ Booking #${newBookingId} confirmed!`);
            loadBookings();
            loadEquipment();
        }
    } catch {
        errDiv.textContent = 'Connection failed. Please try again.';
        errDiv.classList.remove('hidden');
    } finally {
        btn.disabled    = false;
        btn.textContent = isAuction ? 'START AUCTION' : 'CONFIRM BOOKING';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKINGS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
async function loadBookings() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(`${API}/api/bookings`);
        const data = await res.json();

        if (!data.success || !data.data.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No bookings found</td></tr>';
            return;
        }

        // Filter bookings for current user, exclude open_bid since they're in Auctions
        const myBookings = data.data.filter(b => b.username === currentUser.username && b.status !== 'open_bid');

        if (!myBookings.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">You have no non-auction bookings yet</td></tr>';
            return;
        }

        tbody.innerHTML = myBookings.map(b => `
            <tr>
                <td style="font-family:var(--font-display);font-size:1.1rem">#${b.bookingid}</td>
                <td>${b.facility || '—'}</td>
                <td>${formatDate(b.bookingdate)}</td>
                <td>${formatTime(b.starttime)} — ${formatTime(b.endtime)}</td>
                <td style="color:var(--accent-gold)">Rs ${parseFloat(b.finalprice || 0).toLocaleString()}</td>
                <td><span class="badge badge-${b.status}">${b.status.toUpperCase()}</span></td>
                <td>
                    ${b.status !== 'cancelled' && b.status !== 'completed' 
                        ? `<button class="btn btn-outline btn-sm" onclick="cancelBooking(${b.bookingid})" style="border-color:var(--accent-red);color:var(--accent-red);">CANCEL</button>`
                        : '—'
                    }
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Failed to load bookings</td></tr>';
    }
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
        const res = await fetch(`${API}/api/bookings/${bookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Booking cancelled successfully', 'success');
            loadBookings();
            loadEquipment();
            renderFacilities(); // refresh available times
        } else {
            showToast('Failed to cancel: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch {
        showToast('Connection failed', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className   = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => {
        t.classList.remove('visible');
        setTimeout(() => t.remove(), 400);
    }, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACILITIES — name search + category filter + time-slot filter
// ═══════════════════════════════════════════════════════════════════════════════

// Map keywords in facility name → category label
const CATEGORY_MAP = [
    { key: 'cricket',   label: 'Cricket',   icon: '🏏' },
    { key: 'swimming',  label: 'Swimming',  icon: '🏊' },
    { key: 'pool',      label: 'Swimming',  icon: '🏊' },
    { key: 'tennis',    label: 'Tennis',    icon: '🎾' },
    { key: 'badminton', label: 'Badminton', icon: '🏸' },
    { key: 'football',  label: 'Football',  icon: '⚽' },
    { key: 'futsal',    label: 'Futsal',    icon: '⚽' },
    { key: 'indoor',    label: 'Indoor',    icon: '🏀' },
    { key: 'gym',       label: 'Gym',       icon: '💪' },
    { key: 'squash',    label: 'Squash',    icon: '🎯' },
];

function getCategoryOf(name) {
    const n = name.toLowerCase();
    const match = CATEGORY_MAP.find(c => n.includes(c.key));
    return match ? match.label : 'Other';
}

function getIconOf(name) {
    const n = name.toLowerCase();
    const match = CATEGORY_MAP.find(c => n.includes(c.key));
    return match ? match.icon : '🏟️';
}

// Set of facilityids that have the chosen timeslot available (null = no filter)
let availableFacilityIds = null;
let filterBarBuilt = false;
let selectedFilterDate = '';   // 'YYYY-MM-DD' or '' = all dates
let selectedFilterTime = '';   // 'HH:MM'     or '' = all times

async function loadFacilities() {
    const grid = document.getElementById('facilityGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const res  = await fetch(`${API}/api/features/facilities-full`);
        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'API error');
        if (!data.data.length) {
            grid.innerHTML = '<div class="empty-state"><div class="icon">🏟️</div><p>No facilities found in database</p></div>';
            return;
        }

        allFacilities = data.data;
        await buildFilterBar();
        renderFacilities();
    } catch (err) {
        grid.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Failed to load facilities: ${err.message}</p></div>`;
    }
}

async function buildFilterBar() {
    if (filterBarBuilt) return;
    filterBarBuilt = true;

    const section = document.getElementById('sec-facilities');
    const header  = section.querySelector('.section-header');
    const cats    = [...new Set(allFacilities.map(f => getCategoryOf(f.name)))];

    // Load real timeslots from DB
    let timeOpts = '<option value="">\u23F0 All Times</option>';
    try {
        const r = await fetch(`${API}/api/features/timeslots`);
        const d = await r.json();
        if (d.success && d.data.length) {
            timeOpts += d.data.map(t =>
                `<option value="${t.starttime}">${formatTime(t.starttime)} \u2013 ${formatTime(t.endtime)}</option>`
            ).join('');
        }
    } catch { /* use default */ }

    // Build date options for next 3 days
    const datePills = [{ label: 'All Dates', value: '' }];
    for (let i = 1; i <= 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        datePills.push({
            label: d.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' }),
            value: d.toISOString().split('T')[0]
        });
    }

    const bar = document.createElement('div');
    bar.className = 'filter-bar-wrap';
    bar.innerHTML = `
        <div class="filter-row">
            <div class="filter-search-wrap">
                <span class="filter-search-icon">&#128269;</span>
                <input type="text" id="facilityFilterInput"
                       class="filter-input" placeholder="Search by facility name\u2026">
            </div>
            <select id="facilityTimeSelect" class="filter-select">${timeOpts}</select>
        </div>
        <div class="filter-chips" id="filterDateChips">
            ${datePills.map((p, i) =>
                `<button class="chip date-chip ${i === 0 ? 'active' : ''}" data-date="${p.value}">
                    ${i === 0 ? '\uD83D\uDCC5' : '\uD83D\uDCC6'} ${p.label}
                </button>`
            ).join('')}
        </div>
        <div class="filter-chips" id="filterCategoryChips">
            <button class="chip active" data-cat="all">ALL</button>
            ${cats.map(c => {
                const icon = (CATEGORY_MAP.find(m => m.label === c) || {}).icon || '\uD83C\uDFDF\uFE0F';
                return `<button class="chip" data-cat="${c}">${icon} ${c}</button>`;
            }).join('')}
            <button class="chip" data-cat="auctionable">&#9889; Auctionable</button>
        </div>`;
    header.after(bar);

    // Date chip click
    bar.querySelector('#filterDateChips').addEventListener('click', async e => {
        if (!e.target.classList.contains('date-chip')) return;
        bar.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        selectedFilterDate = e.target.dataset.date;
        if (selectedFilterTime) await applyTimeFilter(selectedFilterTime);
        else renderFacilities();
    });

    // Category chip click
    bar.querySelector('#filterCategoryChips').addEventListener('click', e => {
        if (!e.target.classList.contains('chip') || e.target.classList.contains('date-chip')) return;
        bar.querySelectorAll('#filterCategoryChips .chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        renderFacilities();
    });

    // Name search
    document.getElementById('facilityFilterInput').addEventListener('input', renderFacilities);

    // Time filter
    document.getElementById('facilityTimeSelect').addEventListener('change', async () => {
        selectedFilterTime = document.getElementById('facilityTimeSelect').value;
        if (!selectedFilterTime) { availableFacilityIds = null; renderFacilities(); return; }
        await applyTimeFilter(selectedFilterTime);
    });
}

async function applyTimeFilter(startTime) {
    const sel = document.getElementById('facilityTimeSelect');
    sel.disabled = true;
    try {
        const res  = await fetch(`${API}/api/features/available-slots-3days`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // Match by starttime; optionally narrow to selectedFilterDate
        const matched = (data.data || []).filter(s => {
            if (s.starttime !== startTime) return false;
            if (selectedFilterDate) return s.available_date && s.available_date.startsWith(selectedFilterDate);
            return true; // No date selected → any of the 3 days qualifies
        });

        const freeNames = new Set(matched.map(s => s.name));
        availableFacilityIds = new Set(
            allFacilities.filter(f => freeNames.has(f.name)).map(f => f.facilityid)
        );
    } catch {
        availableFacilityIds = null;
        showToast('\u26A0\uFE0F Could not check availability — showing all', 'error');
    } finally {
        sel.disabled = false;
        renderFacilities();
    }
}

function renderFacilities() {
    const grid      = document.getElementById('facilityGrid');
    const query     = (document.getElementById('facilityFilterInput')?.value || '').toLowerCase().trim();
    const activeCat = document.querySelector('#filterCategoryChips .chip.active')?.dataset.cat || 'all';

    const filtered = allFacilities.filter(f => {
        // Name / description text search
        const text     = `${f.name} ${f.description || ''}`.toLowerCase();
        const matchTxt = !query || text.includes(query);

        // Category filter
        const cat       = getCategoryOf(f.name);
        const matchCat  = activeCat === 'all'
            || (activeCat === 'auctionable' && f.is_auctionable)
            || cat === activeCat;

        // Time filter
        const matchTime = !availableFacilityIds || availableFacilityIds.has(f.facilityid);

        return matchTxt && matchCat && matchTime;
    });

    if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No facilities match your filters</p></div>';
        return;
    }

    grid.innerHTML = filtered.map((f, i) => {
        const rating   = f.average_rating && parseFloat(f.average_rating) > 0
                         ? parseFloat(f.average_rating).toFixed(1) : '—';
        const icon     = getIconOf(f.name);
        const cat      = getCategoryOf(f.name);
        const canBid   = f.is_auctionable
            ? '<div class="facility-bid-badge">⚡ AUCTIONABLE</div>' : '';
        return `
        <div class="facility-card stagger-${(i % 12) + 1}" onclick="openBookingModal(${f.facilityid})">
            <div class="facility-card-header">
                <span class="rating-badge">${rating}${rating !== '—' ? '★' : ''}</span>
                <span class="type-icon">${icon}</span>
            </div>
            <div class="facility-card-body">
                <div class="facility-cat-label">${cat}</div>
                <div class="name">${f.name}</div>
                <div class="description">${(f.description || '').substring(0, 90)}${f.description && f.description.length > 90 ? '…' : ''}</div>
                <div class="facility-card-stats">
                    <div class="stat">
                        <span class="stat-label">Rating</span>
                        <span class="stat-val">${rating}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Reviews</span>
                        <span class="stat-val">${f.total_reviews || 0}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Capacity</span>
                        <span class="stat-val">${f.capacity || '—'}</span>
                    </div>
                </div>
                ${canBid}
                ${f.is_auctionable ? '' : `<div style="margin-top: 10px; font-weight: bold; color: var(--accent-green);">Rs ${parseFloat(f.base_price || 0).toLocaleString()} / hr</div>`}
                <div class="book-hint">TAP TO BOOK →</div>
            </div>
        </div>`;
    }).join('');
}

async function loadBookings() {
    const tbody = document.getElementById('bookingsTableBody');
    try {
        const res  = await fetch(`${API}/api/bookings`);
        const data = await res.json();
        const mine = (data.data || []).filter(b => b.username === currentUser.username);

        if (!mine.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">You have no bookings yet</td></tr>';
            return;
        }

        tbody.innerHTML = mine.map(b => `
            <tr>
                <td style="font-family:var(--font-display);font-size:1.1rem">#${b.bookingid}</td>
                <td>${b.facility}</td>
                <td>${formatDate(b.bookingdate)}</td>
                <td>${formatTime(b.starttime)} — ${formatTime(b.endtime)}</td>
                <td style="color:var(--accent-gold)">Rs ${parseFloat(b.finalprice).toLocaleString()}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
            </tr>`).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Failed to load bookings</td></tr>';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABLE SLOTS — next 3 days, grouped by date, fixed timings
// ═══════════════════════════════════════════════════════════════════════════════
async function loadAvailability() {
    const container = document.getElementById('availabilityResults');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const res  = await fetch(`${API}/api/features/available-slots-3days`);
        const data = await res.json();

        if (!data.success || !data.data.length) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No available slots for the next 3 days</p></div>';
            return;
        }

        // Group by date
        const byDate = {};
        data.data.forEach(s => {
            const key = (s.available_date || '').substring(0, 10);
            if (!byDate[key]) byDate[key] = [];
            byDate[key].push(s);
        });

        container.innerHTML = Object.entries(byDate).map(([date, slots]) => {
            const label = new Date(date + 'T00:00:00')
                .toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return `
            <div style="margin-bottom:32px">
                <div class="date-group-header">📅 ${label}</div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Facility</th><th>Start</th><th>End</th></tr></thead>
                        <tbody>
                            ${slots.map(s => `
                                <tr>
                                    <td>${s.name}</td>
                                    <td style="color:var(--accent-green);font-family:var(--font-display)">${formatTime(s.starttime)}</td>
                                    <td style="color:var(--accent-green);font-family:var(--font-display)">${formatTime(s.endtime)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }).join('');
    } catch {
        container.innerHTML = '<div class="empty-state"><p>Failed to load slots</p></div>';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUCTIONS — live bidding with 6-hour deadline countdown
// ═══════════════════════════════════════════════════════════════════════════════

// Compute the auction deadline: 6 hours before the booked slot starts
function getAuctionDeadline(bookingdate, starttime) {
    // bookingdate: "2026-04-29", starttime: "15:00"
    const dt = new Date(`${bookingdate}T${starttime}:00`);
    dt.setHours(dt.getHours() - 6);
    return dt;
}

function formatCountdown(deadline) {
    const diff = deadline - new Date();
    if (diff <= 0) return { text: 'CLOSED', closed: true };
    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const text = d > 0
        ? `${d}d ${h}h ${m}m`
        : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return { text, closed: false };
}

let auctionTimerInterval = null;

function startAuctionCountdowns() {
    if (auctionTimerInterval) clearInterval(auctionTimerInterval);
    auctionTimerInterval = setInterval(() => {
        document.querySelectorAll('.auction-countdown').forEach(el => {
            const deadline = new Date(el.dataset.deadline);
            const { text, closed } = formatCountdown(deadline);
            el.textContent = closed ? 'CLOSED' : text;
            if (closed) {
                el.style.color = 'var(--accent-red)';
                // Disable bid form for this card
                const card = el.closest('.auction-card');
                if (card) {
                    card.querySelectorAll('.bid-input, .bid-submit-btn').forEach(x => x.disabled = true);
                    card.querySelector('.bid-closed-msg')?.removeAttribute('style');
                }
            }
        });
    }, 1000);
}

async function loadAuctions() {
    const grid = document.getElementById('auctionGrid');
    try {
        const res  = await fetch(`${API}/api/features/active-auctions`);
        const data = await res.json();

        if (!data.success || !data.data.length) {
            grid.innerHTML = '<div class="empty-state"><div class="icon">⚡</div><p>No active auctions right now</p></div>';
            return;
        }

        grid.innerHTML = data.data.map((a, i) => {
            const bookingid    = a.bookingid;
            const currentBid   = a.current_highest_bid ? parseFloat(a.current_highest_bid) : 0;
            const minBid       = Math.ceil(currentBid > 0 ? currentBid + 100 : 500);
            const facilityName = a.facility || a.name || 'Facility';

            // Auction deadline: 6 hours before slot
            const starttime    = a.starttime || '00:00';
            const bookingdate  = (a.bookingdate || '').toString().substring(0, 10);
            const deadline     = getAuctionDeadline(bookingdate, starttime);
            const { text: cdText, closed } = formatCountdown(deadline);

            const slotLabel    = starttime ? `🕐 Slot: ${formatTime(starttime)}` : '';
            const deadlineISO  = deadline.toISOString();

            return `
            <div class="auction-card stagger-${(i % 6) + 1}">
                <div class="auction-card-top">
                    <div class="facility-name">${facilityName}</div>
                    <div class="auction-date">📅 ${formatDate(bookingdate)} &nbsp; ${slotLabel}</div>
                </div>
                <div class="auction-card-body">
                    <!-- Countdown -->
                    <div class="auction-countdown-wrap">
                        <div class="auction-countdown-label">BIDDING CLOSES IN</div>
                        <div class="auction-countdown ${closed ? 'closed' : ''}"
                             data-deadline="${deadlineISO}"
                             style="color:${closed ? 'var(--accent-red)' : 'var(--accent-gold)'}">
                            ${cdText}
                        </div>
                        ${closed ? '<div class="bid-closed-msg">🔒 Auction closed — no more bids accepted</div>' : ''}
                    </div>
                    <!-- Current bid -->
                    <div class="auction-bid-display">
                        <div class="label">CURRENT HIGHEST BID</div>
                        <div class="amount" id="bid-display-${bookingid}">
                            ${currentBid > 0 ? 'Rs ' + currentBid.toLocaleString() : 'No bids yet — be first!'}
                        </div>
                    </div>
                    <div style="text-align:center;margin-bottom:16px">
                        <span class="badge badge-open_bid">${closed ? 'CLOSED' : 'LIVE AUCTION'}</span>
                    </div>
                    <!-- Bid form (disabled if closed) -->
                    <div class="bid-form">
                        <input type="number"
                               class="bid-input"
                               id="bid-input-${bookingid}"
                               placeholder="Min Rs ${minBid.toLocaleString()}"
                               min="${minBid}"
                               step="50"
                               ${closed ? 'disabled' : ''}>
                        <button class="btn bid-submit-btn"
                                onclick="placeBid(${bookingid}, ${currentBid})"
                                ${closed ? 'disabled' : ''}>
                            BID NOW
                        </button>
                    </div>
                    <div class="bid-msg" id="bid-msg-${bookingid}"></div>
                </div>
            </div>`;
        }).join('');

        // Start live countdown
        startAuctionCountdowns();
    } catch {
        grid.innerHTML = '<div class="empty-state"><p>Failed to load auctions</p></div>';
    }
}

async function placeBid(bookingid, currentHighest) {
    const inputEl = document.getElementById(`bid-input-${bookingid}`);
    const msgEl   = document.getElementById(`bid-msg-${bookingid}`);
    const amount  = parseFloat(inputEl.value);

    // Reset message
    msgEl.style.color = '';
    msgEl.textContent  = '';

    if (!amount || isNaN(amount) || amount <= 0) {
        msgEl.style.color = 'var(--accent-red)';
        msgEl.textContent  = '⚠️ Enter a valid bid amount';
        return;
    }

    if (amount <= currentHighest) {
        msgEl.style.color = 'var(--accent-red)';
        msgEl.textContent  = `⚠️ Must exceed Rs ${currentHighest.toLocaleString()}`;
        return;
    }

    msgEl.style.color = 'var(--text-muted)';
    msgEl.textContent  = 'Placing bid…';

    try {
        const res  = await fetch(`${API}/api/features/place-bid`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ bookingid, userid: currentUser.userid, bidamount: amount })
        });
        const data = await res.json();

        if (data.success) {
            msgEl.style.color = 'var(--accent-green)';
            msgEl.textContent  = '✅ Bid placed! Refreshing…';
            // Update optimistically
            const dispEl = document.getElementById(`bid-display-${bookingid}`);
            if (dispEl) dispEl.textContent = `Rs ${amount.toLocaleString()}`;
            inputEl.value = '';
            // Reload from DB after 1.5s to show authoritative state
            setTimeout(loadAuctions, 1500);
        } else {
            msgEl.style.color = 'var(--accent-red)';
            msgEl.textContent  = '⚠️ ' + (data.error || 'Bid failed');
        }
    } catch {
        msgEl.style.color = 'var(--accent-red)';
        msgEl.textContent  = '⚠️ Connection failed';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT — only from facilities the user has actually booked
// ═══════════════════════════════════════════════════════════════════════════════
async function loadEquipment() {
    const grid = document.getElementById('equipmentGrid');
    try {
        const res  = await fetch(`${API}/api/features/user-equipment/${currentUser.userid}`);
        const data = await res.json();

        if (!data.success || !data.data.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🎾</div>
                    <p>No equipment linked to your bookings.<br>
                    Book a facility first — equipment from that venue will appear here.</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.data.map((eq, i) => {
            const avail = parseInt(eq.available_stock ?? eq.totalstock ?? 0);
            const color = avail > 5 ? 'var(--accent-green)' : avail > 0 ? 'var(--accent-gold)' : 'var(--accent-red)';
            return `
            <div class="facility-card stagger-${(i % 12) + 1}">
                <div class="facility-card-header" style="height:44px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(26,83,92,0.1))">
                    <span class="type-icon">🎾</span>
                </div>
                <div class="facility-card-body">
                    <div class="name" style="font-size:0.95rem">${eq.itemname}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:10px">${eq.facility_name || ''}</div>
                    <div class="facility-card-stats">
                        <div class="stat">
                            <span class="stat-label">Rate / hr</span>
                            <span class="stat-val" style="color:var(--accent-gold)">Rs ${parseFloat(eq.hourlyrate).toFixed(0)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Total</span>
                            <span class="stat-val">${eq.totalstock}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Free</span>
                            <span class="stat-val" style="color:${color}">${avail}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch {
        grid.innerHTML = '<div class="empty-state"><p>Failed to load equipment data</p></div>';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function loadNotifications() {
    const list = document.getElementById('notifList');
    try {
        const res  = await fetch(`${API}/api/features/user-status/${currentUser.userid}`);
        const data = await res.json();
        let html   = '';

        if (data.success) {
            const d = data.data;
            if (d.active_penalties > 0) {
                html += `
                    <div class="notif-item penalty stagger-1">
                        <div class="notif-dot"></div>
                        <div>
                            <div class="notif-text">⚠️ You have <strong>${d.active_penalties}</strong> active penalty notification(s).
                            Please resolve them to continue booking.</div>
                        </div>
                    </div>`;
            }
            html += `
                <div class="notif-item ${d.can_book ? 'unread' : ''} stagger-2">
                    <div class="notif-dot"></div>
                    <div>
                        <div class="notif-text">${d.can_book
                            ? '✅ Your account is in good standing. You are eligible to make new bookings.'
                            : '🚫 Your account is restricted from new bookings due to pending penalties.'}</div>
                    </div>
                </div>`;
        }

        list.innerHTML = html || '<div class="empty-state"><div class="icon">🔔</div><p>No notifications</p></div>';
    } catch {
        list.innerHTML = '<div class="empty-state"><p>Failed to load notifications</p></div>';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(t) {
    if (!t) return '—';
    // Handles "HH:MM" or "HH:MM:SS" strings from the DB
    const parts = String(t).split(':');
    const h     = parseInt(parts[0], 10);
    const m     = parts[1] || '00';
    const ampm  = h >= 12 ? 'PM' : 'AM';
    const h12   = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}
