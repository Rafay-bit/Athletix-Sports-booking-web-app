const http = require('http');
function req(method, path, body) {
  return new Promise((resolve) => {
    const r = http.request({ hostname:'localhost', port:3000, path, method,
      headers:{'Content-Type':'application/json'} }, res => {
      let d = ''; res.on('data', c => d+=c); res.on('end', () => resolve({s:res.statusCode, d}));
    });
    r.on('error', e => resolve({s:'ERR',d:e.message}));
    if(body) r.write(JSON.stringify(body));
    r.end();
  });
}
async function run() {
  // 1. Create auction booking for user 1 on an auctionable facility (facilityid=1)
  console.log('--- TEST: Create Auction Booking ---');
  const r1 = await req('POST', '/auction-booking', {
    userid: 1, facilityid: 1, slotid: 8,
    bookingdate: '2026-05-05', startingbid: 1000
  });
  const auc = JSON.parse(r1.d);
  console.log('Create auction booking ->', r1.s, auc);

  if(r1.s === 201) {
    // 2. Check it shows in my-bookings with open_bid status
    const r2 = await req('GET', `/my-bookings/1`);
    const bookings = JSON.parse(r2.d);
    const found = bookings.find(b => b.bookingid === auc.bookingid);
    console.log('Found in my-bookings ->', !!found, '| status:', found?.status, '| highest_bid:', found?.highest_bid);

    // 3. Check it shows in auctions-extended
    const r3 = await req('GET', '/auctions-extended');
    const auctions = JSON.parse(r3.d);
    const foundAuc = auctions.find(a => a.bookingid === auc.bookingid);
    console.log('Found in auctions-extended ->', !!foundAuc, foundAuc);

    // 4. Another user places a higher bid
    const r4 = await req('POST', '/bids', { bookingid: auc.bookingid, userid: 2, bidamount: 1500 });
    console.log('User 2 places Rs 1500 bid ->', r4.s, JSON.parse(r4.d));

    // 5. User 1 should get an outbid notification
    const r5 = await req('GET', '/notifications/1');
    const notifs = JSON.parse(r5.d);
    const outbid = notifs.find(n => n.message.includes(`Booking #${auc.bookingid}`));
    console.log('User 1 outbid notification ->', outbid ? outbid.message : 'NOT FOUND');
  }

  process.exit(0);
}
run();
