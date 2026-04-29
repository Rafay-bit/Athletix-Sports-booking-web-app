const sql = require('mssql/msnodesqlv8');
const config = {
    server: 'DESKTOP-A4D8U2L\\SQLEXPRESS',
    database: 'sports_facility_db',
    driver: 'ODBC Driver 18 for SQL Server',
    options: { trustedConnection: true }
};
async function get() {
    const pool = await sql.connect(config);

    // Check equipment_rentals columns
    let r = await pool.request().query("SELECT column_name FROM information_schema.columns WHERE table_name = 'equipment_rentals'");
    console.log('equipment_rentals cols:', r.recordset.map(c=>c.column_name).join(', '));

    // Sample data
    r = await pool.request().query('SELECT TOP 3 * FROM equipment_rentals');
    console.log('Sample rentals:', r.recordset);

    // Check sp_get_booking_rentals exists
    r = await pool.request().query("SELECT name FROM sys.procedures WHERE name = 'sp_get_booking_rentals'");
    console.log('SP exists:', r.recordset.length > 0);

    // Try it for booking 1
    try {
        r = await pool.request().input('bookingid', sql.Int, 1).execute('sp_get_booking_rentals');
        console.log('SP result for booking 1:', r.recordset);
    } catch(e) {
        console.log('SP error:', e.message);
        // Try direct query instead
        r = await pool.request().query(`
            SELECT er.rentalid, e.name AS equipment_name, er.quantity, er.rentalfee
            FROM equipment_rentals er
            JOIN equipment e ON er.equipmentid = e.equipmentid
            WHERE er.bookingid = 1
        `);
        console.log('Direct query result:', r.recordset);
    }

    // Check equipment columns
    r = await pool.request().query("SELECT column_name FROM information_schema.columns WHERE table_name = 'equipment'");
    console.log('equipment cols:', r.recordset.map(c=>c.column_name).join(', '));

    process.exit();
}
get();
