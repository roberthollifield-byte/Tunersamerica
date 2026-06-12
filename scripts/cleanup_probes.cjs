// One-time cleanup: remove any "deploy-probe-*@example.com" users from prod DB.
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const useSsl = !url.includes('railway.internal');
const client = new Client({
  connectionString: url,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    await client.connect();
    const before = await client.query(
      `SELECT id, email FROM users WHERE email LIKE 'deploy-probe-%@example.com'`
    );
    console.log('Matching rows before delete:', before.rowCount);
    for (const r of before.rows) console.log('  -', r.id, r.email);

    const del = await client.query(
      `DELETE FROM users WHERE email LIKE 'deploy-probe-%@example.com'`
    );
    console.log('Deleted rows:', del.rowCount);

    const after = await client.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE email LIKE 'deploy-probe-%@example.com'`
    );
    console.log('Remaining matching rows:', after.rows[0].n);
  } catch (e) {
    console.error('Cleanup error:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
