
// --- API INTEGRATION ---
let currentUser = { userid: 1, username: 'John Doe', role: 'member' };

async function initDashboard() {
  document.getElementById('sb-name').textContent = currentUser.username;
  document.getElementById('sb-role').textContent = currentUser.role;
  
  await fetchFacilities();
  await fetchMyBookings();
  await fetchLiveAuctions();
}

const API_BASE = ''; // Same origin

async function fetchFacilities() {
  try {
    const res = await fetch(`${API_BASE}/availability?date=2025-04-30`);
    if(!res.ok) throw new Error('Failed to fetch');
    const facilities = await res.json();
    
    const grid = document.getElementById('facility-grid');
    grid.innerHTML = '';
    
    facilities.forEach(f => {
      const isPremium = f.price_per_hour > 1500;
      const html = `
        <div class="facility-card" onclick="openModal('${f.name}','${f.category}',${isPremium},'Rs ${f.price_per_hour}')">
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
            <div class="fc-price">Rs ${f.price_per_hour} <span>/ hr</span></div>
            <button class="btn-book ${isPremium ? 'btn-auction':''}" onclick="event.stopPropagation();openModal('${f.name}','${f.category}',${isPremium},'Rs ${f.price_per_hour}')">
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

async function fetchMyBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if(!res.ok) throw new Error('Failed to fetch bookings');
    const bookings = await res.json();
    
    // Filter for current user for now
    const myBookings = bookings.filter(b => b.username === currentUser.username || b.userid === currentUser.userid || true); // Showing all for demo if needed, but lets restrict
    
    const tbody = document.querySelector('#bookings-table tbody');
    tbody.innerHTML = '';
    
    myBookings.forEach((b, i) => {
      const st = formatTime(b.starttime);
      const et = formatTime(b.endtime);
      const bd = formatDate(b.bookingdate);
      const badgeClass = b.status === 'confirmed' ? 'badge-confirmed' : b.status === 'cancelled' ? 'badge-cancelled' : 'badge-pending';
      
      const html = `
        <tr onclick="toggleSubRow('sub-${i}',this)" id="row-${b.bookingid}">
          <td><button class="expand-btn" id="exp-sub-${i}">▶</button></td>
          <td>#BK-${b.bookingid}</td>
          <td>${b.facility}</td>
          <td>${bd}</td>
          <td>${st} – ${et}</td>
          <td>Rs ${b.finalprice}</td>
          <td><span class="badge ${badgeClass}">${b.status}</span></td>
          <td>
            ${b.status !== 'cancelled' ? `<button class="btn-cancel" onclick="event.stopPropagation();cancelBookingAPI(${b.bookingid})">Cancel</button>` : '—'}
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

async function cancelBookingAPI(id) {
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
      const st = formatTime(a.starttime);
      const et = formatTime(a.endtime);
      const bd = formatDate(a.auctiondate);
      
      const html = `
        <div class="auction-card">
          <div class="ac-title">${a.facility_name}</div>
          <div class="ac-slot">📅 ${bd} · ${st} – ${et}</div>
          <div class="ac-bid-row">
            <div>
              <div class="ac-bid-label">Current Bid</div>
              <div class="ac-bid-amt" id="bid-auction-${a.auctionid}">Rs ${a.current_highest_bid || a.startingbid}</div>
            </div>
            <div>
              <div class="ac-timer-label">Status</div>
              <div class="ac-timer" id="timer-auction-${a.auctionid}">${a.status}</div>
            </div>
          </div>
          <div class="ac-input-row">
            <input class="ac-input" id="bid-input-${a.auctionid}" type="number" placeholder="Your bid (Rs)" />
            <button class="btn-bid" onclick="placeBid(${a.auctionid},'bid-input-${a.auctionid}','bid-auction-${a.auctionid}')">Place Bid</button>
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
