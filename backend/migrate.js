const pool = require('./database');
const bcrypt = require('bcrypt');

async function migrate() {
    try {
        console.log("Starting database migration...");

        // 1. Add role to users table (Ignore if already exists)
        try {
            await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'");
            console.log("Added 'role' column to 'users' table.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("'role' column already exists in 'users'.");
            } else {
                throw e;
            }
        }

        // 2. Set admin role
        await pool.query("UPDATE users SET role = 'admin' WHERE username = 'admin'");

        // 3. Add user_id to dashboard_data
        try {
            await pool.query("ALTER TABLE dashboard_data ADD COLUMN user_id INT");
            await pool.query("ALTER TABLE dashboard_data ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
            console.log("Added 'user_id' column to 'dashboard_data' table.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("'user_id' column already exists in 'dashboard_data'.");
            } else {
                throw e;
            }
        }

        // 4. Create missing users for existing dashboard_data rows
        const [rows] = await pool.query("SELECT * FROM dashboard_data WHERE user_id IS NULL");
        for (const row of rows) {
            // Check if username corresponding to name already exists
            const username = row.name.toLowerCase().replace(/\s+/g, '');
            const [existingUser] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);

            let userId;
            if (existingUser.length > 0) {
                userId = existingUser[0].id;
            } else {
                // Create new user for them, default password '123456'
                console.log(`Creating user login for existing member: ${row.name} (username: ${username})`);
                const hashedPassword = await bcrypt.hash('123456', 10);
                const [insertRes] = await pool.query(
                    "INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
                    [username, hashedPassword]
                );
                userId = insertRes.insertId;
            }

            // Link them
            await pool.query("UPDATE dashboard_data SET user_id = ? WHERE id = ?", [userId, row.id]);
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
