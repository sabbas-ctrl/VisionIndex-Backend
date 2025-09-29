import cron from 'node-cron';
import { AnalyticsAggregation } from '../models/AnalyticsAggregation.js';
import { DetectionEvent } from '../models/DetectionEvent.js';
import { Search } from '../models/Search.js';
import { pool } from '../config/postgresql.js';

// Run analytics calculation every hour
const analyticsJob = cron.schedule('0 * * * *', async () => {
  console.log('🔄 Running analytics calculation job...');
  
  try {
    await AnalyticsAggregation.calculateAndStoreMetrics();
    console.log('✅ Analytics metrics calculated successfully');
  } catch (error) {
    console.error('❌ Error calculating analytics metrics:', error.message);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Run detection events aggregation every 15 minutes
const detectionEventsJob = cron.schedule('*/15 * * * *', async () => {
  console.log('🔄 Running detection events aggregation...');
  
  try {
    await aggregateDetectionEvents();
    console.log('✅ Detection events aggregated successfully');
  } catch (error) {
    console.error('❌ Error aggregating detection events:', error.message);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Run system metrics collection every 5 minutes
const systemMetricsJob = cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 Collecting system metrics...');
  
  try {
    await collectSystemMetrics();
    console.log('✅ System metrics collected successfully');
  } catch (error) {
    console.error('❌ Error collecting system metrics:', error.message);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

async function aggregateDetectionEvents() {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  // Get detection events for the current hour
  const result = await pool.query(`
    SELECT 
      detection_type,
      COUNT(*) as count,
      AVG(confidence_score) as avg_confidence
    FROM detection_events 
    WHERE created_at >= $1 AND created_at < $2
    GROUP BY detection_type
  `, [currentHour, new Date(currentHour.getTime() + 60 * 60 * 1000)]);

  // Store aggregated data
  for (const row of result.rows) {
    await AnalyticsAggregation.createOrUpdate({
      metric_name: `detections_${row.detection_type.toLowerCase()}_hourly`,
      metric_type: 'counter',
      time_bucket: currentHour,
      time_granularity: 'hour',
      value: parseInt(row.count),
      metadata: {
        avg_confidence: parseFloat(row.avg_confidence),
        detection_type: row.detection_type
      }
    });
  }
}

async function collectSystemMetrics() {
  const now = new Date();
  
  // Get current system statistics
  const [
    activeUsers,
    totalVideos,
    totalSearches,
    avgProcessingTime
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) as count FROM user_sessions WHERE status = $1', ['active']),
    pool.query('SELECT COUNT(*) as count FROM videos WHERE status = $1', ['completed']),
    pool.query('SELECT COUNT(*) as count FROM searches WHERE created_at >= $1', [new Date(now.getTime() - 24 * 60 * 60 * 1000)]),
    pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (processing_completed - processing_started))) as avg_seconds
      FROM upload_sessions 
      WHERE processing_completed IS NOT NULL 
        AND processing_started IS NOT NULL
        AND created_at >= $1
    `, [new Date(now.getTime() - 24 * 60 * 60 * 1000)])
  ]);

  // Store system metrics
  const metrics = [
    {
      metric_name: 'active_users',
      metric_value: parseInt(activeUsers.rows[0].count),
      unit: 'users',
      tags: { type: 'system' }
    },
    {
      metric_name: 'total_videos_processed',
      metric_value: parseInt(totalVideos.rows[0].count),
      unit: 'videos',
      tags: { type: 'system' }
    },
    {
      metric_name: 'searches_last_24h',
      metric_value: parseInt(totalSearches.rows[0].count),
      unit: 'searches',
      tags: { type: 'system' }
    },
    {
      metric_name: 'avg_processing_time_seconds',
      metric_value: parseFloat(avgProcessingTime.rows[0].avg_seconds) || 0,
      unit: 'seconds',
      tags: { type: 'system' }
    }
  ];

  for (const metric of metrics) {
    await pool.query(`
      INSERT INTO system_metrics (metric_name, metric_value, unit, tags, timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      metric.metric_name,
      metric.metric_value,
      metric.unit,
      JSON.stringify(metric.tags),
      now
    ]);
  }
}

// Start all jobs
export function startAnalyticsJobs() {
  console.log('🚀 Starting analytics jobs...');
  analyticsJob.start();
  detectionEventsJob.start();
  systemMetricsJob.start();
  console.log('✅ Analytics jobs started successfully');
}

// Stop all jobs
export function stopAnalyticsJobs() {
  console.log('🛑 Stopping analytics jobs...');
  analyticsJob.stop();
  detectionEventsJob.stop();
  systemMetricsJob.stop();
  console.log('✅ Analytics jobs stopped successfully');
}

export { analyticsJob, detectionEventsJob, systemMetricsJob };
