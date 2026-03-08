const mysql = require('mysql2/promise');

async function setupDB() {
    try {
        // Use the connection properties that pool uses.
        const pool = require('./database');

        console.log("Creating settings table if not exists...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL
            );
        `);

        console.log("Inserting default budget...");
        await pool.query(`
            INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('total_budget', '2450000');
        `);

        console.log("Settings table created and initialized successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Failed to setup DB:", e);
        process.exit(1);
    }
}

setupDB();
