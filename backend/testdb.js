const pool = require('./database.js');
pool.query('SELECT id, type, entidad, monto, period_id FROM expenses ORDER BY id DESC LIMIT 10').then(r => console.log(JSON.stringify(r[0], null, 2))).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
