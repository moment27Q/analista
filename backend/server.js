const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./database');

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { 
    path: '/api/socket.io',
    cors: { origin: '*' } 
});

const PORT = 3001;
const SECRET_KEY = 'supersecret_for_this_demo_only';
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'password123';
const LEGACY_ADMIN_HASH = '$2b$10$wT.fBthlY2YqW4L3P7DWeeaLgZ6WvO7/w5L3H.xY9v2BvG4pA/b1y';

app.use(cors());
app.use(express.json());

// Add period_id to expenses schema to strictly bound expenses to their active period
pool.query("ALTER TABLE expenses ADD COLUMN period_id INT DEFAULT NULL").catch(() => {});

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

/**
 * Returns the fiscal period (month/year) for a given date.
 * Fiscal month N runs from 22nd of month N-1 to 21st of month N.
 */
function getFiscalPeriod(dateInput) {
    const d = new Date(dateInput);
    let month = d.getMonth() + 1; // 1-12
    let year = d.getFullYear();

    if (d.getDate() >= 22) {
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }
    return { month, year };
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
            console.log(`Login failed for username: '${trimmedUsername}' - User not found`);
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
            console.log(`Login successful for ${trimmedUsername} (role: ${user.role}, is_capex_only: ${user.is_capex_only})`);
            
            // Check 6 months expiration
            let forcePasswordChange = !!user.requires_password_change;
            if (user.password_last_changed) {
                const lastChanged = new Date(user.password_last_changed);
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                if (lastChanged < sixMonthsAgo) {
                    forcePasswordChange = true;
                }
            } else if (!user.password_last_changed && user.username !== DEFAULT_ADMIN_USERNAME && typeof user.requires_password_change !== 'undefined') {
                 // For existing users before migration, force them if last changed is null, but not default admin
                 forcePasswordChange = true;
            }
            // Get display name from dashboard_data
            const [dashRows] = await pool.query("SELECT name FROM dashboard_data WHERE user_id = ?", [user.id]);
            const displayName = dashRows.length > 0 ? dashRows[0].name : user.username;

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role, is_capex_only: !!user.is_capex_only, requires_password_change: forcePasswordChange },
                SECRET_KEY,
                { expiresIn: '8h' }
            );
            res.json({ 
                token, 
                message: 'Login successful', 
                role: user.role, 
                name: displayName,
                is_capex_only: !!user.is_capex_only, 
                requires_password_change: forcePasswordChange 
            });
        } else {
            console.log(`Login failed for ${trimmedUsername} - Password mismatch`);
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});


app.get('/api/testcapex', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT id, type, entidad, monto, period_id FROM expenses ORDER BY id DESC LIMIT 10");
        const [periods] = await pool.query("SELECT id FROM month_periods WHERE is_active = 1");
        res.json({ expenses: rows, activePeriod: periods });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Protected Dashboard API
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const now = new Date();

        // Fetch all budget settings
        const [settingsRows] = await pool.query("SELECT setting_key, setting_value FROM settings");
        const settings = {};
        settingsRows.forEach(s => settings[s.setting_key] = s.setting_value);

        const totalBudget = parseMoneyValue(settings['total_budget'] || '0');
        const plazaveaBudget = parseMoneyValue(settings['opex_plazavea_budget'] || '0');
        const vivandaBudget = parseMoneyValue(settings['opex_vivanda_budget'] || '0');
        const makroBudget = parseMoneyValue(settings['opex_makro_budget'] || '0');
        const capexAnnualBudget = parseMoneyValue(settings['capex_annual_budget'] || '0');
        const opexAnualBudget = parseMoneyValue(settings['opex_anual_budget'] || '0');

        // Fetch table data (single row for current user if not admin)
        let tableQuery = "SELECT * FROM dashboard_data";
        let sqlParams = [];
        if (req.user && req.user.role !== 'admin') {
            tableQuery += " WHERE user_id = ?";
            sqlParams.push(req.user.id);
        }
        const [tableData] = await pool.query(tableQuery, sqlParams);

        // Fetch active period info FIRST to determine if we should count expenses
        const [periodRows] = await pool.query("SELECT * FROM month_periods WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
        const activePeriod = periodRows.length > 0 ? periodRows[0] : null;

        // Calculate Monthly expense totals for the current active period ONLY
        let monthlyExpenses = [];
        let queryExpenses = [];
        let capexSpent = 0;
        if (activePeriod) {
            const [rows] = await pool.query(
                `SELECT e.id, e.entidad, e.monto, e.type, e.activos, e.ticket_number, e.ot_number, e.expense_date, u.username as name
                 FROM expenses e 
                 JOIN users u ON e.user_id = u.id 
                 WHERE e.period_id = ? ORDER BY e.id DESC`,
                [activePeriod.id]
            );
            queryExpenses = rows;
            monthlyExpenses = queryExpenses.filter(e => e.type === 'OPEX');
            capexSpent = queryExpenses.filter(e => e.type === 'CAPEX').reduce((sum, e) => sum + Number(e.monto), 0);
        }

        let opex_plazavea = 0;
        let opex_vivanda = 0;
        let opex_makro = 0;
        monthlyExpenses.forEach(exp => {
            if (exp.entidad === 'Plaza Vea') opex_plazavea += Number(exp.monto);
            else if (exp.entidad === 'Vivanda') opex_vivanda += Number(exp.monto);
            else if (exp.entidad === 'Makro') opex_makro += Number(exp.monto);
        });

        // OPEX Annual: budget configured by admin, reduced by active period spending
        const totalOpexSpent = opex_plazavea + opex_vivanda + opex_makro;
        const opexAnualRemaining = opexAnualBudget - totalOpexSpent;

        const remainingCapex = capexAnnualBudget - capexSpent;

        // --- 90% ALERT LOGIC ---
        const alerts = [];
        if (plazaveaBudget > 0 && (opex_plazavea / plazaveaBudget) >= 0.9) {
            alerts.push('Plaza Vea');
        }
        if (vivandaBudget > 0 && (opex_vivanda / vivandaBudget) >= 0.9) {
            alerts.push('Vivanda');
        }
        if (makroBudget > 0 && (opex_makro / makroBudget) >= 0.9) {
            alerts.push('Makro');
        }

        const totalSpentMonthly = opex_plazavea + opex_vivanda + opex_makro;
        const totalMonthlyBudget = plazaveaBudget + vivandaBudget + makroBudget;
        // Calculate Yearly OPEX & CAPEX spent for the main progress bar
        const [yearlyOpexRows] = await pool.query(
            "SELECT SUM(monto) as total FROM expenses WHERE type = 'OPEX' AND YEAR(expense_date) = YEAR(CURDATE())"
        );
        const yearlyOpexSpent = parseMoneyValue(yearlyOpexRows[0].total || 0);

        const [yearlyCapexRows] = await pool.query(
            "SELECT SUM(monto) as total FROM expenses WHERE type = 'CAPEX' AND YEAR(expense_date) = YEAR(CURDATE())"
        );
        const yearlyCapexSpent = parseMoneyValue(yearlyCapexRows[0].total || 0);

        // Return current budgets directly from settings for configuration consistency
        const trueOpexAnualBase = opexAnualBudget;
        const trueCapexBase = capexAnnualBudget;

        const opexAnualPercent = trueOpexAnualBase > 0
            ? (opexAnualRemaining / trueOpexAnualBase) * 100
            : 0;

        const totalSpentAll = yearlyOpexSpent + yearlyCapexSpent;
        const totalAvailablePercent = totalBudget > 0 ? Math.max(0, ((totalBudget - totalSpentAll) / totalBudget) * 100) : 100;

        const gauges = {
            opex_anual: opexAnualRemaining,
            opex_anual_budget: opexAnualBudget,
            opex_anual_percent: opexAnualPercent,
            opex_anual_spent: totalOpexSpent,
            capex: remainingCapex,
            capex_spent: capexSpent,
            opex_mensual_total: totalSpentMonthly,
            opex_plazavea,
            opex_vivanda,
            opex_makro,
            total_available_percent: totalAvailablePercent,
            budgets: {
                plazavea: plazaveaBudget,
                vivanda: vivandaBudget,
                makro: makroBudget,
                capex: trueCapexBase,
                opex_anual: trueOpexAnualBase
            },
            alerts_90: alerts,
            active_period: activePeriod ? {
                id: activePeriod.id,
                start_date: activePeriod.start_date,
                start_opex_anual: activePeriod.start_opex_anual,
                start_opex_plazavea: activePeriod.start_opex_plazavea,
                start_opex_vivanda: activePeriod.start_opex_vivanda,
                start_opex_makro: activePeriod.start_opex_makro,
                start_capex: activePeriod.start_capex
            } : null
        };

        let expensesToReturn = activePeriod ? queryExpenses : [];
        if (req.user && req.user.role !== 'admin') {
            expensesToReturn = expensesToReturn.filter(e => e.name === req.user.username);
        }

        res.json({ 
            gauges, 
            table_data: tableData, 
            total_budget: totalBudget.toString(),
            team_expenses: expensesToReturn
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update Dashboard row endpoint
app.post('/api/dashboard/update', authenticateToken, async (req, res) => {
    const { id, ticket_value, ot_value, monto_value, entidad, activos, clear_after_save, expense_date } = req.body;

    if (!entidad && (!req.user || !req.user.is_capex_only)) {
        return res.status(400).json({ error: 'La entidad es obligatoria. El gasto fantasma ha sido rechazado.' });
    }

    try {
        if (req.user && req.user.role !== 'admin') {
            const [check] = await pool.query("SELECT id FROM dashboard_data WHERE id = ? AND user_id = ?", [id, req.user.id]);
            if (check.length === 0) return res.status(403).json({ error: 'Unauthorized to edit this row' });
        }

        // CAPEX restriction: capex-only users (Edwin) can ONLY register CAPEX operations
        if (req.user && req.user.is_capex_only && entidad !== 'CAPEX') {
            return res.status(403).json({ error: 'Solo puedes registrar operaciones CAPEX' });
        }

        // OPEX restriction: non-capex, non-admin users CANNOT register CAPEX operations
        if (req.user && !req.user.is_capex_only && req.user.role !== 'admin' && entidad === 'CAPEX') {
            return res.status(403).json({ error: 'No tienes permiso para registrar operaciones CAPEX' });
        }

        const monto = parseMoneyValue(monto_value);
        const dateToUse = expense_date || new Date().toISOString().split('T')[0];
        const type = entidad === 'CAPEX' ? 'CAPEX' : 'OPEX';

        // Retrieve target user for accurate reporting attribution
        const [dashRow] = await pool.query("SELECT user_id, name FROM dashboard_data WHERE id = ?", [id]);
        const targetUserId = (dashRow.length > 0 && dashRow[0].user_id) ? dashRow[0].user_id : req.user.id;
        const targetName = dashRow.length > 0 ? dashRow[0].name : 'Admin';

        // Insert into historical expenses table bounded to the active period
        const [periodRows] = await pool.query("SELECT id FROM month_periods WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
        const activePeriodId = periodRows.length > 0 ? periodRows[0].id : null;

        if (!activePeriodId) {
            return res.status(400).json({ error: '⚠️ ERROR CRÍTICO: No tienes ningún "Mes" abierto. Por favor, dirígete a Configuraciones y pulsa en "INICIO DE MES" para habilitar la caja antes de registrar gastos.' });
        }

        await pool.query(
            "INSERT INTO expenses (user_id, type, entidad, activos, ticket_number, ot_number, monto, expense_date, period_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [targetUserId, type, entidad || '', activos || '', ticket_value || null, ot_value || '', monto, dateToUse, activePeriodId]
        );

        // Update dashboard status (current row view)
        await pool.query(
            "UPDATE dashboard_data SET ticket_value = ?, ot_value = ?, monto_value = ?, entidad = ?, activos = ? WHERE id = ?",
            [ticket_value || '', ot_value || '', monto_value || '', entidad || '', activos || '', id]
        );

        await logActionSafely(
            req.user.id,
            'Expense Added',
            `Registro en ${targetName} - ${type} (Ticket: ${ticket_value || 'N/A'}, Entidad: ${entidad || 'N/A'}, Activos: ${activos || 'N/A'}, OT: ${ot_value || '0'}, Monto: ${monto_value || '0'}, Fecha: ${dateToUse})`
        );

        if (clear_after_save) {
            await pool.query(
                "UPDATE dashboard_data SET ticket_value = '', ot_value = '', monto_value = '', entidad = '', activos = '' WHERE id = ?",
                [id]
            );
        }

        io.emit('dashboard_update');
        res.json({ success: true, cleared: !!clear_after_save });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update Total Budget endpoint
app.post('/api/budget/update', authenticateToken, async (req, res) => {
    const { total_budget, opex_plazavea_budget, opex_vivanda_budget, opex_makro_budget, capex_annual_budget, opex_anual_budget } = req.body;

    // Admin can update all budgets
    // is_capex_only users (Edwin) can ONLY update capex_annual_budget
    if (req.user && req.user.role !== 'admin') {
        if (req.user.is_capex_only) {
            // Edwin can only update CAPEX budget
            if (total_budget || opex_plazavea_budget || opex_vivanda_budget || opex_makro_budget || opex_anual_budget) {
                return res.status(403).json({ error: 'Solo puedes actualizar el presupuesto CAPEX' });
            }
            if (!capex_annual_budget) {
                return res.status(400).json({ error: 'capex_annual_budget es requerido' });
            }
        } else {
            return res.status(403).json({ error: 'Admin only' });
        }
    }

    try {
        const updates = [];
        if (total_budget !== undefined) updates.push(['total_budget', total_budget]);
        if (opex_plazavea_budget !== undefined) updates.push(['opex_plazavea_budget', opex_plazavea_budget]);
        if (opex_vivanda_budget !== undefined) updates.push(['opex_vivanda_budget', opex_vivanda_budget]);
        if (opex_makro_budget !== undefined) updates.push(['opex_makro_budget', opex_makro_budget]);
        if (capex_annual_budget !== undefined) updates.push(['capex_annual_budget', capex_annual_budget]);
        if (opex_anual_budget !== undefined) updates.push(['opex_anual_budget', opex_anual_budget]);

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Al menos un presupuesto es requerido' });
        }

        for (const [key, val] of updates) {
            await pool.query(
                "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
                [key, val, val]
            );
        }

        await logActionSafely(req.user.id, 'Budget', `Modificó configuraciones de presupuesto`);

        io.emit('dashboard_update');
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
        // Clear all recorded expenses
        await pool.query("DELETE FROM expenses");

        // Clear all active/past month periods
        await pool.query("DELETE FROM month_periods");

        // Reset dashboard_data rows to empty (keep user rows)
        await pool.query("UPDATE dashboard_data SET ticket_value = '', ot_value = '', monto_value = '', entidad = '', activos = ''");

        // Reset ALL budget settings to 0
        const budgetKeys = ['total_budget', 'opex_plazavea_budget', 'opex_vivanda_budget', 'opex_makro_budget', 'capex_annual_budget', 'opex_anual_budget'];
        for (const key of budgetKeys) {
            await pool.query(
                "INSERT INTO settings (setting_key, setting_value) VALUES (?, '0') ON DUPLICATE KEY UPDATE setting_value = '0'",
                [key]
            );
        }

        // Clear action history
        await pool.query("DELETE FROM action_history");

        await logActionSafely(req.user.id, 'Reset', 'Reinició todos los datos financieros a cero');

        io.emit('dashboard_update');
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

    let userId = null;

    try {
        // Mark as capex_only if username is 'edwin'
        const isCapexOnly = username.toLowerCase().trim() === 'edwin' ? 1 : 0;

        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await pool.query(
            "INSERT INTO users (username, password, role, is_capex_only) VALUES (?, ?, 'user', ?)",
            [username, hashedPassword, isCapexOnly]
        );
        userId = userResult.insertId;

        const [result] = await pool.query(
            "INSERT INTO dashboard_data (name, user_id, entidad) VALUES (?, ?, '')",
            [name, userId]
        );

        await logActionSafely(req.user.id, 'Create User', `Añadió nuevo miembro: ${name}`);

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        if (userId) {
            try { await pool.query("DELETE FROM users WHERE id = ?", [userId]); } catch (_) {}
        }
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Name or Username already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete Team Member endpoint
app.post('/api/dashboard/users/delete', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
        const [dashRows] = await pool.query("SELECT user_id FROM dashboard_data WHERE id = ?", [id]);
        if (dashRows.length === 0) return res.status(404).json({ error: 'Row not found' });

        const targetUserId = dashRows[0].user_id;
        if (targetUserId) {
            await pool.query("DELETE FROM users WHERE id = ?", [targetUserId]);
        } else {
            await pool.query("DELETE FROM dashboard_data WHERE id = ?", [id]);
        }

        await logActionSafely(req.user.id, 'Delete User', 'Eliminó a un miembro de equipo');

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
        const [dashRows] = await pool.query("SELECT user_id FROM dashboard_data WHERE id = ?", [id]);
        if (dashRows.length === 0) return res.status(404).json({ error: 'Row not found' });

        const targetUserId = dashRows[0].user_id;

        if (req.user && req.user.role !== 'admin') {
            if (targetUserId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to change this password' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE users SET password = ?, requires_password_change = 1 WHERE id = ?", [hashedPassword, targetUserId]);

        await logActionSafely(req.user.id, 'Password', 'Modificó la contraseña de un usuario (requiere cambio)');

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Change Own Password endpoint
app.post('/api/users/change-password-own', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'newPassword is required' });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            "UPDATE users SET password = ?, requires_password_change = 0, password_last_changed = NOW() WHERE id = ?",
            [hashedPassword, req.user.id]
        );
        await logActionSafely(req.user.id, 'Password', 'El usuario actualizó su propia contraseña');
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

// --- PERIOD ENDPOINTS ---

// POST /api/period/start — Admin marks the start of a new month cycle
app.post('/api/period/start', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    try {
        // Deactivate any existing active period
        await pool.query("UPDATE month_periods SET is_active = 0 WHERE is_active = 1");

        // Fetch current budgets/remaining
        const [settingsRows] = await pool.query("SELECT setting_key, setting_value FROM settings");
        const settings = {};
        settingsRows.forEach(s => settings[s.setting_key] = s.setting_value);

        const opexAnualBudget = parseMoneyValue(settings['opex_anual_budget'] || '0');
        const plazaveaBudget = parseMoneyValue(settings['opex_plazavea_budget'] || '0');
        const vivandaBudget = parseMoneyValue(settings['opex_vivanda_budget'] || '0');
        const makroBudget = parseMoneyValue(settings['opex_makro_budget'] || '0');
        const capexBudget = parseMoneyValue(settings['capex_annual_budget'] || '0');

        // Snapshot: remaining values at start of period is simply the budgets in settings, as they start fresh
        const now = new Date();
        const [insertResult] = await pool.query(
            `INSERT INTO month_periods 
             (start_date, start_opex_anual, start_opex_plazavea, start_opex_vivanda, start_opex_makro, start_capex, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
                now.toISOString().split('T')[0],
                opexAnualBudget,
                plazaveaBudget,
                vivandaBudget,
                makroBudget,
                capexBudget
            ]
        );

        await logActionSafely(req.user.id, 'Inicio de Mes', `Inició nuevo período mensual el ${now.toISOString().split('T')[0]}`);

        io.emit('dashboard_update');
        res.json({ success: true, period_id: insertResult.insertId, start_date: now.toISOString().split('T')[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// POST /api/period/end — Admin marks the end of the active month cycle
app.post('/api/period/end', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    try {
        const [periodRows] = await pool.query("SELECT * FROM month_periods WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
        if (periodRows.length === 0) {
            return res.status(400).json({ error: 'No hay un período activo. Presiona INICIO DE MES primero.' });
        }
        const period = periodRows[0];

        // Fetch current budgets
        const [settingsRows] = await pool.query("SELECT setting_key, setting_value FROM settings");
        const settings = {};
        settingsRows.forEach(s => settings[s.setting_key] = s.setting_value);

        const opexAnualBudget = parseMoneyValue(settings['opex_anual_budget'] || '0');
        const plazaveaBudget = parseMoneyValue(settings['opex_plazavea_budget'] || '0');
        const vivandaBudget = parseMoneyValue(settings['opex_vivanda_budget'] || '0');
        const makroBudget = parseMoneyValue(settings['opex_makro_budget'] || '0');
        const capexBudget = parseMoneyValue(settings['capex_annual_budget'] || '0');

        // Calculate spending since start of period
        const periodStart = period.start_date instanceof Date
            ? period.start_date.toISOString().split('T')[0]
            : String(period.start_date).split('T')[0];
        const now = new Date();
        const periodEnd = now.toISOString().split('T')[0];

        const [periodExpenses] = await pool.query(
            "SELECT entidad, monto, type FROM expenses WHERE period_id = ?",
            [period.id]
        );

        let spentPlazavea = 0, spentVivanda = 0, spentMakro = 0, spentCapex = 0;
        periodExpenses.forEach(r => {
            if (r.type === 'OPEX') {
                if (r.entidad === 'Plaza Vea') spentPlazavea += Number(r.monto);
                else if (r.entidad === 'Vivanda') spentVivanda += Number(r.monto);
                else if (r.entidad === 'Makro') spentMakro += Number(r.monto);
            } else if (r.type === 'CAPEX') {
                spentCapex += Number(r.monto);
            }
        });

        const totalOpexSpent = spentPlazavea + spentVivanda + spentMakro;

        // The remaining budget permanently recorded for this period
        const endOpexAnual = opexAnualBudget - totalOpexSpent;
        const endPlazavea = plazaveaBudget - spentPlazavea;
        const endVivanda = vivandaBudget - spentVivanda;
        const endMakro = makroBudget - spentMakro;
        const endCapex = capexBudget - spentCapex;

        await pool.query(
            `UPDATE month_periods SET 
             end_date = ?, is_active = 0,
             end_opex_anual = ?, end_opex_plazavea = ?, end_opex_vivanda = ?, end_opex_makro = ?, end_capex = ?,
             spent_plazavea = ?, spent_vivanda = ?, spent_makro = ?, spent_capex = ?
             WHERE id = ?`,
            [
                periodEnd,
                endOpexAnual, endPlazavea, endVivanda, endMakro, endCapex,
                spentPlazavea, spentVivanda, spentMakro, spentCapex,
                period.id
            ]
        );

        await logActionSafely(req.user.id, 'Fin de Mes', `Cerró el período mensual (${periodStart} → ${periodEnd})`);

        // Freeze remaining budgets for the next period
        // Specific entities return to 0 for a fresh month budget
        // Annual budgets inherit their remaining values from this month
        const newSettings = [
            ['opex_anual_budget', endOpexAnual.toString()],
            ['opex_plazavea_budget', '0'],
            ['opex_vivanda_budget', '0'],
            ['opex_makro_budget', '0'],
            ['capex_annual_budget', endCapex.toString()]
        ];

        for (const [key, val] of newSettings) {
            await pool.query(
                "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
                [key, val, val]
            );
        }

        // Return full balance data for Excel
        const balance = {
            period_id: period.id,
            start_date: periodStart,
            end_date: periodEnd,
            start: {
                opex_anual: Number(period.start_opex_anual),
                plazavea: Number(period.start_opex_plazavea),
                vivanda: Number(period.start_opex_vivanda),
                makro: Number(period.start_opex_makro),
                capex: Number(period.start_capex)
            },
            end: {
                opex_anual: endOpexAnual,
                plazavea: endPlazavea,
                vivanda: endVivanda,
                makro: endMakro,
                capex: endCapex
            },
            spent: {
                plazavea: spentPlazavea,
                vivanda: spentVivanda,
                makro: spentMakro,
                capex: spentCapex,
                total: totalOpexSpent + spentCapex
            }
        };

        io.emit('dashboard_update');
        res.json({ success: true, balance });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// GET /api/period/history — Admin can fetch all past periods for Excel
app.get('/api/period/history', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    try {
        const [rows] = await pool.query("SELECT * FROM month_periods ORDER BY id DESC");
        res.json({ periods: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/expenses — Admin fetches all expense records
app.get('/api/expenses', authenticateToken, async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    try {
        const [rows] = await pool.query(
            `SELECT e.*, u.username FROM expenses e 
             LEFT JOIN users u ON e.user_id = u.id
             ORDER BY e.expense_date DESC, e.created_at DESC`
        );
        res.json({ expenses: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
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
app.get('/api/summary', async (req, res) => {
    try {
        const [settingsRows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'total_budget'");
        const total_budget = settingsRows.length > 0 ? parseFloat(settingsRows[0].setting_value) || 0 : 0;

        const [dashRows] = await pool.query("SELECT monto_value FROM dashboard_data");
        let total_spent = 0;
        dashRows.forEach(row => {
            if (row.monto_value) {
                const val = parseFloat(row.monto_value.replace(/,/g, ''));
                if (!isNaN(val)) total_spent += val;
            }
        });

        const remaining = total_budget - total_spent;

        res.json({
            total_budget,
            total_spent,
            remaining
        });
    } catch (err) {
        console.error('Error fetching summary:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
