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

const sqlStatements = [
    `IF OBJECT_ID('view_admin_stats', 'V') IS NOT NULL DROP VIEW view_admin_stats`,
    `CREATE VIEW view_admin_stats AS
     SELECT 
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM facilities) AS total_facilities,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
        (SELECT ISNULL(SUM(totalstock), 0) FROM equipment) AS total_equipment,
        (SELECT ISNULL(SUM(finalprice), 0) FROM bookings WHERE status = 'confirmed') AS total_revenue`,
    
    `IF OBJECT_ID('view_facility_ratings', 'V') IS NOT NULL DROP VIEW view_facility_ratings`,
    `CREATE VIEW view_facility_ratings AS
     SELECT f.name, AVG(CAST(r.rating AS FLOAT)) AS avg_rating, COUNT(r.reviewid) AS review_count
     FROM facilities f
     LEFT JOIN reviews r ON f.facilityid = r.facilityid
     GROUP BY f.name`
];

async function setup() {
    try {
        let pool = await sql.connect(config);
        for (let stmt of sqlStatements) {
            await pool.request().query(stmt);
            console.log('Executed:', stmt.substring(0, 50) + '...');
        }
        console.log('Admin views setup complete.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        sql.close();
    }
}
setup();
