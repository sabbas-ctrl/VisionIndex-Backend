import { pool } from '../config/postgresql.js';

export class UserSession {
  static async create({ userId, deviceInfo, ipAddress, status = 'active' }) {
    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, device_info, ip_address, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, deviceInfo, ipAddress, status]
    );
    return result.rows[0];
  }

  static async findById(sessionId) {
    const result = await pool.query(
      'SELECT * FROM user_sessions WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0];
  }

  static async findByUserId(userId, status = null) {
    let query = 'SELECT * FROM user_sessions WHERE user_id = $1';
    const params = [userId];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY login_time DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findActiveByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM user_sessions WHERE user_id = $1 AND status = $2 ORDER BY login_time DESC',
      [userId, 'active']
    );
    return result.rows;
  }

  static async updateStatus(sessionId, status) {
    const result = await pool.query(
      'UPDATE user_sessions SET status = $1 WHERE session_id = $2 RETURNING *',
      [status, sessionId]
    );
    return result.rows[0];
  }

  static async logout(sessionId) {
    const result = await pool.query(
      `UPDATE user_sessions 
       SET status = 'expired', logout_time = CURRENT_TIMESTAMP 
       WHERE session_id = $1 
       RETURNING *`,
      [sessionId]
    );
    return result.rows[0];
  }

  static async terminateAllUserSessions(userId) {
    const result = await pool.query(
      `UPDATE user_sessions 
       SET status = 'terminated', logout_time = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND status = 'active'
       RETURNING *`,
      [userId]
    );
    return result.rows;
  }

  static async getActiveSessions() {
    const result = await pool.query(`
      SELECT 
        us.*,
        u.username,
        u.email,
        r.role_name
      FROM user_sessions us
      JOIN users u ON us.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE us.status = 'active'
      ORDER BY us.login_time DESC
    `);
    return result.rows;
  }

  static async getSessionStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_sessions,
        COUNT(*) FILTER (WHERE status = 'terminated') as terminated_sessions,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_sessions
    `);
    return result.rows[0];
  }

  static async getSessionsByTimeRange(startDate, endDate) {
    const result = await pool.query(`
      SELECT 
        us.*,
        u.username,
        u.email,
        r.role_name
      FROM user_sessions us
      JOIN users u ON us.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE us.login_time BETWEEN $1 AND $2
      ORDER BY us.login_time DESC
    `, [startDate, endDate]);
    return result.rows;
  }

  static async delete(sessionId) {
    const result = await pool.query(
      'DELETE FROM user_sessions WHERE session_id = $1 RETURNING *',
      [sessionId]
    );
    return result.rows[0];
  }

  static async cleanupExpiredSessions(daysOld = 30) {
    const result = await pool.query(`
      DELETE FROM user_sessions 
      WHERE status IN ('expired', 'terminated') 
      AND logout_time < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
      RETURNING session_id
    `);
    return result.rows;
  }
}
