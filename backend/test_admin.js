const pool = require('./database.js');
const bcrypt = require('bcrypt');

async function test() {
    try {
        const [users] = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        console.log("Admin user:", users[0]);
        if (users[0]) {
            const match = await bcrypt.compare('password123', users[0].password);
            console.log("Password matches 'password123':", match);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
