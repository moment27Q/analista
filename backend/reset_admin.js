const pool = require('./database.js');
const bcrypt = require('bcrypt');

async function resetAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await pool.query("UPDATE users SET password = ? WHERE username = 'admin'", [hashedPassword]);
        console.log("Admin password successfully reset to 'password123'");
    } catch (e) {
        console.error("Error resetting admin password:", e.message);
    } finally {
        process.exit();
    }
}
resetAdmin();
