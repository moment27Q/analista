const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'password123';
const LEGACY_ADMIN_HASH = '$2b$10$wT.fBthlY2YqW4L3P7DWeeaLgZ6WvO7/w5L3H.xY9v2BvG4pA/b1y';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',      // Update as needed for user environment
    password: process.env.DB_PASSWORD || '',      // Update as needed for user environment
    database: process.env.DB_NAME || 'contabilidad_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDb() {
    try {
        console.log('Connected to MySQL database.');

        // Ensure core tables exist (for environments that skipped init scripts).
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                is_capex_only TINYINT(1) DEFAULT 0,
                requires_password_change TINYINT(1) DEFAULT 1,
                password_last_changed TIMESTAMP NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS month_periods (
                id INT AUTO_INCREMENT PRIMARY KEY,
                start_date DATE NOT NULL,
                end_date DATE NULL,
                start_opex_anual DECIMAL(15,2) DEFAULT 0,
                start_opex_plazavea DECIMAL(15,2) DEFAULT 0,
                start_opex_vivanda DECIMAL(15,2) DEFAULT 0,
                start_opex_makro DECIMAL(15,2) DEFAULT 0,
                start_capex DECIMAL(15,2) DEFAULT 0,
                end_opex_anual DECIMAL(15,2) NULL,
                end_opex_plazavea DECIMAL(15,2) NULL,
                end_opex_vivanda DECIMAL(15,2) NULL,
                end_opex_makro DECIMAL(15,2) NULL,
                end_capex DECIMAL(15,2) NULL,
                spent_plazavea DECIMAL(15,2) DEFAULT 0,
                spent_vivanda DECIMAL(15,2) DEFAULT 0,
                spent_makro DECIMAL(15,2) DEFAULT 0,
                spent_capex DECIMAL(15,2) DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS dashboard_data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                ticket_value VARCHAR(255) DEFAULT '',
                ot_value VARCHAR(255) DEFAULT '',
                monto_value VARCHAR(255) DEFAULT '',
                entidad VARCHAR(255) DEFAULT '',
                activos VARCHAR(255) DEFAULT '',
                user_id INT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(255) UNIQUE NOT NULL,
                setting_value VARCHAR(255) NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS action_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action_type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type ENUM('OPEX', 'CAPEX') NOT NULL,
                entidad VARCHAR(255) NOT NULL,
                activos VARCHAR(255) DEFAULT '',
                ticket_number VARCHAR(255),
                ot_number VARCHAR(255) NOT NULL,
                monto DECIMAL(15, 2) NOT NULL,
                expense_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Normalize dashboard column types to prevent save errors from text input values.
        try {
            await pool.query("ALTER TABLE dashboard_data MODIFY COLUMN ticket_value VARCHAR(255) DEFAULT ''");
            await pool.query("ALTER TABLE dashboard_data MODIFY COLUMN ot_value VARCHAR(255) DEFAULT ''");
            await pool.query("ALTER TABLE dashboard_data MODIFY COLUMN monto_value VARCHAR(255) DEFAULT ''");
        } catch (e) {
            console.error("Error normalizing dashboard_data column types:", e.message);
        }

        // Insert default admin user if not exists and fix legacy invalid hash.
        const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [DEFAULT_ADMIN_USERNAME]);
        if (users.length === 0) {
            const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
            await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", [DEFAULT_ADMIN_USERNAME, hashedPassword]);
            console.log('Default admin user created.');
        } else if (users[0].password === LEGACY_ADMIN_HASH) {
            const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
            await pool.query("UPDATE users SET password = ? WHERE username = ?", [hashedPassword, DEFAULT_ADMIN_USERNAME]);
            console.log('Legacy admin password hash updated to default credentials.');
        }

        // Insert default dashboard data if empty
        const [rows] = await pool.query("SELECT count(*) as count FROM dashboard_data");
        if (rows[0].count === 0) {
            const defaultData = [
                ['DIEGO', '', '', '', ''],
                ['GIANFRANCO', '', '', '', ''],
                ['RAUL', '', '', '', ''],
                ['EDWIN', '', '', '', '']
            ];

            for (const data of defaultData) {
                await pool.query("INSERT INTO dashboard_data (name, ticket_value, ot_value, monto_value, entidad) VALUES (?, ?, ?, ?, ?)", data);
            }
            console.log('Default dashboard data created.');
        }

        // --- MIGRATION LOGIC FOR V2 ---
        try {
            await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'");
            console.log("Added 'role' column to 'users' table.");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error("Error adding role:", e.message);
        }

        await pool.query("UPDATE users SET role = 'admin' WHERE username = ?", [DEFAULT_ADMIN_USERNAME]);

        try {
            await pool.query("ALTER TABLE dashboard_data ADD COLUMN user_id INT");
            await pool.query("ALTER TABLE dashboard_data ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
            console.log("Added 'user_id' column to 'dashboard_data' table.");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_CANT_CREATE_TABLE' && e.code !== 'ER_DUP_KEYNAME') {
                console.error("Error adding user_id:", e.message);
            }
        }

        const [unlinkedRows] = await pool.query("SELECT * FROM dashboard_data WHERE user_id IS NULL");
        for (const unlinked of unlinkedRows) {
            const username = unlinked.name.toLowerCase().replace(/\\s+/g, '');
            const [existingUser] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);

            let userId;
            if (existingUser.length > 0) {
                userId = existingUser[0].id;
            } else {
                const hashedPassword = await bcrypt.hash('123456', 10);
                const [insertRes] = await pool.query(
                    "INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
                    [username, hashedPassword]
                );
                userId = insertRes.insertId;
                console.log(`Created default login for ${unlinked.name} (username: ${username})`);
            }
            await pool.query("UPDATE dashboard_data SET user_id = ? WHERE id = ?", [userId, unlinked.id]);
        }
        // --- OPEX MIGRATION LOGIC ---
        try {
            await pool.query("ALTER TABLE dashboard_data ADD COLUMN entidad VARCHAR(255) DEFAULT ''");
            console.log("Added 'entidad' column to 'dashboard_data' table.");
            // Reset old OPEX history as requested by the user
            await pool.query("UPDATE dashboard_data SET ticket_value = '', ot_value = '', monto_value = '', entidad = ''");
            console.log("Cleared old OPEX historical data for clean start.");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error("Error adding entidad:", e.message);
        }

        // Initialize default budgets if not present
        const defaultSettings = [
            ['opex_plazavea_budget', '50000'],
            ['opex_vivanda_budget', '30000'],
            ['opex_makro_budget', '20000'],
            ['capex_annual_budget', '100000'],
            ['opex_anual_budget', '100000']
        ];
        for (const [key, val] of defaultSettings) {
             await pool.query("INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)", [key, val]);
        }
        // --- END OPEX MIGRATION LOGIC ---

        // --- ACTIVOS MIGRATION LOGIC ---
        try {
            await pool.query("ALTER TABLE dashboard_data ADD COLUMN activos VARCHAR(255) DEFAULT ''");
            await pool.query("ALTER TABLE expenses ADD COLUMN activos VARCHAR(255) DEFAULT ''");
            console.log("Added 'activos' column to tables.");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error("Error adding activos column:", e.message);
        }
        // --- END ACTIVOS MIGRATION LOGIC ---

        // --- IS_CAPEX_ONLY MIGRATION ---
        try {
            await pool.query("ALTER TABLE users ADD COLUMN is_capex_only TINYINT(1) DEFAULT 0");
            console.log("Added 'is_capex_only' column to 'users' table.");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error("Error adding is_capex_only:", e.message);
        }
        // Mark 'edwin' as capex-only
        await pool.query("UPDATE users SET is_capex_only = 1 WHERE username = 'edwin'");
        console.log("Marked 'edwin' as is_capex_only.");
        // --- END IS_CAPEX_ONLY MIGRATION ---

        // --- PASSWORD MIGRATION LOGIC ---
        try {
            await pool.query("ALTER TABLE users ADD COLUMN requires_password_change TINYINT(1) DEFAULT 1");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error("Error adding requires_password_change:", e.message);
        }
        try {
            await pool.query("ALTER TABLE users ADD COLUMN password_last_changed TIMESTAMP NULL");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error("Error adding password_last_changed:", e.message);
        }
        // --- END PASSWORD MIGRATION LOGIC ---

    } catch (err) {
        console.error('Database initialization error:', err.message);
    }
}

// Call init to seed if tables exist but are empty
initDb();

module.exports = pool;
