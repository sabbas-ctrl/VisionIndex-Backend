import { pool } from '../config/postgresql.js';

export class AnalyticsAggregation {
  constructor(data) {
    this.aggregation_id = data.aggregation_id;
    this.metric_name = data.metric_name;
    this.metric_type = data.metric_type;
    this.time_bucket = data.time_bucket;
    this.time_granularity = data.time_granularity;
    this.value = data.value;
    this.metadata = data.metadata;
    this.created_at = data.created_at;
  }

  static async createOrUpdate(data) {
    const query = `
      INSERT INTO analytics_aggregations (metric_name, metric_type, time_bucket, time_granularity, value, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (metric_name, time_bucket, time_granularity)
      DO UPDATE SET 
        value = EXCLUDED.value,
        metadata = EXCLUDED.metadata,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      data.metric_name,
      data.metric_type,
      data.time_bucket,
      data.time_granularity,
      data.value,
      data.metadata ? JSON.stringify(data.metadata) : null
    ];
    
    try {
      const result = await pool.query(query, values);
      return new AnalyticsAggregation(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating/updating analytics aggregation: ${error.message}`);
    }
  }

  static async getMetric(metric_name, time_granularity = 'hour', timeRange = '7d') {
    let timeCondition = '';
    switch (timeRange) {
      case '1d':
        timeCondition = "AND time_bucket >= NOW() - INTERVAL '1 day'";
        break;
      case '7d':
        timeCondition = "AND time_bucket >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND time_bucket >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        timeCondition = "AND time_bucket >= NOW() - INTERVAL '90 days'";
        break;
    }

    const query = `
      SELECT time_bucket, value, metadata
      FROM analytics_aggregations 
      WHERE metric_name = $1 
        AND time_granularity = $2 
        ${timeCondition}
      ORDER BY time_bucket ASC
    `;

    try {
      const result = await pool.query(query, [metric_name, time_granularity]);
      return result.rows.map(row => ({
        time_bucket: row.time_bucket,
        value: parseFloat(row.value),
        metadata: row.metadata
      }));
    } catch (error) {
      throw new Error(`Error getting metric: ${error.message}`);
    }
  }

  static async getDashboardMetrics(timeRange = '7d') {
    const metrics = [
      'total_detections_today',
      'videos_uploaded_this_week',
      'unique_persons_detected',
      'searches_performed_today',
      'tool_usage_count',
      'daily_usage_time_hours',
      'weekly_usage_time_hours',
      'avg_video_length_minutes'
    ];

    const results = {};
    
    for (const metric of metrics) {
      try {
        const data = await this.getMetric(metric, 'day', timeRange);
        results[metric] = data;
      } catch (error) {
        console.error(`Error getting metric ${metric}:`, error.message);
        results[metric] = [];
      }
    }

    return results;
  }

  static async calculateAndStoreMetrics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));

    try {
      // Calculate total detections today
      const detectionsToday = await pool.query(`
        SELECT COUNT(*) as count
        FROM detection_events 
        WHERE DATE(created_at) = CURRENT_DATE
      `);

      await this.createOrUpdate({
        metric_name: 'total_detections_today',
        metric_type: 'counter',
        time_bucket: today,
        time_granularity: 'day',
        value: detectionsToday.rows[0].count
      });

      // Calculate videos uploaded this week
      const videosThisWeek = await pool.query(`
        SELECT COUNT(*) as count
        FROM videos 
        WHERE upload_time >= $1
      `, [thisWeek]);

      await this.createOrUpdate({
        metric_name: 'videos_uploaded_this_week',
        metric_type: 'counter',
        time_bucket: thisWeek,
        time_granularity: 'week',
        value: videosThisWeek.rows[0].count
      });

      // Calculate unique persons detected
      const uniquePersons = await pool.query(`
        SELECT COUNT(DISTINCT video_id) as count
        FROM detection_events 
        WHERE detection_type = 'person' 
          AND created_at >= $1
      `, [thisWeek]);

      await this.createOrUpdate({
        metric_name: 'unique_persons_detected',
        metric_type: 'gauge',
        time_bucket: thisWeek,
        time_granularity: 'week',
        value: uniquePersons.rows[0].count
      });

      // Calculate searches performed today
      const searchesToday = await pool.query(`
        SELECT COUNT(*) as count
        FROM searches 
        WHERE DATE(created_at) = CURRENT_DATE
      `);

      await this.createOrUpdate({
        metric_name: 'searches_performed_today',
        metric_type: 'counter',
        time_bucket: today,
        time_granularity: 'day',
        value: searchesToday.rows[0].count
      });

      // Calculate tool usage count (total searches)
      const totalSearches = await pool.query(`
        SELECT COUNT(*) as count
        FROM searches 
        WHERE created_at >= $1
      `, [new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))]);

      await this.createOrUpdate({
        metric_name: 'tool_usage_count',
        metric_type: 'counter',
        time_bucket: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)),
        time_granularity: 'month',
        value: totalSearches.rows[0].count
      });

      // Calculate average video length
      const avgVideoLength = await pool.query(`
        SELECT AVG(EXTRACT(EPOCH FROM duration) / 60) as avg_minutes
        FROM videos 
        WHERE duration IS NOT NULL
      `);

      if (avgVideoLength.rows[0].avg_minutes) {
        await this.createOrUpdate({
          metric_name: 'avg_video_length_minutes',
          metric_type: 'gauge',
          time_bucket: today,
          time_granularity: 'day',
          value: avgVideoLength.rows[0].avg_minutes
        });
      }

      console.log('Analytics metrics calculated and stored successfully');
    } catch (error) {
      console.error('Error calculating analytics metrics:', error.message);
      throw error;
    }
  }
}
