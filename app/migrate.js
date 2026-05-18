import { pool } from './config/postgresql.js';

async function migrate() {
  try {
    await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_viewed BOOLEAN DEFAULT FALSE;');
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}
migrate();
