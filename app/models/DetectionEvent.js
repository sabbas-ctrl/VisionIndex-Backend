import { pool } from '../config/postgresql.js';

export class DetectionEvent {
  constructor(data) {
    this.event_id = data.event_id;
    this.video_id = data.video_id;
    this.segment_id = data.segment_id;
    this.detection_type = data.detection_type;
    this.confidence_score = data.confidence_score;
    this.bounding_box = data.bounding_box;
    this.attributes = data.attributes;
    this.timestamp_in_video = data.timestamp_in_video;
    this.created_at = data.created_at;
  }

  static async create(data) {
    const query = `
      INSERT INTO detection_events (video_id, segment_id, detection_type, confidence_score, bounding_box, attributes, timestamp_in_video)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.video_id,
      data.segment_id,
      data.detection_type,
      data.confidence_score,
      data.bounding_box ? JSON.stringify(data.bounding_box) : null,
      data.attributes ? JSON.stringify(data.attributes) : null,
      data.timestamp_in_video
    ];
    
    try {
      const result = await pool.query(query, values);
      return new DetectionEvent(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating detection event: ${error.message}`);
    }
  }

  static async findByVideoId(video_id, limit = 1000, offset = 0) {
    const query = `
      SELECT de.*, 
             v.file_name,
             vs.start_time_sec,
             vs.end_time_sec
      FROM detection_events de
      LEFT JOIN videos v ON de.video_id = v.video_id
      LEFT JOIN video_segments vs ON de.segment_id = vs.segment_id
      WHERE de.video_id = $1 
      ORDER BY de.timestamp_in_video ASC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [video_id, limit, offset]);
      return result.rows.map(row => ({
        ...new DetectionEvent(row),
        video_file_name: row.file_name,
        segment_start_time: row.start_time_sec,
        segment_end_time: row.end_time_sec
      }));
    } catch (error) {
      throw new Error(`Error finding detection events: ${error.message}`);
    }
  }

  static async getAnalytics(timeRange = '7d', groupBy = 'detection_type') {
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

    let groupByField = 'detection_type';
    if (groupBy === 'hour') {
      groupByField = "DATE_TRUNC('hour', created_at)";
    } else if (groupBy === 'day') {
      groupByField = "DATE_TRUNC('day', created_at)";
    }

    const query = `
      SELECT 
        ${groupByField} as group_value,
        COUNT(*) as detection_count,
        AVG(confidence_score) as avg_confidence,
        COUNT(DISTINCT video_id) as unique_videos
      FROM detection_events 
      WHERE created_at IS NOT NULL ${timeCondition}
      GROUP BY ${groupByField}
      ORDER BY group_value
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting detection analytics: ${error.message}`);
    }
  }

  static async getDetectionsByHour(timeRange = '7d') {
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
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as detections
      FROM detection_events 
      WHERE created_at IS NOT NULL ${timeCondition}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    try {
      const result = await pool.query(query);
      return result.rows.map(row => ({
        hour: `${String(Math.floor(row.hour)).padStart(2, '0')}:00`,
        detections: parseInt(row.detections)
      }));
    } catch (error) {
      throw new Error(`Error getting detections by hour: ${error.message}`);
    }
  }

  static async getObjectTypes(timeRange = '7d') {
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
        detection_type as name,
        COUNT(*) as value
      FROM detection_events 
      WHERE created_at IS NOT NULL ${timeCondition}
      GROUP BY detection_type
      ORDER BY value DESC
    `;

    try {
      const result = await pool.query(query);
      return result.rows.map(row => ({
        name: row.name,
        value: parseInt(row.value)
      }));
    } catch (error) {
      throw new Error(`Error getting object types: ${error.message}`);
    }
  }
}
