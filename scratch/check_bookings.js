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

async function check() {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query("SELECT TOP 5 * FROM bookings");
        console.log('Bookings Count:', result.recordset.length);
        console.log('Bookings Sample:', result.recordset);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        sql.close();
    }
}
check();
