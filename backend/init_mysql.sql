-- CREATE DATABASE
CREATE DATABASE IF NOT EXISTS contabilidad_db;
USE contabilidad_db;

-- CREATE USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user'
);

-- CREATE DASHBOARD_DATA TABLE
CREATE TABLE IF NOT EXISTS dashboard_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    ticket_value VARCHAR(255) DEFAULT '',
    ot_value VARCHAR(255) DEFAULT '',
    monto_value VARCHAR(255) DEFAULT '',
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CREATE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
);

-- CREATE ACTION_HISTORY TABLE
CREATE TABLE IF NOT EXISTS action_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- INSERT DEFAULT ADMIN (Password is 'password123' hashed with bcrypt)
INSERT IGNORE INTO users (username, password) 
VALUES ('admin', '$2b$10$wT.fBthlY2YqW4L3P7DWeeaLgZ6WvO7/w5L3H.xY9v2BvG4pA/b1y');

-- INSERT DEFAULT DATA ROWS
INSERT IGNORE INTO dashboard_data (name, ticket_value, ot_value, monto_value) VALUES 
('DIEGO', '', '', ''),
('GIANFRANCO', '', '', ''),
('RAUL', '', '', ''),
('EDWIN', '', '', '');

-- INSERT DEFAULT BUDGET
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('total_budget', '2450000');
