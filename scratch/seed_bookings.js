const sql = require('mssql/msnodesqlv8');
const config = {
    server: 'DESKTOP-A4D8U2L\\SQLEXPRESS',
    database: 'sports_facility_db',
    driver: 'ODBC Driver 18 for SQL Server',
    options: {
        trustedConnection: true,
        trustServerCertificate: true
    }
};

async function seed() {
    try {
        let pool = await sql.connect(config);
        // Add some confirmed bookings
        await pool.request().query(`
            INSERT INTO bookings (userid, facilityid, slotid, bookingdate, finalprice, status)
            VALUES 
            (1, 1, 1, '2026-05-01', 1000, 'confirmed'),
            (2, 2, 2, '2026-05-01', 1500, 'confirmed'),
            (3, 3, 3, '2026-05-02', 800, 'confirmed'),
            (1, 4, 4, '2026-05-02', 2000, 'confirmed')
        `);
        console.log('Dummy bookings seeded.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        sql.close();
    }
}
seed();
