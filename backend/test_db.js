const pool = require('./database');

async function test() {
    try {
        const [tables] = await pool.query("SHOW TABLES");
        console.log("Tables in database:", tables);

        const [settings] = await pool.query("SELECT * FROM settings");
        console.log("Settings rows:", settings);

        const [users] = await pool.query("SELECT * FROM dashboard_data");
        console.log("Dashboard rows:", users);
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        process.exit();
    }
}

test();
