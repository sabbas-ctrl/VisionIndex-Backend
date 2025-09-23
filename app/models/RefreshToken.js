import { pool } from '../config/postgresql.js';

export class RefreshToken {
  static async create({ userId, refreshToken, deviceInfo, ipAddress, expiresAt }) {
    const result = await pool.query(
      `INSERT INTO refresh_tokens (user_id, refresh_token, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING token_id, user_id, refresh_token, device_info, ip_address, is_revoked, issued_at, expires_at`,
      [userId, refreshToken, deviceInfo, ipAddress, expiresAt]
    );
    return result.rows[0];
  }

  static async findByToken(refreshToken) {
    const result = await pool.query(
      `SELECT rt.*, u.user_id, u.username, u.email, u.role_id, u.status
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.user_id
       WHERE rt.refresh_token = $1 
       AND rt.is_revoked = FALSE 
       AND rt.expires_at > CURRENT_TIMESTAMP`,
      [refreshToken]
    );
    return result.rows[0];
  }

  static async findByUserId(userId) {
    const result = await pool.query(
      `SELECT * FROM refresh_tokens 
       WHERE user_id = $1 
       AND is_revoked = FALSE 
       AND expires_at > CURRENT_TIMESTAMP
       ORDER BY issued_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async revokeToken(tokenId) {
    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_id = $1',
      [tokenId]
    );
  }

  static async revokeAllUserTokens(userId) {
    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1',
      [userId]
    );
  }

  static async revokeTokenByToken(refreshToken) {
    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE refresh_token = $1',
      [refreshToken]
    );
  }

  static async deleteExpiredTokens() {
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
    );
    return result.rowCount;
  }

  static async deleteRevokedTokens() {
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE is_revoked = TRUE'
    );
    return result.rowCount;
  }

  static async getActiveSessionCount(userId) {
    const result = await pool.query(
      `SELECT COUNT(*) as active_sessions
       FROM refresh_tokens 
       WHERE user_id = $1 
       AND is_revoked = FALSE 
       AND expires_at > CURRENT_TIMESTAMP`,
      [userId]
    );
    return parseInt(result.rows[0].active_sessions);
  }

  static async getTokenInfo(tokenId) {
    const result = await pool.query(
      `SELECT rt.*, u.username, u.email
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.user_id
       WHERE rt.token_id = $1`,
      [tokenId]
    );
    return result.rows[0];
  }
}
