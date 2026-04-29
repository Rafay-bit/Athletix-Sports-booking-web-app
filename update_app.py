import re

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Replace the section from "async function fetchLiveAuctions()" down to "window.goToDashboard"
# with the new logic.

js = js.split('async function fetchLiveAuctions()')[0]

new_js = """
// ── NOTIFICATIONS
async function fetchNotifications() {
  try {
    const res = await fetch(`${API_BASE}/notifications/${currentUser.userid}`);
    if (!res.ok) return;
    const notifs = await res.json();
    
    const countBadge = document.getElementById('notif-count');
    const notifList = document.getElementById('notif-list');
    
    if (notifs.length > 0) {
      countBadge.textContent = notifs.length;
      countBadge.style.display = 'inline-block';
    } else {
      countBadge.style.display = 'none';
      if(notifList) notifList.innerHTML = '<p style="color:var(--gray);font-size:14px;padding:20px;">No notifications.</p>';
      return;
    }
    
    if(notifList) {
      notifList.innerHTML = '';
      notifs.forEach(n => {
        const timeAgo = formatTime(n.createdat); // Just showing time for simplicity
        notifList.innerHTML += `
          <div class="notif-item ${!n.isread ? 'unread' : ''}">
            <div class="notif-icon">⚡</div>
            <div class="notif-text">
              <h4>Alert</h4>
              <p>${n.message}</p>
            </div>
            <div class="notif-time">${timeAgo}</div>
          </div>
        `;
      });
    }
  } catch (e) { console.error(e); }
}

let activeIntervals = [];

async function fetchLiveAuctions() {
  try {
    const res = await fetch(`${API_BASE}/auctions-extended`);
    if(!res.ok) throw new Error('Failed to fetch auctions');
    const auctions = await res.json();
    
    const grid = document.getElementById('auction-grid');
    if(!grid) return;
    
    // Clear old intervals
    activeIntervals.forEach(clearInterval);
    activeIntervals = [];
    
    if(auctions.length === 0) {
      grid.innerHTML = '<p style="color:var(--gray);font-size:14px;padding:20px;">No live auctions at the moment.</p>';
      return;
    }
    
    grid.innerHTML = '';
    auctions.forEach(a => {
      const name = a.facility || a.facility_name || 'Facility';
      const bid = a.current_highest_bid || a.startingbid || 0;
      
      const bd = new Date(a.bookingdate);
      const stStr = typeof a.starttime === 'string' ? a.starttime : new Date(a.starttime).toISOString();
      const stMatch = stStr.match(/T(\\d{2}):(\\d{2})/);
      let targetDate = new Date(bd);
      if (stMatch) {
          targetDate.setUTCHours(parseInt(stMatch[1]));
          targetDate.setUTCMinutes(parseInt(stMatch[2]));
      }
      
      // Timer is 6 hours prior to booking start time
      const closeTime = new Date(targetDate.getTime() - (6 * 60 * 60 * 1000));
      
      const html = `
        <div class="auction-card">
          <div class="ac-title">${name}</div>
          <div class="ac-slot">📅 ${formatDate(a.bookingdate)} · ${formatTime(a.starttime)} – ${formatTime(a.endtime)}</div>
          <div class="ac-bid-row">
            <div>
              <div class="ac-bid-label">Current Bid</div>
              <div class="ac-bid-amt" id="bid-auction-${a.bookingid}">Rs ${bid}</div>
            </div>
            <div>
              <div class="ac-timer-label">Ends In</div>
              <div class="ac-timer" id="timer-auction-${a.bookingid}">...</div>
            </div>
          </div>
          <div class="ac-input-row">
            <input class="ac-input" id="bid-input-${a.bookingid}" type="number" step="500" placeholder="Your bid (Rs)" />
            <button class="btn-bid" onclick="placeBidAPI(${a.bookingid},'bid-input-${a.bookingid}')">Place Bid</button>
          </div>
        </div>
      `;
      grid.innerHTML += html;
      
      // Setup interval for this timer
      const timerEl = document.getElementById(`timer-auction-${a.bookingid}`);
      const intv = setInterval(() => {
          const now = new Date();
          const diff = closeTime - now;
          if (diff <= 0) {
              timerEl.style.color = '#FF4040';
              timerEl.textContent = 'CLOSED';
              clearInterval(intv);
          } else {
              const h = Math.floor(diff / (1000 * 60 * 60));
              const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              const s = Math.floor((diff % (1000 * 60)) / 1000);
              timerEl.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
          }
      }, 1000);
      activeIntervals.push(intv);
    });
  } catch(e) {
    console.error(e);
  }
}

window.placeBidAPI = async function(bookingid, inputId) {
  const input = document.getElementById(inputId);
  const val = parseInt(input.value);
  
  if(!val || val <= 0) { alert('Enter a valid bid amount.'); return; }
  if(val % 500 !== 0) { alert('Bid must be a multiple of 500 (e.g., 1000, 1500, 2000).'); return; }
  
  try {
      const payload = { bookingid, userid: currentUser.userid, bidamount: val };
      const res = await fetch(`${API_BASE}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      if(res.ok) {
          alert(`Bid of Rs ${val.toLocaleString()} placed successfully!`);
          input.value = '';
          fetchLiveAuctions(); // Refresh to show new bid
      } else {
          const errorData = await res.json();
          alert('Failed to place bid: ' + (errorData.error || 'Unknown error'));
      }
  } catch(e) {
      console.error(e);
      alert('Error connecting to server.');
  }
}

// Override goToDashboard for actual Login
window.goToDashboard = async function() {
  const email = document.getElementById('login-email').value;
  if(!email) {
      alert('Please enter your email.');
      return;
  }
  
  try {
      const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
      });
      if (res.ok) {
          currentUser = await res.json();
          document.getElementById('landing-page').style.display='none';
          document.getElementById('dashboard-page').style.display='block';
          window.scrollTo(0,0);
          initDashboard();
      } else {
          const err = await res.json();
          alert('Login failed: ' + err.error);
      }
  } catch(e) {
      console.error(e);
      alert('Error connecting to server.');
  }
};

const _oldInit = window.initDashboard;
window.initDashboard = async function() {
    document.getElementById('sb-name').textContent = currentUser.username;
    document.getElementById('sb-role').textContent = currentUser.role;
    await fetchFacilities();
    await fetchMyBookings();
    await fetchLiveAuctions();
    await fetchNotifications();
};

window.selectChip = function(el) {
  document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  fetchFacilities(); // re-fetch data for "new" date
};
"""

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(js + new_js)
