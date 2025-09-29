import { pool } from '../config/postgresql.js';

export class SearchSession {
  constructor(data) {
    this.session_id = data.session_id;
    this.user_id = data.user_id;
    this.title = data.title;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(data) {
    const query = `
      INSERT INTO search_sessions (user_id, title)
      VALUES ($1, $2)
      RETURNING *
    `;
    const values = [data.user_id, data.title];
    
    try {
      const result = await pool.query(query, values);
      return new SearchSession(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating search session: ${error.message}`);
    }
  }

  static async findById(session_id) {
    const query = 'SELECT * FROM search_sessions WHERE session_id = $1';
    
    try {
      const result = await pool.query(query, [session_id]);
      return result.rows[0] ? new SearchSession(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding search session: ${error.message}`);
    }
  }

  static async findByUserId(user_id, limit = 50, offset = 0) {
    const query = `
      SELECT ss.*, 
             COUNT(s.search_id) as search_count,
             MAX(s.created_at) as last_search_at
      FROM search_sessions ss
      LEFT JOIN searches s ON ss.session_id = s.search_session_id
      WHERE ss.user_id = $1 
      GROUP BY ss.session_id, ss.user_id, ss.title, ss.created_at, ss.updated_at
      ORDER BY ss.updated_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [user_id, limit, offset]);
      return result.rows.map(row => ({
        ...new SearchSession(row),
        search_count: parseInt(row.search_count),
        last_search_at: row.last_search_at
      }));
    } catch (error) {
      throw new Error(`Error finding search sessions by user: ${error.message}`);
    }
  }

  static async updateTitle(session_id, title) {
    const query = `
      UPDATE search_sessions 
      SET title = $1, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [title, session_id]);
      return result.rows[0] ? new SearchSession(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error updating search session: ${error.message}`);
    }
  }

  static async delete(session_id) {
    const query = 'DELETE FROM search_sessions WHERE session_id = $1 RETURNING *';
    
    try {
      const result = await pool.query(query, [session_id]);
      return result.rows[0] ? new SearchSession(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error deleting search session: ${error.message}`);
    }
  }

  static async getAnalytics(timeRange = '7d') {
    let timeCondition = '';
    switch (timeRange) {
      case '1d':
        timeCondition = "AND ss.created_at >= NOW() - INTERVAL '1 day'";
        break;
      case '7d':
        timeCondition = "AND ss.created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND ss.created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        timeCondition = "AND ss.created_at >= NOW() - INTERVAL '90 days'";
        break;
    }

    const query = `
      SELECT 
        COUNT(DISTINCT ss.session_id) as total_sessions,
        COUNT(s.search_id) as total_searches,
        AVG(search_counts.searches_per_session) as avg_searches_per_session
      FROM search_sessions ss
      LEFT JOIN searches s ON ss.session_id = s.search_session_id
      LEFT JOIN (
        SELECT search_session_id, COUNT(*) as searches_per_session
        FROM searches
        GROUP BY search_session_id
      ) search_counts ON ss.session_id = search_counts.search_session_id
      WHERE ss.created_at IS NOT NULL ${timeCondition}
    `;

    try {
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting search session analytics: ${error.message}`);
    }
  }
}
