const sql = require('mssql');
const config = {
    server: 'localhost',
    database: 'SportsFacilityDB',
    options: {
        trustedConnection: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    driver: 'msnodesqlv8'
};

async function check() {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_admin_stats'");
        console.log('View exists:', result.recordset.length > 0);
        if (result.recordset.length > 0) {
            let data = await pool.request().query("SELECT * FROM view_admin_stats");
            console.log('Stats Data:', data.recordset[0]);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        sql.close();
    }
}
check();
