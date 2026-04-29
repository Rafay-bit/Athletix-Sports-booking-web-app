import re

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Remove everything from "// --- API INTEGRATION ---" to the end
js = js.split('// --- API INTEGRATION ---')[0]

new_api_js = """
// --- API INTEGRATION ---
let currentUser = { userid: 1, username: 'admin', role: 'admin' };
let currentFacilitySlots = [];
let currentFacilityId = null;

async function initDashboard() {
  document.getElementById('sb-name').textContent = currentUser.username;
  document.getElementById('sb-role').textContent = currentUser.role;
  
  await fetchFacilities();
  await fetchMyBookings();
  await fetchLiveAuctions();
}

const API_BASE = ''; // Same origin

function getCategoryFromName(name) {
  let n = name.toLowerCase();
  if(n.includes('cricket')) return 'Cricket';
  if(n.includes('football')) return 'Football';
  if(n.includes('tennis')) return 'Tennis';
  if(n.includes('basketball')) return 'Basketball';
  if(n.includes('swimming')) return 'Swimming';
  if(n.includes('padel')) return 'Padel';
  return 'Sports';
}

function getPriceFromName(name) {
  let n = name.toLowerCase();
  if(n.includes('football')) return 2500;
  if(n.includes('cricket')) return 1200;
  if(n.includes('tennis')) return 900;
  if(n.includes('swimming')) return 3000;
  if(n.includes('padel')) return 800;
  return 1000;
}

function getIconForCategory(cat) {
  if(!cat) return '🏟️';
  cat = cat.toLowerCase();
  if(cat.includes('cricket')) return '🏏';
  if(cat.includes('football')) return '⚽';
  if(cat.includes('tennis')) return '🎾';
  if(cat.includes('basketball')) return '🏀';
  if(cat.includes('swimming')) return '🏊';
  if(cat.includes('padel')) return '🏸';
  return '🏟️';
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  let h = d.getUTCHours().toString().padStart(2, '0');
  let m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toDateString();
}

async function fetchFacilities() {
  try {
    const res = await fetch(`${API_BASE}/availability?date=2026-04-30`); // fetch slots
    if(!res.ok) throw new Error('Failed to fetch availability');
    const slots = await res.json();
    
    // Group slots by facility
    const uniqueFacilities = {};
    slots.forEach(s => {
      if(!uniqueFacilities[s.facilityid]) {
        uniqueFacilities[s.facilityid] = {
          id: s.facilityid,
          name: s.name || s.facility_name,
          category: getCategoryFromName(s.name || s.facility_name || ''),
          price: getPriceFromName(s.name || s.facility_name || ''),
          slots: []
        };
      }
      uniqueFacilities[s.facilityid].slots.push(s);
    });
    
    const grid = document.getElementById('facility-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    window.facilityData = uniqueFacilities; // store for modal
    
    Object.values(uniqueFacilities).forEach(f => {
      const isPremium = f.price > 1500;
      const html = `
        <div class="facility-card" onclick="openFacilityModal(${f.id}, '${f.name}', '${f.category}', ${isPremium}, 'Rs ${f.price}')">
          <div class="fc-image">${getIconForCategory(f.category)}
            ${isPremium ? '<span class="fc-premium-badge">Premium</span>' : ''}
          </div>
          <div class="fc-body">
            <div class="fc-title">${f.name}</div>
            <div class="fc-meta">
              <span class="fc-cat">${f.category}</span>
              <span class="fc-rating"><span>★★★★★</span> 4.8</span>
            </div>
            <div class="fc-info-row">
              <span class="fc-info-item">📍 Location</span>
            </div>
            <div class="fc-price">Rs ${f.price} <span>/ hr</span></div>
            <button class="btn-book ${isPremium ? 'btn-auction':''}" onclick="event.stopPropagation();openFacilityModal(${f.id}, '${f.name}', '${f.category}', ${isPremium}, 'Rs ${f.price}')">
              ${isPremium ? 'Start Auction' : 'Book Now'}
            </button>
          </div>
        </div>
      `;
      grid.innerHTML += html;
    });
  } catch(e) {
    console.error(e);
  }
}

window.openFacilityModal = function(id, name, cat, isAuction, price) {
  currentFacilityId = id;
  currentFacilitySlots = window.facilityData[id].slots;
  
  openModal(name, cat, isAuction, price);
  
  const slotGrid = document.getElementById('modal-slots');
  slotGrid.innerHTML = '';
  
  currentFacilitySlots.forEach(s => {
    const st = formatTime(s.starttime);
    const et = formatTime(s.endtime);
    slotGrid.innerHTML += `<button class="timeslot-btn" data-slotid="${s.slotid}" onclick="selectSlot(this)">${st} – ${et}</button>`;
  });
};

// Override confirmBooking
window.confirmBooking = async function() {
  const slot = document.querySelector('.timeslot-btn.selected');
  if(!slot){alert('Please select a timeslot.');return;}
  
  const slotid = slot.dataset.slotid;
  const targetDate = '2026-04-30'; // Hardcoded for demo to match availability date
  
  if(currentIsAuction){
    const bid = document.getElementById('modal-bid').value;
    if(!bid){alert('Please enter a starting bid.');return;}
    alert(`Auction started for ${currentFacility} at ${slot.textContent} with opening bid Rs ${bid}!`);
    closeModal();
  } else {
    // API Call to create booking
    try {
      const payload = {
        userid: currentUser.userid,
        facilityid: currentFacilityId,
        slotid: parseInt(slotid),
        bookingdate: targetDate,
        finalprice: getPriceFromName(currentFacility),
        status: 'pending'
      };
      
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if(res.ok) {
        alert(`Booking confirmed for ${currentFacility} at ${slot.textContent}!`);
        closeModal();
        fetchMyBookings(); // refresh table
      } else {
        const errorData = await res.json();
        alert('Booking failed: ' + (errorData.error || 'Unknown error'));
      }
    } catch(e) {
      console.error(e);
      alert('Error creating booking.');
    }
  }
};

async function fetchMyBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if(!res.ok) throw new Error('Failed to fetch bookings');
    const bookings = await res.json();
    
    // Filter for current user
    const myBookings = bookings.filter(b => b.userid === currentUser.userid || b.username === currentUser.username);
    
    const tbody = document.querySelector('#bookings-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    myBookings.forEach((b, i) => {
      const st = formatTime(b.starttime);
      const et = formatTime(b.endtime);
      const bd = formatDate(b.bookingdate);
      const badgeClass = b.status.toLowerCase() === 'confirmed' ? 'badge-confirmed' : b.status.toLowerCase() === 'cancelled' ? 'badge-cancelled' : 'badge-pending';
      
      const html = `
        <tr onclick="toggleSubRow('sub-${i}',this)" id="row-${b.bookingid}">
          <td><button class="expand-btn" id="exp-sub-${i}">▶</button></td>
          <td>#BK-${b.bookingid}</td>
          <td>${b.facility}</td>
          <td>${bd}</td>
          <td>${st} – ${et}</td>
          <td>Rs ${b.finalprice}</td>
          <td><span class="badge ${badgeClass}">${b.status.toUpperCase()}</span></td>
          <td>
            ${b.status.toLowerCase() !== 'cancelled' ? `<button class="btn-cancel" onclick="event.stopPropagation();cancelBookingAPI(${b.bookingid})">Cancel</button>` : '—'}
          </td>
        </tr>
        <tr class="sub-row" id="sub-${i}">
          <td colspan="8">No equipment attached.</td>
        </tr>
      `;
      tbody.innerHTML += html;
    });
  } catch(e) {
    console.error(e);
  }
}

window.cancelBookingAPI = async function(id) {
  if(!confirm(`Cancel booking #BK-${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`, { method: 'DELETE' });
    if(res.ok) {
      alert(`Booking #BK-${id} cancelled.`);
      fetchMyBookings(); // refresh
    } else {
      alert('Failed to cancel booking.');
    }
  } catch(e) {
    console.error(e);
  }
}

async function fetchLiveAuctions() {
  try {
    const res = await fetch(`${API_BASE}/active-auctions`);
    if(!res.ok) throw new Error('Failed to fetch auctions');
    const auctions = await res.json();
    
    const grid = document.getElementById('auction-grid');
    if(!grid) return;
    
    if(auctions.length === 0) {
      grid.innerHTML = '<p style="color:var(--gray);font-size:14px;padding:20px;">No live auctions at the moment.</p>';
      return;
    }
    
    grid.innerHTML = '';
    auctions.forEach(a => {
      // Msnodesql returns booking details if it is a view_active_auctions
      const name = a.facility || a.facility_name || 'Facility';
      const bid = a.current_highest_bid || a.startingbid || 0;
      
      const html = `
        <div class="auction-card">
          <div class="ac-title">${name}</div>
          <div class="ac-slot">📅 ${formatDate(a.bookingdate || a.auctiondate)}</div>
          <div class="ac-bid-row">
            <div>
              <div class="ac-bid-label">Current Bid</div>
              <div class="ac-bid-amt" id="bid-auction-${a.bookingid || a.auctionid}">Rs ${bid}</div>
            </div>
            <div>
              <div class="ac-timer-label">Status</div>
              <div class="ac-timer" id="timer-auction-${a.bookingid || a.auctionid}">${a.status || 'ACTIVE'}</div>
            </div>
          </div>
          <div class="ac-input-row">
            <input class="ac-input" id="bid-input-${a.bookingid || a.auctionid}" type="number" placeholder="Your bid (Rs)" />
            <button class="btn-bid" onclick="placeBid(${a.bookingid || a.auctionid},'bid-input-${a.bookingid || a.auctionid}','bid-auction-${a.bookingid || a.auctionid}')">Place Bid</button>
          </div>
        </div>
      `;
      grid.innerHTML += html;
    });
  } catch(e) {
    console.error(e);
  }
}

// Override goToDashboard
window.goToDashboard = function() {
  const email = document.getElementById('login-email').value;
  if(email) {
    currentUser.username = email.split('@')[0];
  }
  document.getElementById('landing-page').style.display='none';
  document.getElementById('dashboard-page').style.display='block';
  window.scrollTo(0,0);
  initDashboard();
};

// Also attach event listeners to re-fetch when chips are clicked to avoid stale undefined data
window.selectChip = function(el) {
  document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  fetchFacilities(); // re-fetch data for "new" date
};
"""

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(js + new_api_js)
