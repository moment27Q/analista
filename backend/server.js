const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./database');

const app = express();
const PORT = 3001;
const SECRET_KEY = 'supersecret_for_this_demo_only';
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'password123';
const LEGACY_ADMIN_HASH = '$2b$10$wT.fBthlY2YqW4L3P7DWeeaLgZ6WvO7/w5L3H.xY9v2BvG4pA/b1y';

app.use(cors());
app.use(express.json());

async function logActionSafely(userId, actionType, description) {
    try {
        await pool.query(
            "INSERT INTO action_history (user_id, action_type, description) VALUES (?, ?, ?)",
            [userId, actionType, description]
        );
    } catch (err) {
        console.warn(`Action history insert failed (${actionType}):`, err.message);
    }
}

function parseMoneyValue(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Public summary for landing stats cards.
app.get('/api/summary', async (_req, res) => {
    try {
        const [settingsRows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'total_budget' LIMIT 1");
        const totalBudget = settingsRows.length > 0 ? parseMoneyValue(settingsRows[0].setting_value) : 0;

        const [rows] = await pool.query("SELECT monto_value FROM dashboard_data");
        const totalSpent = rows.reduce((sum, row) => sum + parseMoneyValue(row.monto_value), 0);
        const remaining = totalBudget - totalSpent;

        res.json({
            total_budget: totalBudget,
            total_spent: totalSpent,
            remaining
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedUsername = username.trim();

    try {
        const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [trimmedUsername]);

        if (rows.length === 0) {
            console.log(`Login failed for username: '${trimmedUsername}' (original: '${username}') - User not found`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        let match = await bcrypt.compare(password, user.password);

        // Auto-fix for a legacy seeded admin hash that doesn't match password123.
        if (
            !match &&
            user.username === DEFAULT_ADMIN_USERNAME &&
            password === DEFAULT_ADMIN_PASSWORD &&
            user.password === LEGACY_ADMIN_HASH
        ) {
            const newHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
            await pool.query("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
            match = true;
        }

        if (match) {
            console.log(`Login successful for ${trimmedUsername} (role: ${user.role})`);
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
            res.json({ token, message: 'Login successful', role: user.role });
        } else {
            console.log(`Login failed for ${trimmedUsername} - Password mismatch`);
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Protected Dashboard API
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        let query = "SELECT * FROM dashboard_data";
        let sqlParams = [];
        if (req.user && req.user.role !== 'admin') {
            query += " WHERE user_id = ?";
            sqlParams.push(req.user.id);
        }

        const [rows] = await pool.query(query, sqlParams);
        const [settingsRows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'total_budget' LIMIT 1");
        const [allRows] = await pool.query("SELECT monto_value FROM dashboard_data");

        let total_budget = "2450000"; // default fallback
        if (settingsRows.length > 0) {
            total_budget = settingsRows[0].setting_value;
        }

        const totalBudgetNumber = parseMoneyValue(total_budget);
        const totalSpentGlobal = allRows.reduce((sum, row) => sum + parseMoneyValue(row.monto_value), 0);
        const hasBudget = totalBudgetNumber > 0;
        const utilizationPercentRaw = hasBudget ? (totalSpentGlobal / totalBudgetNumber) * 100 : 0;
        const utilizationPercent = Math.max(0, Math.min(100, utilizationPercentRaw));
        const availablePercent = hasBudget
            ? Math.max(0, Math.min(100, 100 - utilizationPercent))
            : 0;
        const capexValue = hasBudget ? Math.max(0, totalBudgetNumber - totalSpentGlobal) : 0;

        const gauges = {
            opex_anual: totalSpentGlobal * 12,
            capex: capexValue,
            opex_mensual: totalSpentGlobal,
            utilization_percent: utilizationPercent,
            available_percent: availablePercent
        };

        res.json({ gauges, table_data: rows, total_budget });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update Dashboard row endpoint
app.post('/api/dashboard/update', authenticateToken, async (req, res) => {
    const { id, ticket_value, ot_value, monto_value, clear_after_save } = req.body;

    try {
        if (req.user && req.user.role !== 'admin') {
            const [check] = await pool.query("SELECT id FROM dashboard_data WHERE id = ? AND user_id = ?", [id, req.user.id]);
            if (check.length === 0) return res.status(403).json({ error: 'Unauthorized to edit this row' });
        }

        await pool.query(
            "UPDATE dashboard_data SET ticket_value = ?, ot_value = ?, monto_value = ? WHERE id = ?",
            [ticket_value, ot_value, monto_value, id]
        );

        await logActionSafely(
            req.user.id,
            'Edit Row',
            `Registro fila #${id} (Ticket: ${ticket_value || '0'}, OT: ${ot_value || '0'}, Monto: ${monto_value || '0'})`
        );

        if (clear_after_save) {
            await pool.query(
                "UPDATE dashboard_data SET ticket_value = '', ot_value = '', monto_value = '' WHERE id = ?",
                [id]
            );
        }

        res.json({ success: true, cleared: !!clear_after_save });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update Total Budget endpoint
app.post('/api/budget/update', authenticateToken, async (req, res) => {
    const { total_budget } = req.body;

    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    if (!total_budget) {
        return res.status(400).json({ error: 'total_budget is required' });
    }

    try {
        await pool.query(
            "INSERT INTO settings (setting_key, setting_value) VALUES ('total_budget', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [total_budget, total_budget]
        );

        await logActionSafely(req.user.id, 'Budget', `Modifico el presupuesto total a $${total_budget}`);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Reset all financial data endpoint (admin only)
app.post('/api/dashboard/reset', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    try {
        await pool.query(
            "UPDATE dashboard_data SET ticket_value = '0', ot_value = '0', monto_value = '0'"
        );
        await pool.query(
            "INSERT INTO settings (setting_key, setting_value) VALUES ('total_budget', '0') ON DUPLICATE KEY UPDATE setting_value = '0'"
        );
        await pool.query("DELETE FROM action_history");

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Create Team Member endpoint
app.post('/api/dashboard/users/create', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    try {
        // Create user login first
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await pool.query(
            "INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
            [username, hashedPassword]
        );
        const userId = userResult.insertId;

        // Create tracking row and link to user
        const [result] = await pool.query(
            "INSERT INTO dashboard_data (name, user_id) VALUES (?, ?)",
            [name, userId]
        );

        await logActionSafely(req.user.id, 'Create User', `Anadio un nuevo miembro: ${name}`);

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Name already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete Team Member endpoint
app.post('/api/dashboard/users/delete', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'ID is required' });
    }

    try {
        await pool.query(
            "DELETE FROM dashboard_data WHERE id = ?",
            [id]
        );

        await logActionSafely(req.user.id, 'Delete User', 'Elimino a un miembro de equipo');

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update User Password endpoint
app.post('/api/dashboard/users/password', authenticateToken, async (req, res) => {
    const { id, newPassword } = req.body;

    if (!id || !newPassword) {
        return res.status(400).json({ error: 'ID and newPassword are required' });
    }

    try {
        // First get the user_id for this dashboard_data row
        const [dashRows] = await pool.query("SELECT user_id FROM dashboard_data WHERE id = ?", [id]);
        if (dashRows.length === 0) return res.status(404).json({ error: 'Row not found' });

        const targetUserId = dashRows[0].user_id;

        if (req.user && req.user.role !== 'admin') {
            // If normal user, they can only change their own password
            if (targetUserId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to change this password' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, targetUserId]);

        await logActionSafely(req.user.id, 'Password', 'Modifico la contrasena de un usuario');

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Action History endpoint
app.get('/api/dashboard/history', authenticateToken, async (req, res) => {
    try {
        let query = `SELECT h.*, u.username, u.role
             FROM action_history h 
             LEFT JOIN users u ON h.user_id = u.id`;
        const params = [];

        if (req.user && req.user.role !== 'admin') {
            query += ` WHERE h.user_id = ?`;
            params.push(req.user.id);
        }

        query += ` ORDER BY h.created_at DESC`;

        const [rows] = await pool.query(query, params);
        res.json({ history: rows });
    } catch (err) {
        console.warn('History endpoint failed, returning empty history:', err.message);
        res.json({ history: [] });
    }
});

// Middleware for validating JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
