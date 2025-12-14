import { AnalyticsAggregation } from '../models/AnalyticsAggregation.js';
import { DetectionEvent } from '../models/DetectionEvent.js';
import { Search } from '../models/Search.js';
import { SearchResult } from '../models/SearchResult.js';
import { UploadSession } from '../models/UploadSession.js';
import { SearchSession } from '../models/SearchSession.js';
import { pool } from '../config/postgresql.js';

export class AnalyticsController {
  // Get dashboard metrics
  static async getDashboardMetrics(req, res) {
    try {
      const { timeRange = '7d' } = req.query;

      // Get all dashboard metrics
      const [
        detectionsByHour,
        objectTypes,
        totalDetectionsToday,
        videosUploadedThisWeek,
        uniquePersonsDetected,
        searchesPerformedToday,
        toolUsageCount,
        dailyUsageTime,
        weeklyUsageTime,
        avgVideoLength
      ] = await Promise.all([
        DetectionEvent.getDetectionsByHour(timeRange),
        DetectionEvent.getObjectTypes(timeRange),
        getTotalDetectionsToday(),
        getVideosUploadedThisWeek(),
        getUniquePersonsDetected(timeRange),
        getSearchesPerformedToday(),
        getToolUsageCount(timeRange),
        getDailyUsageTime(timeRange),
        getWeeklyUsageTime(timeRange),
        getAvgVideoLength()
      ]);

      // Calculate changes from previous periods
      const [
        detectionsChange,
        videosChange,
        personsChange,
        searchesChange,
        toolUsageChange,
        dailyTimeChange,
        weeklyTimeChange
      ] = await Promise.all([
        getDetectionsChange(timeRange),
        getVideosChange(timeRange),
        getPersonsChange(timeRange),
        getSearchesChange(timeRange),
        getToolUsageChange(timeRange),
        getDailyTimeChange(timeRange),
        getWeeklyTimeChange(timeRange)
      ]);

      const dashboardData = {
        charts: {
          detectionsByHour,
          objectTypes
        },
        stats: [
          {
            title: "Total Detections Today",
            value: totalDetectionsToday.toLocaleString(),
            change: detectionsChange,
            icon: "Eye"
          },
          {
            title: "Videos Uploaded This Week",
            value: videosUploadedThisWeek.toString(),
            change: videosChange,
            icon: "Video"
          },
          {
            title: "Unique Persons Detected",
            value: uniquePersonsDetected.toLocaleString(),
            change: personsChange,
            icon: "Users"
          },
          {
            title: "Searches Performed Today",
            value: searchesPerformedToday.toString(),
            change: searchesChange,
            icon: "Search"
          },
          {
            title: "Tool Usage Count",
            value: toolUsageCount.toLocaleString(),
            change: toolUsageChange,
            icon: "FileText"
          },
          {
            title: "Daily Usage Time",
            value: `${dailyUsageTime.toFixed(1)}h`,
            change: dailyTimeChange,
            icon: "Clock"
          },
          {
            title: "Weekly Usage Time",
            value: `${weeklyUsageTime.toFixed(1)}h`,
            change: weeklyTimeChange,
            icon: "Calendar"
          },
          {
            title: "Avg Video Length",
            value: `${avgVideoLength.toFixed(1)}m`,
            change: "Per upload session",
            icon: "Video"
          }
        ]
      };

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving dashboard metrics',
        error: error.message
      });
    }
  }

  // Get search history with filters
  static async getSearchHistory(req, res) {
    try {
      const { 
        page = 1, 
        limit = 8, 
        dateRange = 'Today',
        userRole = 'All Roles',
        resultStatus = 'All Results'
      } = req.query;

      const userId = req.user.user_id; // Get from authenticated user
      const offset = (page - 1) * limit;

      // Build date filter
      let dateFilter = '';
      switch (dateRange) {
        case 'Today':
          dateFilter = "AND DATE(s.created_at) = CURRENT_DATE";
          break;
        case 'Yesterday':
          dateFilter = "AND DATE(s.created_at) = CURRENT_DATE - INTERVAL '1 day'";
          break;
        case 'Last 7 Days':
          dateFilter = "AND s.created_at >= NOW() - INTERVAL '7 days'";
          break;
        case 'Last 30 Days':
          dateFilter = "AND s.created_at >= NOW() - INTERVAL '30 days'";
          break;
      }

      // Build role filter
      let roleFilter = '';
      if (userRole !== 'All Roles') {
        roleFilter = `AND u.role_id = (SELECT role_id FROM roles WHERE role_name = '${userRole}')`;
      }

      // Build status filter
      let statusFilter = '';
      if (resultStatus !== 'All Results') {
        const statusValue = resultStatus === 'Match Found' ? 'true' : 'false';
        statusFilter = `AND (SELECT COUNT(*) > 0 FROM search_results sr WHERE sr.search_id = s.search_id) = ${statusValue}`;
      }

      const query = `
        SELECT 
          s.search_id,
          s.query_text,
          s.query_type,
          s.created_at,
          u.username as user,
          r.role_name as role,
          CASE 
            WHEN u.username LIKE '%John%' THEN '👨‍💼'
            WHEN u.username LIKE '%Sarah%' THEN '👩‍💻'
            WHEN u.username LIKE '%Mike%' THEN '👨‍🔬'
            WHEN u.username LIKE '%Emma%' THEN '👩‍🏫'
            WHEN u.username LIKE '%David%' THEN '👨‍💼'
            WHEN u.username LIKE '%Lisa%' THEN '👩‍💻'
            WHEN u.username LIKE '%Robert%' THEN '👨‍🔧'
            WHEN u.username LIKE '%Maria%' THEN '👩‍🔬'
            ELSE '👤'
          END as avatar,
          CASE 
            WHEN (SELECT COUNT(*) > 0 FROM search_results sr WHERE sr.search_id = s.search_id) 
            THEN 'Match Found' 
            ELSE 'No Match' 
          END as status,
          COALESCE(
            (SELECT string_agg(
              CASE 
                WHEN sf.filter_type = 'time_range' THEN 'Time: ' || (sf.filter_value->>'start') || '-' || (sf.filter_value->>'end')
                WHEN sf.filter_type = 'zone' THEN 'Zone: ' || (sf.filter_value->>'zone')
                WHEN sf.filter_type = 'clothing_color' THEN (sf.filter_value->>'color') || ' Clothing'
                WHEN sf.filter_type = 'object_type' THEN 'Type: ' || (sf.filter_value->>'type')
                ELSE sf.filter_type || ': ' || (sf.filter_value->>'value')
              END, 
              ', '
            ) FROM search_filters sf WHERE sf.search_id = s.search_id), 
            'No filters applied'
          ) as filters_used
        FROM searches s
        LEFT JOIN users u ON s.user_id = u.user_id
        LEFT JOIN roles r ON u.role_id = r.role_id
        WHERE s.user_id = $1 ${dateFilter} ${roleFilter} ${statusFilter}
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM searches s
        LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.user_id = $1 ${dateFilter} ${roleFilter} ${statusFilter}
      `;

      const countResult = await pool.query(countQuery, [userId]);
      const totalResults = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalResults / limit);

      const searchResults = result.rows.map(row => ({
        id: row.search_id,
        user: row.user,
        role: row.role,
        avatar: row.avatar,
        queryType: row.query_type,
        filtersUsed: row.filters_used,
        dateTime: new Date(row.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: row.status
      }));

      res.json({
        success: true,
        data: {
          searchResults,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalResults,
            resultsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting search history:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving search history',
        error: error.message
      });
    }
  }

  // Export analytics data
  static async exportAnalytics(req, res) {
    try {
      const { format = 'json', timeRange = '7d' } = req.query;
      const userId = req.user.user_id;

      // Get comprehensive analytics data
      const analyticsData = await getComprehensiveAnalytics(timeRange, userId);

      // Log the export action for audit trail
      const { UserActivityLog } = await import('../models/UserActivityLog.js');
      await UserActivityLog.create({
        userId: userId,
        actionType: 'analytics_export',
        targetId: null,
        status: 'success',
        details: {
          format: format,
          timeRange: timeRange,
          exportType: 'dashboard_analytics',
          dataSize: JSON.stringify(analyticsData).length
        },
        ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      if (format === 'csv') {
        // Convert to CSV format
        const csv = convertToCSV(analyticsData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics_export.csv"');
        res.send(csv);
      } else {
        res.json({
          success: true,
          data: analyticsData,
          exported_at: new Date().toISOString(),
          time_range: timeRange
        });
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      
      // Log the failed export action for audit trail
      try {
        const { UserActivityLog } = await import('../models/UserActivityLog.js');
        await UserActivityLog.create({
          userId: req.user.user_id,
          actionType: 'analytics_export',
          targetId: null,
          status: 'failed',
          details: {
            format: req.query.format || 'json',
            timeRange: req.query.timeRange || '7d',
            exportType: 'dashboard_analytics',
            error: error.message
          },
          ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown'
        });
      } catch (logError) {
        console.error('Failed to log analytics export error:', logError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Error exporting analytics data',
        error: error.message
      });
    }
  }

  // Calculate and store analytics metrics (cron job)
  static async calculateMetrics(req, res) {
    try {
      await AnalyticsAggregation.calculateAndStoreMetrics();
      
      res.json({
        success: true,
        message: 'Analytics metrics calculated and stored successfully'
      });
    } catch (error) {
      console.error('Error calculating metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating analytics metrics',
        error: error.message
      });
    }
  }
}

// Helper functions for dashboard metrics
async function getTotalDetectionsToday() {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM detection_events 
    WHERE DATE(created_at) = CURRENT_DATE
  `);
  return parseInt(result.rows[0].count);
}

async function getVideosUploadedThisWeek() {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM videos 
    WHERE upload_time >= NOW() - INTERVAL '7 days'
  `);
  return parseInt(result.rows[0].count);
}

async function getUniquePersonsDetected(timeRange) {
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
  }

  const result = await pool.query(`
    SELECT COUNT(DISTINCT video_id) as count
    FROM detection_events 
    WHERE detection_type = 'person' ${timeCondition}
  `);
  return parseInt(result.rows[0].count);
}

async function getSearchesPerformedToday() {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM searches 
    WHERE DATE(created_at) = CURRENT_DATE
  `);
  return parseInt(result.rows[0].count);
}

async function getToolUsageCount(timeRange) {
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
  }

  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM searches 
    WHERE created_at IS NOT NULL ${timeCondition}
  `);
  return parseInt(result.rows[0].count);
}

async function getDailyUsageTime(timeRange) {
  // Calculate based on user activity logs
  const result = await pool.query(`
    SELECT AVG(EXTRACT(EPOCH FROM (logout_time - login_time)) / 3600) as avg_hours
    FROM user_sessions 
    WHERE login_time >= NOW() - INTERVAL '1 day'
      AND logout_time IS NOT NULL
  `);
  return parseFloat(result.rows[0].avg_hours) || 0;
}

async function getWeeklyUsageTime(timeRange) {
  const result = await pool.query(`
    SELECT AVG(EXTRACT(EPOCH FROM (logout_time - login_time)) / 3600) as avg_hours
    FROM user_sessions 
    WHERE login_time >= NOW() - INTERVAL '7 days'
      AND logout_time IS NOT NULL
  `);
  return (parseFloat(result.rows[0].avg_hours) || 0) * 7;
}

async function getAvgVideoLength() {
  const result = await pool.query(`
    SELECT AVG(EXTRACT(EPOCH FROM duration) / 60) as avg_minutes
    FROM videos 
    WHERE duration IS NOT NULL
  `);
  return parseFloat(result.rows[0].avg_minutes) || 0;
}

// Helper functions for calculating changes
async function getDetectionsChange(timeRange) {
  const current = await getTotalDetectionsToday();
  const previous = await pool.query(`
    SELECT COUNT(*) as count
    FROM detection_events 
    WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
  `);
  const prevCount = parseInt(previous.rows[0].count);
  const change = prevCount > 0 ? ((current - prevCount) / prevCount * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% from yesterday`;
}

async function getVideosChange(timeRange) {
  const current = await getVideosUploadedThisWeek();
  const previous = await pool.query(`
    SELECT COUNT(*) as count
    FROM videos 
    WHERE upload_time >= NOW() - INTERVAL '14 days'
      AND upload_time < NOW() - INTERVAL '7 days'
  `);
  const prevCount = parseInt(previous.rows[0].count);
  const change = prevCount > 0 ? ((current - prevCount) / prevCount * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% from last week`;
}

async function getPersonsChange(timeRange) {
  const current = await getUniquePersonsDetected(timeRange);
  const previous = await pool.query(`
    SELECT COUNT(DISTINCT video_id) as count
    FROM detection_events 
    WHERE detection_type = 'person' 
      AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
  `);
  const prevCount = parseInt(previous.rows[0].count);
  const change = prevCount > 0 ? ((current - prevCount) / prevCount * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% this week`;
}

async function getSearchesChange(timeRange) {
  const current = await getSearchesPerformedToday();
  const previous = await pool.query(`
    SELECT COUNT(*) as count
    FROM searches 
    WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
  `);
  const prevCount = parseInt(previous.rows[0].count);
  const change = prevCount > 0 ? ((current - prevCount) / prevCount * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% from yesterday`;
}

async function getToolUsageChange(timeRange) {
  const current = await getToolUsageCount(timeRange);
  const previous = await pool.query(`
    SELECT COUNT(*) as count
    FROM searches 
    WHERE created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
  `);
  const prevCount = parseInt(previous.rows[0].count);
  const change = prevCount > 0 ? ((current - prevCount) / prevCount * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% this month`;
}

async function getDailyTimeChange(timeRange) {
  const current = await getDailyUsageTime(timeRange);
  const previous = await pool.query(`
    SELECT AVG(EXTRACT(EPOCH FROM (logout_time - login_time)) / 3600) as avg_hours
    FROM user_sessions 
    WHERE login_time >= NOW() - INTERVAL '2 days'
      AND login_time < NOW() - INTERVAL '1 day'
      AND logout_time IS NOT NULL
  `);
  const prevHours = parseFloat(previous.rows[0].avg_hours) || 0;
  const change = prevHours > 0 ? ((current - prevHours) / prevHours * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)} min from yesterday`;
}

async function getWeeklyTimeChange(timeRange) {
  const current = await getWeeklyUsageTime(timeRange);
  const previous = await pool.query(`
    SELECT AVG(EXTRACT(EPOCH FROM (logout_time - login_time)) / 3600) as avg_hours
    FROM user_sessions 
    WHERE login_time >= NOW() - INTERVAL '14 days'
      AND login_time < NOW() - INTERVAL '7 days'
      AND logout_time IS NOT NULL
  `);
  const prevHours = (parseFloat(previous.rows[0].avg_hours) || 0) * 7;
  const change = prevHours > 0 ? ((current - prevHours) / prevHours * 100) : 0;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}h from last week`;
}

async function getComprehensiveAnalytics(timeRange, userId) {
  try {
    // Get dashboard metrics data directly
    const [
      detectionsByHour,
      objectTypes,
      totalDetectionsToday,
      videosUploadedThisWeek,
      uniquePersonsDetected,
      searchesPerformedToday,
      toolUsageCount,
      dailyUsageTime,
      weeklyUsageTime,
      avgVideoLength
    ] = await Promise.all([
      DetectionEvent.getDetectionsByHour(timeRange),
      DetectionEvent.getObjectTypes(timeRange),
      getTotalDetectionsToday(),
      getVideosUploadedThisWeek(),
      getUniquePersonsDetected(timeRange),
      getSearchesPerformedToday(),
      getToolUsageCount(timeRange),
      getDailyUsageTime(timeRange),
      getWeeklyUsageTime(timeRange),
      getAvgVideoLength()
    ]);

    // Get search history data directly
    const searchQuery = `
      SELECT 
        s.search_id,
        s.query_text,
        s.query_type,
        s.created_at,
        u.username as user,
        r.role_name as role
      FROM searches s
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE s.user_id = $1 AND s.created_at >= NOW() - INTERVAL '${timeRange === '1d' ? '1 day' : timeRange === '7d' ? '7 days' : '30 days'}'
      ORDER BY s.created_at DESC
      LIMIT 50
    `;
    const searchResult = await pool.query(searchQuery, [userId]);

    // Get detection events
    const detectionEvents = await DetectionEvent.getAnalytics(timeRange);

    return {
      timeRange,
      dashboard_metrics: {
        charts: {
          detectionsByHour,
          objectTypes
        },
        stats: [
          {
            title: "Total Detections Today",
            value: totalDetectionsToday.toLocaleString(),
            icon: "Eye"
          },
          {
            title: "Videos Uploaded This Week", 
            value: videosUploadedThisWeek.toString(),
            icon: "Video"
          },
          {
            title: "Unique Persons Detected",
            value: uniquePersonsDetected.toLocaleString(),
            icon: "Users"
          },
          {
            title: "Searches Performed Today",
            value: searchesPerformedToday.toString(),
            icon: "Search"
          },
          {
            title: "Tool Usage Count",
            value: toolUsageCount.toLocaleString(),
            icon: "FileText"
          },
          {
            title: "Daily Usage Time",
            value: `${dailyUsageTime.toFixed(1)}h`,
            icon: "Clock"
          },
          {
            title: "Weekly Usage Time",
            value: `${weeklyUsageTime.toFixed(1)}h`,
            icon: "Calendar"
          },
          {
            title: "Avg Video Length",
            value: `${avgVideoLength.toFixed(1)}m`,
            icon: "Video"
          }
        ]
      },
      search_history: {
        data: searchResult.rows.map(row => ({
          id: row.search_id,
          query: row.query_text,
          query_type: row.query_type,
          user: row.user,
          role: row.role,
          timestamp: row.created_at
        }))
      },
      detection_events: detectionEvents || [],
      system_performance: await getSystemPerformanceMetrics()
    };
  } catch (error) {
    console.error('Error in getComprehensiveAnalytics:', error);
    throw error;
  }
}

async function getSystemPerformanceMetrics() {
  const result = await pool.query(`
    SELECT 
      metric_name,
      AVG(metric_value) as avg_value,
      MAX(metric_value) as max_value,
      MIN(metric_value) as min_value
    FROM system_metrics 
    WHERE timestamp >= NOW() - INTERVAL '1 hour'
    GROUP BY metric_name
  `);
  return result.rows;
}

function convertToCSV(data) {
  const csvRows = [];
  
  // Add metadata
  csvRows.push('Metric,Value,Description');
  csvRows.push(`Export Date,${new Date().toISOString()},Generated on`);
  csvRows.push(`Time Range,${data.timeRange || 'N/A'},Data period`);
  csvRows.push(''); // Empty row
  
  // Add dashboard metrics
  if (data.dashboard_metrics && data.dashboard_metrics.stats) {
    csvRows.push('DASHBOARD METRICS');
    csvRows.push('Metric,Value,Icon');
    
    data.dashboard_metrics.stats.forEach(stat => {
      csvRows.push(`"${stat.title}","${stat.value}","${stat.icon || 'N/A'}"`);
    });
    csvRows.push(''); // Empty row
  }
  
  // Add detection events
  if (data.detection_events && data.detection_events.length > 0) {
    csvRows.push('DETECTION EVENTS');
    csvRows.push('Type,Count,Percentage');
    
    data.detection_events.forEach(event => {
      csvRows.push(`"${event.detection_type || event.name || 'N/A'}","${event.count || event.value || 'N/A'}","${event.percentage || 'N/A'}"`);
    });
    csvRows.push(''); // Empty row
  }
  
  // Add search history
  if (data.search_history && data.search_history.data && data.search_history.data.length > 0) {
    csvRows.push('SEARCH HISTORY');
    csvRows.push('Query,Type,User,Role,Timestamp');
    
    data.search_history.data.forEach(search => {
      csvRows.push(`"${search.query || 'N/A'}","${search.query_type || 'N/A'}","${search.user || 'N/A'}","${search.role || 'N/A'}","${search.timestamp || 'N/A'}"`);
    });
  }
  
  return csvRows.join('\n');
}
