import { pool } from '../config/postgresql.js';

export class Search {
  constructor(data) {
    this.search_id = data.search_id;
    this.user_id = data.user_id;
    this.search_session_id = data.search_session_id;
    this.query_text = data.query_text;
    this.query_type = data.query_type;
    this.query_vector_id = data.query_vector_id;
    this.query_metadata = data.query_metadata;
    this.query_video_id = data.query_video_id;
    this.query_image_id = data.query_image_id;
    this.created_at = data.created_at;
  }

  static async create(data) {
    const query = `
      INSERT INTO searches (user_id, search_session_id, query_text, query_type, query_vector_id, query_metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      data.user_id, 
      data.search_session_id, 
      data.query_text, 
      data.query_type,
      data.query_vector_id,
      data.query_metadata ? JSON.stringify(data.query_metadata) : null
    ];
    
    try {
      const result = await pool.query(query, values);
      return new Search(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating search: ${error.message}`);
    }
  }

  static async findById(search_id) {
    const query = 'SELECT * FROM searches WHERE search_id = $1';
    
    try {
      const result = await pool.query(query, [search_id]);
      return result.rows[0] ? new Search(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding search: ${error.message}`);
    }
  }

  static async findByUserId(user_id, limit = 50, offset = 0) {
    const query = `
      SELECT s.*, 
             ss.title as session_title,
             COUNT(sr.result_id) as result_count
      FROM searches s
      LEFT JOIN search_sessions ss ON s.search_session_id = ss.session_id
      LEFT JOIN search_results sr ON s.search_id = sr.search_id
      WHERE s.user_id = $1 
      GROUP BY s.search_id, s.user_id, s.search_session_id, s.query_text, s.query_type, s.query_vector_id, s.query_metadata, s.created_at, ss.title
      ORDER BY s.created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [user_id, limit, offset]);
      return result.rows.map(row => ({
        ...new Search(row),
        session_title: row.session_title,
        result_count: parseInt(row.result_count)
      }));
    } catch (error) {
      throw new Error(`Error finding searches by user: ${error.message}`);
    }
  }

  static async findBySessionId(session_id, limit = 50, offset = 0) {
    const query = `
      SELECT s.*, 
             COUNT(sr.result_id) as result_count
      FROM searches s
      LEFT JOIN search_results sr ON s.search_id = sr.search_id
      WHERE s.search_session_id = $1 
      GROUP BY s.search_id, s.user_id, s.search_session_id, s.query_text, s.query_type, s.query_vector_id, s.query_metadata, s.created_at
      ORDER BY s.created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [session_id, limit, offset]);
      return result.rows.map(row => ({
        ...new Search(row),
        result_count: parseInt(row.result_count)
      }));
    } catch (error) {
      throw new Error(`Error finding searches by session: ${error.message}`);
    }
  }

  static async getAnalytics(timeRange = '7d', groupBy = 'query_type') {
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

    let groupByField = 'query_type';
    if (groupBy === 'hour') {
      groupByField = "DATE_TRUNC('hour', created_at)";
    } else if (groupBy === 'day') {
      groupByField = "DATE_TRUNC('day', created_at)";
    }

    const query = `
      SELECT 
        ${groupByField} as group_value,
        COUNT(*) as search_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM searches 
      WHERE created_at IS NOT NULL ${timeCondition}
      GROUP BY ${groupByField}
      ORDER BY group_value
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting search analytics: ${error.message}`);
    }
  }

  static async getPopularQueries(limit = 10, timeRange = '7d') {
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
        query_text,
        query_type,
        COUNT(*) as search_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM searches 
      WHERE query_text IS NOT NULL AND query_text != '' ${timeCondition}
      GROUP BY query_text, query_type
      ORDER BY search_count DESC
      LIMIT $1
    `;

    try {
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting popular queries: ${error.message}`);
    }
  }
}
