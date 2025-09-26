import { pool } from '../config/postgresql.js';

export class AuditTrail {
  static async create({ 
    exportedByUserId, 
    auditName, 
    startTime, 
    endTime, 
    sourceLogIds, 
    details 
  }) {
    const result = await pool.query(
      `INSERT INTO audit_trail 
       (exported_by_user_id, audit_name, start_time, end_time, source_log_ids, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [exportedByUserId, auditName, startTime, endTime, sourceLogIds, details]
    );
    return result.rows[0];
  }

  static async findById(auditId) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE at.audit_id = $1
    `, [auditId]);
    return result.rows[0];
  }

  static async findByExportedBy(exportedByUserId, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE at.exported_by_user_id = $1
      ORDER BY at.created_at DESC
      LIMIT $2 OFFSET $3
    `, [exportedByUserId, limit, offset]);
    return result.rows;
  }

  static async getAll(limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      ORDER BY at.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  }

  static async getByTimeRange(startDate, endDate, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE at.created_at BETWEEN $1 AND $2
      ORDER BY at.created_at DESC
      LIMIT $3 OFFSET $4
    `, [startDate, endDate, limit, offset]);
    return result.rows;
  }

  static async getAuditStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_audits,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as audits_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as audits_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as audits_this_month,
        COUNT(DISTINCT exported_by_user_id) as unique_exporters
      FROM audit_trail
    `);
    return result.rows[0];
  }

  static async searchAudits(searchTerm, filters = {}, limit = 100, offset = 0) {
    let query = `
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (searchTerm) {
      paramCount++;
      query += ` AND (
        at.audit_name ILIKE $${paramCount} OR 
        u.username ILIKE $${paramCount} OR 
        at.details::text ILIKE $${paramCount}
      )`;
      params.push(`%${searchTerm}%`);
    }
    
    if (filters.exportedByUserId) {
      paramCount++;
      query += ` AND at.exported_by_user_id = $${paramCount}`;
      params.push(filters.exportedByUserId);
    }
    
    if (filters.startDate && filters.endDate) {
      paramCount++;
      query += ` AND at.created_at BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramCount++;
    }
    
    query += ` ORDER BY at.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getAuditDetails(auditId) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email,
        jsonb_array_length(at.source_log_ids) as log_count
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE at.audit_id = $1
    `, [auditId]);
    return result.rows[0];
  }

  static async getRecentAudits(limit = 10) {
    const result = await pool.query(`
      SELECT 
        at.audit_id,
        at.audit_name,
        at.created_at,
        u.username as exported_by_username,
        jsonb_array_length(at.source_log_ids) as log_count
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      ORDER BY at.created_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  static async getAuditSummary() {
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as audit_date,
        COUNT(*) as audit_count,
        SUM(jsonb_array_length(source_log_ids)) as total_logs_exported
      FROM audit_trail
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY audit_date DESC
    `);
    return result.rows;
  }

  static async getTopExporters(limit = 10) {
    const result = await pool.query(`
      SELECT 
        at.exported_by_user_id,
        u.username,
        u.email,
        COUNT(*) as export_count,
        SUM(jsonb_array_length(at.source_log_ids)) as total_logs_exported
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE at.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY at.exported_by_user_id, u.username, u.email
      ORDER BY export_count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  static async getAuditByIds(auditIds) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      WHERE at.audit_id = ANY($1)
      ORDER BY at.created_at DESC
    `, [auditIds]);
    return result.rows;
  }

  static async getAuditCount() {
    const result = await pool.query('SELECT COUNT(*) as count FROM audit_trail');
    return parseInt(result.rows[0].count);
  }

  static async getAuditByIdsWithLogs(auditIds) {
    const result = await pool.query(`
      SELECT 
        at.*,
        u.username as exported_by_username,
        u.email as exported_by_email,
        jsonb_agg(
          jsonb_build_object(
            'log_id', ual.log_id,
            'action_type', ual.action_type,
            'timestamp', ual.timestamp,
            'status', ual.status,
            'username', u2.username,
            'details', ual.details
          ) ORDER BY ual.timestamp DESC
        ) as activity_logs
      FROM audit_trail at
      LEFT JOIN users u ON at.exported_by_user_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT ual.*, u2.username
        FROM user_activity_log ual
        LEFT JOIN users u2 ON ual.user_id = u2.user_id
        WHERE ual.log_id = ANY(
          SELECT jsonb_array_elements_text(at.source_log_ids)::int
        )
      ) ual ON true
      WHERE at.audit_id = ANY($1)
      GROUP BY at.audit_id, u.username, u.email
      ORDER BY at.created_at DESC
    `, [auditIds]);
    return result.rows;
  }
}
