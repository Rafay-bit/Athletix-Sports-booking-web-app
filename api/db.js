// db.js — SQL Server connection using Windows Authentication (msnodesqlv8)
const sql = require('mssql/msnodesqlv8');

const config = {
    server: 'DESKTOP-A4D8U2L\SQLEXPRESS',
    database: 'sports_facility_db',
    driver: 'msnodesqlv8',
    options: {
        trustedConnection: true,
        trustServerCertificate: true,
    },
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=DESKTOP-A4D8U2L\\SQLEXPRESS;Database=sports_facility_db;Trusted_Connection=yes;TrustServerCertificate=yes;'
};

// Singleton connection pool
let pool;

async function getPool() {
    if (!pool) {
        try {
            pool = await sql.connect(config);
            console.log('✅  Connected to SQL Server (Windows Auth)');
        } catch (err) {
            console.error('❌  SQL Server connection failed:', err.message);
            throw err;
        }
    }
    return pool;
}

module.exports = { getPool, sql };
