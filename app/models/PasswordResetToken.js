import crypto from 'crypto';
import { pool } from '../config/postgresql.js';

export class PasswordResetToken {
  static async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token_hash);
    `);
  }

  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static async createForUser(userId, rawToken, expiresMinutes = 30) {
    await this.ensureTable();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
    const result = await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token_hash, expires_at, used, created_at`,
      [userId, tokenHash, expiresAt]
    );
    return result.rows[0];
  }

  static async verifyAndUse(email, rawToken) {
    await this.ensureTable();
    const tokenHash = this.hashToken(rawToken);
    const result = await pool.query(
      `SELECT prt.*, u.user_id, u.email
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.user_id
       WHERE u.email = $1 AND prt.token_hash = $2 AND prt.used = FALSE AND prt.expires_at > CURRENT_TIMESTAMP
       ORDER BY prt.created_at DESC
       LIMIT 1`,
      [email, tokenHash]
    );
    const record = result.rows[0];
    if (!record) return null;
    await pool.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
      [record.id]
    );
    return record;
  }

  static async cleanupExpired() {
    await pool.query(`DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE`);
  }
}

export default PasswordResetToken;


