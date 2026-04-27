const http = require('http');

async function fetchInternal(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(`http://localhost:3000${path}`, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function runTests() {
    console.log('--- STARTING API TESTS ---');
    let errors = 0;

    // 1. Test Login
    console.log('Testing Login: /api/auth/login');
    const loginRes = await fetchInternal('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ahmadraza', password: '1234' })
    });
    if (!loginRes.data.success) {
        console.error('❌ Login failed:', loginRes.data.error);
        errors++;
    } else {
        console.log('✅ Login successful');
    }

    // 2. Test Features
    const endpoints = [
        '/api/features/facility-ratings',
        '/api/features/facility-health',
        '/api/features/active-auctions',
        '/api/features/equipment-availability',
        '/api/features/monthly-revenue',
        '/api/features/top-facilities',
        '/api/features/peak-hours',
        '/api/features/power-users',
        '/api/features/available-facilities?date=2026-05-15',
        '/api/users',
        '/api/bookings'
    ];

    for (const ep of endpoints) {
        console.log(`Testing: ${ep}`);
        try {
            const res = await fetchInternal(ep);
            if (res.status === 200 && res.data.success) {
                console.log(`✅ ${ep} - Success (${res.data.data.length} records)`);
            } else {
                console.error(`❌ ${ep} - Failed:`, res.status, res.data.error || 'Unknown error');
                errors++;
            }
        } catch (err) {
            console.error(`❌ ${ep} - Exception:`, err.message);
            errors++;
        }
    }

    console.log(`--- TESTS COMPLETE (${errors} errors found) ---`);
}

runTests();
