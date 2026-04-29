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
  // 1. Wrong password
  let r = await req('POST','/login',{email:'ahmad.raza@student.lhr.edu', password:'wrong'});
  console.log('1. Wrong pw →', r.s, JSON.parse(r.d).error);

  // 2. Valid login
  r = await req('POST','/login',{email:'ahmad.raza@student.lhr.edu', password:'1234'});
  console.log('2. Valid login →', r.s, JSON.parse(r.d).username);

  // 3. Facilities list
  r = await req('GET','/facilities');
  const facs = JSON.parse(r.d);
  console.log('3. Facilities →', r.s, facs.length, 'total;', facs.filter(f=>f.is_auctionable).length, 'auctionable');

  // 4. Auctions extended
  r = await req('GET','/auctions-extended');
  const aucs = JSON.parse(r.d);
  console.log('4. Auctions →', r.s, aucs.length, 'active; starttime sample:', aucs[0]?.starttime);

  // 5. Notifications for user 1
  r = await req('GET','/notifications/1');
  const notifs = JSON.parse(r.d);
  console.log('5. Notifications u1 →', r.s, notifs.length, 'items; unread:', notifs.filter(n=>!n.isread).length);

  // 6. Bid not multiple of 500
  r = await req('POST','/bids',{bookingid:33, userid:1, bidamount:7300});
  console.log('6. Bad bid →', r.s, JSON.parse(r.d).error);

  // 7. Bid too low
  r = await req('POST','/bids',{bookingid:33, userid:1, bidamount:5000});
  console.log('7. Low bid →', r.s, JSON.parse(r.d).error);

  // 8. Valid bid
  r = await req('POST','/bids',{bookingid:33, userid:1, bidamount:7000});
  console.log('8. Valid bid →', r.s, JSON.parse(r.d));

  process.exit(0);
}
run();
