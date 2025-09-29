import { pool } from '../config/postgresql.js';

export class UploadSession {
  constructor(data) {
    this.upload_session_id = data.upload_session_id;
    this.user_id = data.user_id;
    this.video_id = data.video_id;
    this.upload_started = data.upload_started;
    this.upload_completed = data.upload_completed;
    this.processing_started = data.processing_started;
    this.processing_completed = data.processing_completed;
    this.status = data.status;
    this.failure_reason = data.failure_reason;
    this.metadata = data.metadata;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(data) {
    const query = `
      INSERT INTO upload_sessions (user_id, video_id, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [data.user_id, data.video_id, data.status || 'uploading', data.metadata];
    
    try {
      const result = await pool.query(query, values);
      return new UploadSession(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating upload session: ${error.message}`);
    }
  }

  static async findById(upload_session_id) {
    const query = 'SELECT * FROM upload_sessions WHERE upload_session_id = $1';
    
    try {
      const result = await pool.query(query, [upload_session_id]);
      return result.rows[0] ? new UploadSession(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding upload session: ${error.message}`);
    }
  }

  static async findByUserId(user_id, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM upload_sessions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [user_id, limit, offset]);
      return result.rows.map(row => new UploadSession(row));
    } catch (error) {
      throw new Error(`Error finding upload sessions by user: ${error.message}`);
    }
  }

  static async updateStatus(upload_session_id, status, additionalData = {}) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    updates.push(`status = $${paramCount++}`);
    values.push(status);

    if (additionalData.upload_completed) {
      updates.push(`upload_completed = $${paramCount++}`);
      values.push(additionalData.upload_completed);
    }

    if (additionalData.processing_started) {
      updates.push(`processing_started = $${paramCount++}`);
      values.push(additionalData.processing_started);
    }

    if (additionalData.processing_completed) {
      updates.push(`processing_completed = $${paramCount++}`);
      values.push(additionalData.processing_completed);
    }

    if (additionalData.failure_reason) {
      updates.push(`failure_reason = $${paramCount++}`);
      values.push(additionalData.failure_reason);
    }

    if (additionalData.metadata) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(additionalData.metadata));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(upload_session_id);

    const query = `
      UPDATE upload_sessions 
      SET ${updates.join(', ')}
      WHERE upload_session_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0] ? new UploadSession(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error updating upload session: ${error.message}`);
    }
  }

  static async getAnalytics(timeRange = '7d') {
    let timeCondition = '';
    switch (timeRange) {
      case '1d':
        timeCondition = "AND created_at >= NOW() - INTERVAL '1 day'";
        break;
      case '7d':
        timeCondition = "AND created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        timeCondition = "AND created_at >= NOW() - INTERVAL '90 days'";
        break;
    }

    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (processing_completed - processing_started))) as avg_processing_time_seconds
      FROM upload_sessions 
      WHERE created_at IS NOT NULL ${timeCondition}
      GROUP BY status
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting upload analytics: ${error.message}`);
    }
  }
}
