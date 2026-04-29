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

async function test() {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request()
            .input('name', sql.NVarChar, 'Test Facility ' + Date.now())
            .input('price', sql.Decimal(10, 2), 1000)
            .input('is_auction', sql.Bit, 0)
            .input('capacity', sql.Int, 10)
            .query('INSERT INTO facilities (name, base_price, is_auctionable, capacity) VALUES (@name, @price, @is_auction, @capacity)');
        console.log('Insert successful:', result.rowsAffected);
    } catch (err) {
        console.error('Insert failed:', err.message);
    } finally {
        sql.close();
    }
}
test();
