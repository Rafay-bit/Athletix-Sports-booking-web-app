// ── CURSOR
const cur = document.getElementById('cur');
const curR = document.getElementById('curR');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
(function tick(){
  cur.style.left=mx+'px';cur.style.top=my+'px';
  rx+=(mx-rx)*.13;ry+=(my-ry)*.13;
  curR.style.left=rx+'px';curR.style.top=ry+'px';
  requestAnimationFrame(tick);
})();
document.querySelectorAll('button,a,input,select').forEach(el=>{
  el.addEventListener('mouseenter',()=>{cur.style.width='5px';cur.style.height='5px';curR.style.width='54px';curR.style.height='54px';curR.style.opacity='.3';});
  el.addEventListener('mouseleave',()=>{cur.style.width='10px';cur.style.height='10px';curR.style.width='36px';curR.style.height='36px';curR.style.opacity='.45';});
});

// ── HERO BG animate on load
const heroBg = document.getElementById('heroBg');
window.addEventListener('load',()=>heroBg.classList.add('loaded'));

// ── SCROLL fade-in
const obs = new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:.12});
document.querySelectorAll('.su').forEach(el=>obs.observe(el));

// ── NAVIGATION
function scrollToLogin(){ document.getElementById('loginSection').scrollIntoView({behavior:'smooth'}); }

function goToLanding(){
  document.getElementById('dashboard-page').style.display='none';
  document.getElementById('landing-page').style.display='block';
  window.scrollTo(0,0);
}

// ── SIDEBAR NAV
const sectionMeta = {
  'facilities':    {title:'Facilities',    sub:'Browse & Book Premium Venues'},
  'my-bookings':   {title:'My Bookings',   sub:'Track Your Reservations'},
  'auctions':      {title:'Live Auctions', sub:'Bid on Premium Facilities'},
  'equipment':     {title:'Equipment',     sub:'Gear Rentals'},
  'notifications': {title:'Notifications', sub:'Alerts & Updates'},
  'admin':         {title:'Admin Panel',   sub:'System Overview & Management'},
};
function switchSection(target){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.sb-nav-item').forEach(b=>b.classList.remove('active'));
  const sec = document.getElementById('section-'+target);
  if(sec) sec.classList.add('active');
  document.querySelectorAll('.sb-nav-item').forEach(b=>{ if(b.dataset.target===target) b.classList.add('active'); });
  const meta = sectionMeta[target]||{title:target,sub:''};
  document.getElementById('section-title').textContent = meta.title;
  document.getElementById('section-sub').textContent = meta.sub;
  // Refresh data when switching to specific tabs
  if(target === 'notifications') fetchNotifications(true);
  if(target === 'admin')         fetchAdminDashboard();
}
document.querySelectorAll('.sb-nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>switchSection(btn.dataset.target));
});

// ── MODAL
let currentFacility='', currentIsAuction=false, currentFacilityId=null, currentFacilitySlots=[];
function openModal(name,cat,isAuction,price){
  currentFacility=name; currentIsAuction=isAuction;
  document.getElementById('modal-title').textContent = name;
  document.getElementById('bid-group').style.display = isAuction?'block':'none';
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(){
  document.getElementById('modal-overlay').classList.remove('open');
  document.querySelectorAll('.timeslot-btn').forEach(b=>b.classList.remove('selected'));
}
function selectSlot(btn){
  document.querySelectorAll('.timeslot-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}
document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ── SUB ROWS — fetch equipment rentals when expanding
const loadedRentals = new Set(); // cache so we don't re-fetch
function toggleSubRow(id) {
  const sub = document.getElementById(id);
  const btn = document.getElementById('exp-' + id);
  const open = sub.classList.toggle('open');
  if(btn) btn.classList.toggle('open', open);

  // Load equipment rentals when first opened
  // id format: 'sub-{rowIndex}', the booking row has id 'row-{bookingid}'
  // We embed bookingid as data attr on the sub row
  if(open && sub.dataset.bookingid && !loadedRentals.has(sub.dataset.bookingid)) {
    loadedRentals.add(sub.dataset.bookingid);
    const td = sub.querySelector('td');
    if(td) td.innerHTML = '<span style="color:var(--gray);font-size:12px;">Loading equipment...</span>';
    fetch(`/booking-rentals/${sub.dataset.bookingid}`)
      .then(r => r.json())
      .then(rentals => {
        if(!td) return;
        if(rentals.length === 0) {
          td.innerHTML = '<span style="color:var(--gray);font-size:12px;">No equipment rented for this booking.</span>';
          return;
        }
        let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
          '<tr style="color:var(--green);letter-spacing:1px;"><th style="text-align:left;padding:4px 8px;">Equipment</th><th style="text-align:right;padding:4px 8px;">Qty</th><th style="text-align:right;padding:4px 8px;">Rate/hr</th><th style="text-align:right;padding:4px 8px;">Subtotal</th></tr>';
        rentals.forEach(r => {
          html += `<tr style="color:rgba(240,244,255,0.65);">
            <td style="padding:4px 8px;">${r.equipment_name}</td>
            <td style="text-align:right;padding:4px 8px;">${r.quantity}</td>
            <td style="text-align:right;padding:4px 8px;">Rs ${Number(r.rate).toLocaleString()}</td>
            <td style="text-align:right;padding:4px 8px;">Rs ${Number(r.subtotal).toLocaleString()}</td>
          </tr>`;
        });
        html += '</table>';
        td.innerHTML = html;
      })
      .catch(() => { if(td) td.innerHTML = '<span style="color:var(--gray);font-size:12px;">Could not load equipment data.</span>'; });
  }
}

// ── EQUIPMENT — mapping names to DB itemids
const ITEM_MAP = {
  'Cricket Bat': 1, 'Football': 2, 'Tennis Racket': 3, 
  'Basketball': 6, 'Boxing Gloves': 7, 'Swim Gear': 5
};

window.rentEquipment = async function(name, selectId, qtyId) {
  const bookingid = document.getElementById(selectId).value;
  const qty = parseInt(document.getElementById(qtyId).value);
  const itemid = ITEM_MAP[name] || 1;

  if(!bookingid) { alert('Please select an active booking first.'); return; }
  if(!qty || qty < 1) { alert('Please enter a valid quantity.'); return; }

  try {
    const res = await fetch('/equipment-rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingid, itemid, qty })
    });
    const data = await res.json();
    if(res.ok) {
      alert(`✅ ${name} ×${qty} added to booking #BK-${bookingid}!`);
      // Refresh my bookings to show the new equipment in sub-rows
      fetchMyBookings();
    } else {
      alert('Failed to rent equipment: ' + (data.error || 'Unknown error'));
    }
  } catch(e) {
    console.error(e);
    alert('Error connecting to server.');
  }
};

// ══════════════════════════════════════════════════
//  STATE & HELPERS
// ══════════════════════════════════════════════════
let currentUser = null;
const API_BASE = '';
let activeIntervals = [];

function formatTime(timeStr) {
  if (!timeStr) return '--:--';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  return d.getUTCHours().toString().padStart(2,'0') + ':' + d.getUTCMinutes().toString().padStart(2,'0');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

function getIconForCategory(cat) {
  if(!cat) return '🏟️';
  const c = cat.toLowerCase();
  if(c.includes('cricket'))    return '🏏';
  if(c.includes('football'))   return '⚽';
  if(c.includes('tennis'))     return '🎾';
  if(c.includes('basketball')) return '🏀';
  if(c.includes('swimming'))   return '🏊';
  if(c.includes('padel'))      return '🏸';
  return '🏟️';
}

function getCategoryFromName(name) {
  const n = name.toLowerCase();
  if(n.includes('cricket'))    return 'Cricket';
  if(n.includes('football') || n.includes('futsal')) return 'Football';
  if(n.includes('tennis'))     return 'Tennis';
  if(n.includes('basketball')) return 'Basketball';
  if(n.includes('swimming'))   return 'Swimming';
  if(n.includes('padel'))      return 'Padel';
  return 'Sports';
}

// ══════════════════════════════════════════════════
//  LOGIN — checks email + password "1234" vs DB
// ══════════════════════════════════════════════════
window.goToDashboard = async function() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if(!email)    { alert('Please enter your email.');    return; }
  if(!password) { alert('Please enter your password.'); return; }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if(res.ok) {
      currentUser = await res.json();
      document.getElementById('landing-page').style.display = 'none';
      document.getElementById('dashboard-page').style.display = 'block';
      window.scrollTo(0,0);
      initDashboard();
    } else {
      const err = await res.json();
      alert('Login failed: ' + err.error);
    }
  } catch(e) {
    console.error(e);
    alert('Cannot connect to server.');
  }
};

// ── DASHBOARD INIT
async function initDashboard() {
  document.getElementById('sb-name').textContent  = currentUser.fullname || currentUser.username;
  document.getElementById('sb-role').textContent  = currentUser.role;
  const initials = (currentUser.fullname || currentUser.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sb-avatar').textContent = initials;

  // Show Membership Tier
  let mbEl = document.getElementById('sb-membership');
  if(!mbEl) {
    const profileText = document.querySelector('.sb-profile > div:last-child');
    if(profileText) {
      mbEl = document.createElement('div');
      mbEl.id = 'sb-membership';
      mbEl.className = 'sb-membership-badge';
      profileText.appendChild(mbEl);
    }
  }
  if(mbEl) {
    if(currentUser.tiername) {
      mbEl.textContent = `${currentUser.tiername} Member`;
      mbEl.style.display = 'inline-block';
    } else {
      mbEl.style.display = 'none';
    }
  }

  // Admin Handling
  if(currentUser.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    switchSection('admin');
    await fetchAdminDashboard();
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    switchSection('facilities');
    await fetchFacilities();
    await fetchMyBookings();
    await fetchLiveAuctions();
    await fetchNotifications(false);
  }
}

// ══════════════════════════════════════════════════
//  FACILITIES — regular + auctionable (Hot)
// ══════════════════════════════════════════════════
async function fetchFacilities() {
  try {
    // Fetch all facilities from DB (with is_auctionable)
    const [facilRes, slotRes] = await Promise.all([
      fetch(`${API_BASE}/facilities`),
      fetch(`${API_BASE}/availability?date=2026-04-30`)
    ]);
    const facilities = facilRes.ok ? await facilRes.json() : [];
    const slots      = slotRes.ok  ? await slotRes.json()  : [];
    window.allFacilities = facilities; // Store for filtering

    // Build slot map by facilityid
    const slotMap = {};
    slots.forEach(s => {
      if(!slotMap[s.facilityid]) slotMap[s.facilityid] = [];
      slotMap[s.facilityid].push(s);
    });

    window.facilityData = {};
    facilities.forEach(f => {
      window.facilityData[f.facilityid] = {
        ...f,
        category: getCategoryFromName(f.name),
        slots: slotMap[f.facilityid] || []
      };
    });

    // Regular facilities (not auctionable)
    const grid = document.getElementById('facility-grid');
    if(grid) {
      grid.innerHTML = '';
      facilities.filter(f => !f.is_auctionable).forEach(f => {
        grid.innerHTML += buildFacilityCard(f);
      });
    }

    // Hot/Auctionable facilities — look for a separate hot-grid or inject into facilities section
    let hotGrid = document.getElementById('hot-facilities-grid');
    if(!hotGrid) {
      // Create a "Hot Facilities" sub-section above the main grid
      const section = document.getElementById('section-facilities');
      if(section) {
        const hotSection = document.createElement('div');
        hotSection.style.cssText = 'margin-bottom:32px;';
        hotSection.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <span style="font-size:20px;">🔥</span>
            <div>
              <div style="font-family:'Russo One',sans-serif;font-size:14px;letter-spacing:2px;text-transform:uppercase;">Hot Facilities</div>
              <div style="font-size:11px;color:var(--gray);letter-spacing:1px;">Premium auction-only slots — bid to win</div>
            </div>
          </div>
          <div class="facility-grid" id="hot-facilities-grid"></div>
          <div style="border-bottom:1px solid var(--border);margin:28px 0 20px;"></div>
          <div style="font-family:'Russo One',sans-serif;font-size:14px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">All Facilities</div>
        `;
        section.insertBefore(hotSection, section.querySelector('.filter-bar').nextSibling);
        hotGrid = document.getElementById('hot-facilities-grid');
      }
    }
    if(hotGrid) {
      hotGrid.innerHTML = '';
      facilities.filter(f => f.is_auctionable).forEach(f => {
        hotGrid.innerHTML += buildFacilityCard(f);
      });
    }

    // Attach Filter Listeners once
    const sInp = document.getElementById('facility-search');
    const cSel = document.getElementById('facility-category');
    if(sInp && !sInp.oninput) {
      sInp.oninput = applyFilters;
      cSel.onchange = applyFilters;
    }

  } catch(e) { console.error('fetchFacilities:', e); }
}

function applyFilters() {
  const searchTerm = document.getElementById('facility-search').value.toLowerCase();
  const category = document.getElementById('facility-category').value.toLowerCase();
  
  const filtered = window.allFacilities.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm);
    const fCat = getCategoryFromName(f.name).toLowerCase();
    const matchesCat = !category || fCat === category;
    return matchesSearch && matchesCat;
  });

  const grid = document.getElementById('facility-grid');
  const hotGrid = document.getElementById('hot-facilities-grid');

  if(grid) {
    grid.innerHTML = filtered.filter(f => !f.is_auctionable).map(f => buildFacilityCard(f)).join('');
  }
  if(hotGrid) {
    hotGrid.innerHTML = filtered.filter(f => f.is_auctionable).map(f => buildFacilityCard(f)).join('');
  }
}

function buildFacilityCard(f) {
  const cat = getCategoryFromName(f.name);
  const basePrice = Number(f.base_price || 1000);
  const isHot = f.is_auctionable;
  const safeEsc = name => name.replace(/'/g, "\\'");

  let priceHTML = `Rs ${basePrice.toLocaleString()}`;
  let finalPrice = basePrice;

  // Apply visual discount if logged in
  if(currentUser && currentUser.discountpct > 0) {
    finalPrice = basePrice * (1 - (currentUser.discountpct / 100));
    priceHTML = `
      <span style="text-decoration:line-through; font-size:12px; color:var(--gray); margin-right:8px;">Rs ${basePrice.toLocaleString()}</span>
      <span style="color:var(--green);">Rs ${finalPrice.toLocaleString()}</span>
    `;
  }

  const priceStr = `Rs ${finalPrice.toLocaleString()}`;

  return `
    <div class="facility-card" onclick="openFacilityModal(${f.facilityid},'${safeEsc(f.name)}','${cat}',${isHot},'${priceStr}')">
      <div class="fc-image">${getIconForCategory(cat)}
        ${isHot ? '<span class="fc-premium-badge">🔥 Hot</span>' : ''}
      </div>
      <div class="fc-body">
        <div class="fc-title">${f.name}</div>
        <div class="fc-meta">
          <span class="fc-cat">${cat}</span>
          <span class="fc-rating"><span>★★★★★</span> 4.8</span>
        </div>
        <div class="fc-info-row">
          <span class="fc-info-item">👥 Cap: ${f.capacity}</span>
        </div>
        <div class="fc-price">${priceHTML} <span>/ hr</span></div>
        <button class="btn-book ${isHot ? 'btn-auction':''}" onclick="event.stopPropagation();openFacilityModal(${f.facilityid},'${safeEsc(f.name)}','${cat}',${isHot},'${priceStr}')">
          ${isHot ? '🔥 Bid Now' : 'Book Now'}
        </button>
      </div>
    </div>`;
}

window.openFacilityModal = function(id, name, cat, isAuction, price) {
  currentFacilityId = id;
  currentFacilitySlots = (window.facilityData[id] && window.facilityData[id].slots) || [];
  openModal(name, cat, isAuction, price);
  const slotGrid = document.getElementById('modal-slots');
  slotGrid.innerHTML = '';
  if(currentFacilitySlots.length === 0) {
    slotGrid.innerHTML = '<p style="color:var(--gray);font-size:12px;grid-column:1/-1;">No available slots for selected date.</p>';
    return;
  }
  currentFacilitySlots.forEach(s => {
    const st = formatTime(s.starttime);
    const et = formatTime(s.endtime);
    slotGrid.innerHTML += `<button class="timeslot-btn" data-slotid="${s.slotid}" onclick="selectSlot(this)">${st} – ${et}</button>`;
  });
};

window.confirmBooking = async function() {
  const slot = document.querySelector('.timeslot-btn.selected');
  if(!slot){ alert('Please select a timeslot.'); return; }

  const slotid = parseInt(slot.dataset.slotid);
  // Use tomorrow's date so the slot is future-dated
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const bookingdate = tmr.toISOString().split('T')[0];

  // ── AUCTION BOOKING (Hot Facility)
  if(currentIsAuction) {
    const bidInput = document.getElementById('modal-bid');
    const bid = bidInput ? parseInt(bidInput.value) : 0;
    if(!bid || bid <= 0)    { alert('Please enter a starting bid.');                         return; }
    if(bid % 500 !== 0)     { alert('Starting bid must be a multiple of 500 (e.g. 500, 1000, 1500).'); return; }

    try {
      const payload = {
        userid:      currentUser.userid,
        facilityid:  currentFacilityId,
        slotid,
        bookingdate,
        startingbid: bid
      };
      const res = await fetch(`${API_BASE}/auction-booking`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      if(res.ok) {
        const data = await res.json();
        alert(`🔥 Auction started for ${currentFacility}!\nBooking #BK-${data.bookingid} is now LIVE with opening bid Rs ${bid.toLocaleString()}.\nCheck “Live Auctions” to see others bid!`);
        closeModal();
        await fetchMyBookings();
        await fetchLiveAuctions();
      } else {
        const err = await res.json();
        alert('Failed to start auction: ' + (err.error || 'Unknown error'));
      }
    } catch(e) {
      console.error(e);
      alert('Error connecting to server.');
    }
    return;
  }

  // ── REGULAR BOOKING
  try {
    let price = window.facilityData[currentFacilityId]?.base_price || 1000;
    
    // Apply Membership Discount if applicable
    if(currentUser.membershipid) {
      try {
        const dres = await fetch(`${API_BASE}/discounted-price?userid=${currentUser.userid}&baseprice=${price}`);
        if(dres.ok) {
          const ddata = await dres.json();
          if(ddata.final_price) {
            price = Number(ddata.final_price);
            console.log(`Membership applied! New price: Rs ${price}`);
          }
        }
      } catch(de) { console.error('Discount calculation failed:', de); }
    }

    const payload = {
      userid:      currentUser.userid,
      facilityid:  currentFacilityId,
      slotid,
      bookingdate,
      finalprice:  price,
      status:      'pending'
    };
    const res = await fetch(`${API_BASE}/bookings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    if(res.ok) {
      const data = await res.json();
      alert(`✅ Booking #BK-${data.bookingid} confirmed for ${currentFacility} at ${slot.textContent}!\nFinal Price (after discount): Rs ${price.toLocaleString()}`);
      closeModal();
      fetchMyBookings();
    } else {
      const err = await res.json();
      alert('Booking failed: ' + (err.error || 'Unknown error'));
    }
  } catch(e) {
    console.error(e);
    alert('Error creating booking.');
  }
};

// ══════════════════════════════════════════════════
//  MY BOOKINGS — uses /my-bookings/:userid (no cancelled)
// ══════════════════════════════════════════════════
async function fetchMyBookings() {
  try {
    const res = await fetch(`${API_BASE}/my-bookings/${currentUser.userid}`);
    if(!res.ok) throw new Error('Failed');
    const mine = await res.json();

    const tbody = document.querySelector('#bookings-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    loadedRentals.clear(); // reset so equipment re-loads fresh on next expand

    if(mine.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:24px;">No active bookings.</td></tr>`;
      updateEquipmentSection([]);
      return;
    }

    mine.forEach((b, i) => {
      const st = formatTime(b.starttime);
      const et = formatTime(b.endtime);
      const bd = formatDate(b.bookingdate);
      const isAuction = b.status.toLowerCase() === 'open_bid';
      const isConfirmed = b.status.toLowerCase() === 'confirmed';

      let badgeClass, badgeText;
      if(isAuction)   { badgeClass = 'badge-auction';   badgeText = '🔥 LIVE AUCTION'; }
      else if(isConfirmed) { badgeClass = 'badge-confirmed'; badgeText = 'CONFIRMED'; }
      else            { badgeClass = 'badge-pending';   badgeText = 'PENDING'; }

      const actionCell = isAuction
        ? `<button class="btn-bid" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();switchSection('auctions')">View Auction</button>`
        : `<button class="btn-cancel" onclick="event.stopPropagation();cancelBookingAPI(${b.bookingid})">Cancel</button>`;

      const priceDisplay = isAuction
        ? `Rs ${Number(b.highest_bid || b.finalprice).toLocaleString()} <span style="font-size:10px;color:var(--accent-blue);">(current bid)</span>`
        : `Rs ${b.finalprice}`;

      tbody.innerHTML += `
        <tr onclick="toggleSubRow('sub-${i}')" id="row-${b.bookingid}">
          <td><button class="expand-btn" id="exp-sub-${i}">▶</button></td>
          <td>#BK-${b.bookingid}</td>
          <td>${b.facility}</td>
          <td>${bd}</td>
          <td>${st} – ${et}</td>
          <td>${priceDisplay}</td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>${actionCell}</td>
        </tr>
        <tr class="sub-row" id="sub-${i}" data-bookingid="${b.bookingid}">
          <td colspan="8"><span style="color:var(--gray);font-size:12px;">Click ▶ to load equipment rentals...</span></td>
        </tr>`;
    });


    updateEquipmentSection(mine);
  } catch(e) { console.error('fetchMyBookings:', e); }
}

window.cancelBookingAPI = async function(id) {
  if(!confirm(`Cancel booking #BK-${id}? This cannot be undone.`)) return;
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`, { method: 'DELETE' });
    if(res.ok) { fetchMyBookings(); }
    else       { alert('Failed to cancel booking.'); }
  } catch(e) { console.error(e); }
};

// ── EQUIPMENT — only populate dropdowns when user has active bookings
function updateEquipmentSection(activeBookings) {
  const equipSection = document.getElementById('section-equipment');
  if(!equipSection) return;

  const noBookingMsg = equipSection.querySelector('#equip-no-booking-msg');
  const equipGrid    = document.getElementById('equipment-grid');

  if(activeBookings.length === 0) {
    if(equipGrid) equipGrid.style.display = 'none';
    if(!noBookingMsg) {
      const msg = document.createElement('div');
      msg.id = 'equip-no-booking-msg';
      msg.style.cssText = 'color:var(--gray);font-size:14px;padding:32px;text-align:center;';
      msg.innerHTML = '⚠️ You need an active booking to rent equipment.<br><br><button class="btn-book" onclick="switchSection(\'facilities\')">Browse Facilities</button>';
      if(equipSection) equipSection.appendChild(msg);
    }
    return;
  }

  // Has bookings — show grid and populate dropdowns
  if(equipGrid) equipGrid.style.display = '';
  const existing = document.getElementById('equip-no-booking-msg');
  if(existing) existing.remove();

  // Update all booking dropdowns
  document.querySelectorAll('.ec-select').forEach(sel => {
    // Keep first placeholder option
    sel.innerHTML = '<option value="">Select Active Booking</option>';
    activeBookings.forEach(b => {
      sel.innerHTML += `<option value="${b.bookingid}">#BK-${b.bookingid} — ${b.facility}</option>`;
    });
  });
}

async function finalizeAuction(bookingid) {
  try {
    const res = await fetch(`${API_BASE}/auction-finalize/${bookingid}`, { method: 'POST' });
    if(res.ok) {
      console.log(`Auction #BK-${bookingid} finalized.`);
      // Refresh both sections so it moves from Auctions -> My Bookings
      await fetchLiveAuctions();
      await fetchMyBookings();
    }
  } catch(e) { console.error('finalizeAuction:', e); }
}

// ══════════════════════════════════════════════════
//  LIVE AUCTIONS
// ══════════════════════════════════════════════════
async function fetchLiveAuctions() {
  try {
    const res = await fetch(`${API_BASE}/auctions-extended`);
    if(!res.ok) throw new Error('Failed');
    const auctions = await res.json();

    const grid = document.getElementById('auction-grid');
    if(!grid) return;

    // Clear old countdown intervals
    activeIntervals.forEach(clearInterval);
    activeIntervals = [];

    if(auctions.length === 0) {
      grid.innerHTML = '<p style="color:var(--gray);font-size:14px;padding:20px;">No live auctions at the moment.</p>';
      return;
    }

    // Build all HTML first
    let html = '';
    auctions.forEach(a => {
      const name    = a.facility || 'Facility';
      const bid     = Number(a.current_highest_bid) || 0;
      const minNext = bid + 500;

      const bd    = new Date(a.bookingdate);
      const stUTC = new Date(a.starttime);
      let closeTime = new Date(Date.UTC(
        bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate(),
        stUTC.getUTCHours(), stUTC.getUTCMinutes()
      ) - 6 * 60 * 60 * 1000);

      // Handle invalid dates or old test data
      const now = new Date();
      if(isNaN(closeTime.getTime()) || closeTime <= now) {
        closeTime = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1h demo fallback
      }

      const slotLabel = `${formatDate(a.bookingdate)} · ${formatTime(a.starttime)} – ${formatTime(a.endtime)}`;
      const topBidder = a.top_bidder_username
        ? `🏆 <b>${a.top_bidder_username}</b> — Rs ${bid.toLocaleString()}`
        : 'No bids yet';

      html += `
        <div class="auction-card" id="auc-card-${a.bookingid}">
          <div class="ac-title">${name}</div>
          <div class="ac-slot">📅 ${slotLabel}</div>
          <div class="ac-bid-row">
            <div>
              <div class="ac-bid-label">Current Bid</div>
              <div class="ac-bid-amt" id="bid-disp-${a.bookingid}">Rs ${bid.toLocaleString()}</div>
            </div>
            <div>
              <div class="ac-timer-label">Closes In</div>
              <div class="ac-timer" id="tmr-${a.bookingid}">--:--:--</div>
            </div>
          </div>
          <div class="ac-leader" id="leader-${a.bookingid}">Leader: ${topBidder}</div>
          <div style="font-size:10px;color:var(--gray);margin-bottom:8px;letter-spacing:1px;">Min next bid: Rs ${minNext.toLocaleString()}</div>
          <div class="ac-input-row" id="bid-controls-${a.bookingid}">
            <input class="ac-input" id="bid-inp-${a.bookingid}" type="number" step="500" min="${minNext}" placeholder="Rs ${minNext}" />
            <button class="btn-bid" onclick="placeBidAPI(${a.bookingid},'bid-inp-${a.bookingid}','bid-disp-${a.bookingid}','leader-${a.bookingid}')">Place Bid</button>
          </div>
        </div>`;
      
      // Store closeTime on the auction object for the next loop
      a.computedCloseTime = closeTime;
    });
    grid.innerHTML = html;

    // Start timers for each
    auctions.forEach(a => {
      const timerEl = document.getElementById(`tmr-${a.bookingid}`);
      if(!timerEl) return;

      const tick = setInterval(() => {
        const diff = a.computedCloseTime - new Date();
        if(diff <= 0) {
          timerEl.style.color = '#FF4040';
          timerEl.textContent = 'CLOSED';
          const ctrl = document.getElementById(`bid-controls-${a.bookingid}`);
          if(ctrl) ctrl.style.display = 'none';
          clearInterval(tick);
          finalizeAuction(a.bookingid);
          return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerEl.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      }, 1000);
      activeIntervals.push(tick);
    });
  } catch(e) { console.error('fetchLiveAuctions:', e); }
}

window.placeBidAPI = async function(bookingid, inputId, displayId, leaderId) {
  const input = document.getElementById(inputId);
  const val   = parseInt(input.value);
  if(!val || val <= 0)  { alert('Enter a valid bid amount.');                                   return; }
  if(val % 500 !== 0)   { alert('Bid must be a multiple of 500 (e.g. 1000, 1500, 2000, \u2026).'); return; }

  try {
    const res = await fetch(`${API_BASE}/bids`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ bookingid, userid: currentUser.userid, bidamount: val })
    });
    const data = await res.json();
    if(res.ok) {
      const newBid = Number(data.newHighestBid || val);
      // Update bid display
      const dispEl = document.getElementById(displayId);
      if(dispEl) dispEl.textContent = 'Rs ' + newBid.toLocaleString();
      // Update input min/placeholder for next bid
      const inpEl = document.getElementById(inputId);
      if(inpEl) { inpEl.value = ''; inpEl.min = newBid + 500; inpEl.placeholder = `Rs ${(newBid + 500).toLocaleString()}`; }
      // Update leader display immediately with current user's name
      const leaderEl = document.getElementById(leaderId);
      if(leaderEl) {
        const uname = currentUser.fullname || currentUser.username;
        leaderEl.innerHTML = `\ud83c\udfc6 Leader: \u2764\ufe0f <b>${uname}</b> \u2014 Rs ${newBid.toLocaleString()}`;
      }
      alert(`\u2705 Bid of Rs ${val.toLocaleString()} placed! You are now the top bidder.`);
    } else {
      alert('Bid failed: ' + (data.error || 'Unknown error'));
    }
  } catch(e) {
    console.error('placeBidAPI:', e);
    alert('Error connecting to server.');
  }
};

// ══════════════════════════════════════════════════
//  NOTIFICATIONS — fetch from DB, badge + list
// ══════════════════════════════════════════════════
async function fetchNotifications(markRead = false) {
  try {
    const res = await fetch(`${API_BASE}/notifications/${currentUser.userid}`);
    if(!res.ok) return;
    const notifs = await res.json();

    const unread     = notifs.filter(n => !n.isread);
    const countBadge = document.getElementById('notif-count');

    // Bell badge
    if(countBadge) {
      if(unread.length > 0) {
        countBadge.textContent     = unread.length;
        countBadge.style.display   = 'inline-block';
      } else {
        countBadge.style.display   = 'none';
      }
    }

    // Populate list
    const notifList = document.getElementById('notif-list');
    if(notifList) {
      if(notifs.length === 0) {
        notifList.innerHTML = '<p style="color:var(--gray);font-size:14px;padding:24px;">No notifications yet.</p>';
      } else {
        notifList.innerHTML = '';
        notifs.forEach(n => {
          const created = new Date(n.createdat);
          const timeStr = created.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
          const icon = n.message.includes('outbid') ? '⚡' : n.message.includes('confirmed') ? '✅' : '🔔';
          notifList.innerHTML += `
            <div class="notif-item ${!n.isread ? 'unread' : ''}">
              <div class="notif-icon">${icon}</div>
              <div class="notif-text">
                <h4>${!n.isread ? 'New Alert' : 'Alert'}</h4>
                <p>${n.message}</p>
              </div>
              <div class="notif-time">${timeStr}</div>
            </div>`;
        });
      }
    }

    // Mark all as read if requested (user opened notifications tab)
    if(markRead && unread.length > 0) {
      await fetch(`${API_BASE}/notifications/${currentUser.userid}/read`, { method: 'PUT' });
      if(countBadge) countBadge.style.display = 'none';
    }
  } catch(e) { console.error('fetchNotifications:', e); }
}

// ── DATE CHIP
window.selectChip = function(el) {
  document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
};
// ══════════════════════════════════════════════════
//  ADMIN PANEL LOGIC
// ══════════════════════════════════════════════════
async function fetchAdminDashboard() {
  try {
    const [statsRes, bookingsRes, facilRes] = await Promise.all([
      fetch(`${API_BASE}/admin/stats`),
      fetch(`${API_BASE}/admin/bookings`),
      fetch(`${API_BASE}/facilities`)
    ]);

    if(statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById('stat-users').textContent    = stats.total_users;
      document.getElementById('stat-bookings').textContent = stats.total_bookings;
      document.getElementById('stat-equip').textContent    = stats.total_equipment;
      document.getElementById('stat-rev').textContent      = 'Rs ' + Number(stats.total_revenue).toLocaleString();
    }

    if(bookingsRes.ok) {
      const bookings = await bookingsRes.json();
      const tbody = document.querySelector('#admin-bookings-table tbody');
      if(tbody) {
        tbody.innerHTML = bookings.map(b => `
          <tr>
            <td>#BK-${b.bookingid}</td>
            <td>${b.fullname}</td>
            <td>${b.facility}</td>
            <td>${formatDate(b.bookingdate)} · ${formatTime(b.starttime)}</td>
            <td>Rs ${Number(b.finalprice).toLocaleString()}</td>
            <td><span class="badge badge-${b.status.toLowerCase()}">${b.status.toUpperCase()}</span></td>
          </tr>
        `).join('');
      }
    }

    if(facilRes.ok) {
      const facilities = await facilRes.json();
      const list = document.getElementById('admin-facility-list');
      if(list) {
        list.innerHTML = facilities.map(f => `
          <div class="admin-fac-row">
            <div class="af-name">${f.name} ${f.is_auctionable ? '🔥' : ''}</div>
            <div class="af-controls">
              <input type="number" class="af-input" id="price-inp-${f.facilityid}" value="${f.base_price}" />
              <button class="btn-save-mini" onclick="updateFacilityPrice(${f.facilityid})">Save</button>
              <button class="btn-cancel" onclick="deleteFacility(${f.facilityid})" style="padding:4px 8px; font-size:9px;">Del</button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch(e) { console.error('fetchAdminDashboard:', e); }
}

window.updateFacilityPrice = async function(id) {
  const price = document.getElementById(`price-inp-${id}`).value;
  if(!price || price <= 0) { alert('Invalid price'); return; }
  try {
    const res = await fetch(`${API_BASE}/facilities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_price: Number(price) })
    });
    if(res.ok) {
      alert('Price updated! This will reflect for all users.');
      fetchAdminDashboard();
    } else { alert('Update failed'); }
  } catch(e) { console.error(e); }
};

window.addFacility = async function() {
  const name = document.getElementById('new-fac-name').value;
  const price = document.getElementById('new-fac-price').value;
  const capacity = document.getElementById('new-fac-cap').value;
  const isAuction = document.getElementById('new-fac-auction').checked;

  if(!name || !price) { alert('Please fill in Name and Price'); return; }

  try {
    const res = await fetch(`${API_BASE}/facilities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        base_price: Number(price),
        capacity: Number(capacity) || 20,
        is_auctionable: isAuction
      })
    });
    if(res.ok) {
      alert('Facility created successfully!');
      document.getElementById('new-fac-name').value = '';
      document.getElementById('new-fac-price').value = '';
      document.getElementById('new-fac-cap').value = '';
      document.getElementById('new-fac-auction').checked = false;
      fetchAdminDashboard();
    } else { alert('Failed to create facility'); }
  } catch(e) { console.error(e); }
};

window.deleteFacility = async function(id) {
  if(!confirm('Are you sure you want to delete this facility? This may break existing bookings.')) return;
  try {
    const res = await fetch(`${API_BASE}/facilities/${id}`, { method: 'DELETE' });
    if(res.ok) {
      alert('Facility deleted');
      fetchAdminDashboard();
    } else { alert('Delete failed'); }
  } catch(e) { console.error(e); }
};
