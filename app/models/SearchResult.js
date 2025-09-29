import { pool } from '../config/postgresql.js';

export class SearchResult {
  constructor(data) {
    this.result_id = data.result_id;
    this.search_id = data.search_id;
    this.video_id = data.video_id;
    this.segment_id = data.segment_id;
    this.score = data.score;
    this.thumbnail_url = data.thumbnail_url;
    this.video_timestamp = data.video_timestamp;
    this.match_metadata = data.match_metadata;
    this.created_at = data.created_at;
  }

  static async create(data) {
    const query = `
      INSERT INTO search_results (search_id, video_id, segment_id, score, thumbnail_url, video_timestamp, match_metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.search_id,
      data.video_id,
      data.segment_id,
      data.score,
      data.thumbnail_url,
      data.video_timestamp,
      data.match_metadata ? JSON.stringify(data.match_metadata) : null
    ];
    
    try {
      const result = await pool.query(query, values);
      return new SearchResult(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating search result: ${error.message}`);
    }
  }

  static async findBySearchId(search_id, limit = 50, offset = 0) {
    const query = `
      SELECT sr.*, 
             v.file_name,
             v.original_name,
             v.upload_time,
             vs.start_time_sec,
             vs.end_time_sec
      FROM search_results sr
      LEFT JOIN videos v ON sr.video_id = v.video_id
      LEFT JOIN video_segments vs ON sr.segment_id = vs.segment_id
      WHERE sr.search_id = $1 
      ORDER BY sr.score DESC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [search_id, limit, offset]);
      return result.rows.map(row => ({
        ...new SearchResult(row),
        video_file_name: row.file_name,
        video_original_name: row.original_name,
        video_upload_time: row.upload_time,
        segment_start_time: row.start_time_sec,
        segment_end_time: row.end_time_sec
      }));
    } catch (error) {
      throw new Error(`Error finding search results: ${error.message}`);
    }
  }

  static async findById(result_id) {
    const query = `
      SELECT sr.*, 
             v.file_name,
             v.original_name,
             v.upload_time,
             vs.start_time_sec,
             vs.end_time_sec
      FROM search_results sr
      LEFT JOIN videos v ON sr.video_id = v.video_id
      LEFT JOIN video_segments vs ON sr.segment_id = vs.segment_id
      WHERE sr.result_id = $1
    `;
    
    try {
      const result = await pool.query(query, [result_id]);
      return result.rows[0] ? {
        ...new SearchResult(result.rows[0]),
        video_file_name: result.rows[0].file_name,
        video_original_name: result.rows[0].original_name,
        video_upload_time: result.rows[0].upload_time,
        segment_start_time: result.rows[0].start_time_sec,
        segment_end_time: result.rows[0].end_time_sec
      } : null;
    } catch (error) {
      throw new Error(`Error finding search result: ${error.message}`);
    }
  }

  static async getAnalytics(timeRange = '7d') {
    let timeCondition = '';
    switch (timeRange) {
      case '1d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '1 day'";
        break;
      case '7d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '90 days'";
        break;
    }

    const query = `
      SELECT 
        COUNT(*) as total_results,
        AVG(sr.score) as avg_score,
        COUNT(DISTINCT sr.search_id) as searches_with_results,
        COUNT(DISTINCT sr.video_id) as videos_with_results
      FROM search_results sr
      WHERE sr.created_at IS NOT NULL ${timeCondition}
    `;

    try {
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting search result analytics: ${error.message}`);
    }
  }

  static async getTopResults(limit = 10, timeRange = '7d') {
    let timeCondition = '';
    switch (timeRange) {
      case '1d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '1 day'";
        break;
      case '7d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        timeCondition = "AND sr.created_at >= NOW() - INTERVAL '90 days'";
        break;
    }

    const query = `
      SELECT sr.*, 
             v.file_name,
             v.original_name,
             s.query_text,
             s.query_type
      FROM search_results sr
      LEFT JOIN videos v ON sr.video_id = v.video_id
      LEFT JOIN searches s ON sr.search_id = s.search_id
      WHERE sr.created_at IS NOT NULL ${timeCondition}
      ORDER BY sr.score DESC
      LIMIT $1
    `;

    try {
      const result = await pool.query(query, [limit]);
      return result.rows.map(row => ({
        ...new SearchResult(row),
        video_file_name: row.file_name,
        video_original_name: row.original_name,
        query_text: row.query_text,
        query_type: row.query_type
      }));
    } catch (error) {
      throw new Error(`Error getting top results: ${error.message}`);
    }
  }
}
