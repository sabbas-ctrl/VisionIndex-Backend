import { pool } from '../config/postgresql.js';

export class UserActivityLog {
  static async create({ 
    userId, 
    sessionId, 
    actionType, 
    targetId = null, 
    ipAddress = null, 
    status = 'success', 
    details = null 
  }) {
    const result = await pool.query(
      `INSERT INTO user_activity_log 
       (user_id, session_id, action_type, target_id, ip_address, status, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, sessionId, actionType, targetId, ipAddress, status, details]
    );
    return result.rows[0];
  }

  static async findById(logId) {
    const result = await pool.query(
      'SELECT * FROM user_activity_log WHERE log_id = $1',
      [logId]
    );
    return result.rows[0];
  }

  static async findByUserId(userId, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      WHERE ual.user_id = $1
      ORDER BY ual.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    return result.rows;
  }

  static async findBySessionId(sessionId, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      WHERE ual.session_id = $1
      ORDER BY ual.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [sessionId, limit, offset]);
    return result.rows;
  }

  static async findByActionType(actionType, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      WHERE ual.action_type = $1
      ORDER BY ual.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [actionType, limit, offset]);
    return result.rows;
  }

  static async findByStatus(status, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      WHERE ual.status = $1
      ORDER BY ual.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [status, limit, offset]);
    return result.rows;
  }

  static async getRecentActivity(limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      ORDER BY ual.timestamp DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  }

  static async getActivityStats(userId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_activities,
        COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as activities_today,
        COUNT(DISTINCT user_id) as active_users,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
           NULLIF(COUNT(*), 0) * 100), 2
        ) as system_health
      FROM user_activity_log
    `;
    
    const params = [];
    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }
    
    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async getActivityByTimeRange(startDate, endDate, userId = null) {
    let query = `
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      WHERE ual.timestamp BETWEEN $1 AND $2
    `;
    
    const params = [startDate, endDate];
    if (userId) {
      query += ' AND ual.user_id = $3';
      params.push(userId);
    }
    
    query += ' ORDER BY ual.timestamp DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getActivitySummary() {
    const result = await pool.query(`
      SELECT 
        action_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'failure') as failure_count,
        COUNT(*) FILTER (WHERE status = 'warning') as warning_count
      FROM user_activity_log
      WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY action_type
      ORDER BY count DESC
    `);
    return result.rows;
  }

  static async getTopUsers(limit = 10) {
    const result = await pool.query(`
      SELECT 
        ual.user_id,
        u.username,
        u.email,
        r.role_name,
        COUNT(*) as activity_count,
        COUNT(*) FILTER (WHERE ual.timestamp >= CURRENT_DATE) as today_activities
      FROM user_activity_log ual
      JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE ual.timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY ual.user_id, u.username, u.email, r.role_name
      ORDER BY activity_count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  static async searchActivity(searchTerm, filters = {}, limit = 100, offset = 0) {
    let query = `
      SELECT 
        ual.*,
        u.username,
        r.role_name,
        us.device_info
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_sessions us ON ual.session_id = us.session_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (searchTerm) {
      paramCount++;
      query += ` AND (
        u.username ILIKE $${paramCount} OR 
        ual.action_type ILIKE $${paramCount} OR 
        ual.details::text ILIKE $${paramCount}
      )`;
      params.push(`%${searchTerm}%`);
    }
    
    if (filters.userId) {
      paramCount++;
      query += ` AND ual.user_id = $${paramCount}`;
      params.push(filters.userId);
    }
    
    if (filters.actionType) {
      paramCount++;
      query += ` AND ual.action_type = $${paramCount}`;
      params.push(filters.actionType);
    }
    
    if (filters.status) {
      paramCount++;
      query += ` AND ual.status = $${paramCount}`;
      params.push(filters.status);
    }
    
    if (filters.startDate && filters.endDate) {
      paramCount++;
      query += ` AND ual.timestamp BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramCount++;
    }
    
    query += ` ORDER BY ual.timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async delete(logId) {
    const result = await pool.query(
      'DELETE FROM user_activity_log WHERE log_id = $1 RETURNING *',
      [logId]
    );
    return result.rows[0];
  }

  static async cleanupOldLogs(daysOld = 90) {
    const result = await pool.query(`
      DELETE FROM user_activity_log 
      WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
      RETURNING log_id
    `);
    return result.rows;
  }
}
