import { UserActivityLog } from '../models/UserActivityLog.js';
import { AuditTrail } from '../models/AuditTrail.js';
import { UserSession } from '../models/UserSession.js';
import { pool } from '../config/postgresql.js';

// User Activity Log Controllers
export const getActivityLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      userId, 
      actionType, 
      status, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    const filters = {};

    if (userId) filters.userId = parseInt(userId);
    if (actionType) filters.actionType = actionType;
    if (status) filters.status = status;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
    }

    let logs;
    if (search) {
      logs = await UserActivityLog.searchActivity(search, filters, parseInt(limit), offset);
    } else if (Object.keys(filters).length > 0) {
      // Apply filters even without search
      logs = await UserActivityLog.getFilteredActivity(filters, parseInt(limit), offset);
    } else {
      logs = await UserActivityLog.getRecentActivity(parseInt(limit), offset);
    }

    // Get total count for pagination (respecting filters)
    let countQuery = 'SELECT COUNT(*) as count FROM user_activity_log ual WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;

    if (filters.userId) {
      countParamCount++;
      countQuery += ` AND ual.user_id = $${countParamCount}`;
      countParams.push(filters.userId);
    }

    if (filters.actionType) {
      countParamCount++;
      countQuery += ` AND ual.action_type = $${countParamCount}`;
      countParams.push(filters.actionType);
    }

    if (filters.status) {
      countParamCount++;
      countQuery += ` AND ual.status = $${countParamCount}`;
      countParams.push(filters.status);
    }

    if (filters.startDate && filters.endDate) {
      countParamCount++;
      countQuery += ` AND ual.timestamp >= $${countParamCount}`;
      countParams.push(filters.startDate);
      
      countParamCount++;
      countQuery += ` AND ual.timestamp <= $${countParamCount}`;
      countParams.push(filters.endDate);
    }

    const totalCount = await pool.query(countQuery, countParams);
    const totalPages = Math.ceil(totalCount.rows[0].count / limit);

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount.rows[0].count),
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

export const getActivityStats = async (req, res) => {
  try {
    const { userId } = req.query;
    const stats = await UserActivityLog.getActivityStats(userId ? parseInt(userId) : null);
    
    // Get additional stats
    const summary = await UserActivityLog.getActivitySummary();
    const topUsers = await UserActivityLog.getTopUsers(10);

    res.json({
      ...stats,
      summary,
      topUsers
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({ error: 'Failed to fetch activity stats' });
  }
};

export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const logs = await UserActivityLog.findByUserId(parseInt(userId), parseInt(limit), offset);
    
    // Get total count for pagination
    const totalCount = await pool.query(
      'SELECT COUNT(*) as count FROM user_activity_log WHERE user_id = $1',
      [userId]
    );
    const totalPages = Math.ceil(totalCount.rows[0].count / limit);

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount.rows[0].count),
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
};

export const getSessionActivity = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const logs = await UserActivityLog.findBySessionId(sessionId, parseInt(limit), offset);
    
    // Get total count for pagination
    const totalCount = await pool.query(
      'SELECT COUNT(*) as count FROM user_activity_log WHERE session_id = $1',
      [sessionId]
    );
    const totalPages = Math.ceil(totalCount.rows[0].count / limit);

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount.rows[0].count),
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching session activity:', error);
    res.status(500).json({ error: 'Failed to fetch session activity' });
  }
};

// Audit Trail Controllers
export const createAuditTrail = async (req, res) => {
  try {
    const { 
      auditName, 
      startTime, 
      endTime, 
      userIds = [], 
      actionTypes = [],
      statuses = []
    } = req.body;

    const exportedByUserId = req.user.userId || req.user.user_id;

    // Build query to get logs based on filters
    let query = `
      SELECT log_id FROM user_activity_log 
      WHERE timestamp BETWEEN $1 AND $2
    `;
    const params = [new Date(startTime), new Date(endTime)];
    let paramCount = 2;

    if (userIds.length > 0) {
      paramCount++;
      query += ` AND user_id = ANY($${paramCount})`;
      params.push(userIds);
    }

    if (actionTypes.length > 0) {
      paramCount++;
      query += ` AND action_type = ANY($${paramCount})`;
      params.push(actionTypes);
    }

    if (statuses.length > 0) {
      paramCount++;
      query += ` AND status = ANY($${paramCount})`;
      params.push(statuses);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, params);
    const sourceLogIds = result.rows.map(row => row.log_id);

    if (sourceLogIds.length === 0) {
      return res.status(400).json({ error: 'No logs found for the specified criteria' });
    }

    // Get detailed logs for the audit trail
    const detailedLogs = await UserActivityLog.getActivityByTimeRange(
      new Date(startTime), 
      new Date(endTime)
    );

    const auditTrail = await AuditTrail.create({
      exportedByUserId,
      auditName,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      sourceLogIds,
      details: {
        totalLogs: sourceLogIds.length,
        filters: { userIds, actionTypes, statuses },
        logs: detailedLogs
      }
    });

    res.status(201).json({
      message: 'Audit trail created successfully',
      auditTrail: {
        auditId: auditTrail.audit_id,
        auditName: auditTrail.audit_name,
        totalLogs: sourceLogIds.length,
        createdAt: auditTrail.created_at
      }
    });
  } catch (error) {
    console.error('Error creating audit trail:', error);
    res.status(500).json({ error: 'Failed to create audit trail' });
  }
};

export const getAuditTrails = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    const filters = {};
    if (startDate && endDate) {
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
    }

    let audits;
    if (search) {
      audits = await AuditTrail.searchAudits(search, filters, parseInt(limit), offset);
    } else {
      audits = await AuditTrail.getAll(parseInt(limit), offset);
    }

    // Get total count for pagination
    const totalCount = await AuditTrail.getAuditCount();
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      audits,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching audit trails:', error);
    res.status(500).json({ error: 'Failed to fetch audit trails' });
  }
};

export const getAuditTrailById = async (req, res) => {
  try {
    const { auditId } = req.params;
    const audit = await AuditTrail.findById(parseInt(auditId));

    if (!audit) {
      return res.status(404).json({ error: 'Audit trail not found' });
    }

    res.json(audit);
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
};

export const exportAuditTrail = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { format = 'csv' } = req.query;

    const audit = await AuditTrail.getAuditDetails(parseInt(auditId));
    if (!audit) {
      return res.status(404).json({ error: 'Audit trail not found' });
    }

    // Get the detailed logs for this audit
    const logs = await UserActivityLog.getActivityByTimeRange(
      audit.start_time,
      audit.end_time
    );

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Timestamp,User,Role,Action,Target,Status,IP Address,Details\n';
      const csvRows = logs.map(log => 
        `"${log.timestamp}","${log.username || 'N/A'}","${log.role_name || 'N/A'}","${log.action_type}","${log.target_id || 'N/A'}","${log.status}","${log.ip_address || 'N/A'}","${JSON.stringify(log.details || {})}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_trail_${auditId}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else if (format === 'json') {
      res.json({
        audit: {
          auditId: audit.audit_id,
          auditName: audit.audit_name,
          startTime: audit.start_time,
          endTime: audit.end_time,
          exportedBy: audit.exported_by_username,
          createdAt: audit.created_at,
          totalLogs: audit.log_count
        },
        logs
      });
    } else {
      res.status(400).json({ error: 'Unsupported format. Use csv or json' });
    }
  } catch (error) {
    console.error('Error exporting audit trail:', error);
    res.status(500).json({ error: 'Failed to export audit trail' });
  }
};

export const getAuditStats = async (req, res) => {
  try {
    const stats = await AuditTrail.getAuditStats();
    const summary = await AuditTrail.getAuditSummary();
    const topExporters = await AuditTrail.getTopExporters(10);
    const recentAudits = await AuditTrail.getRecentAudits(10);

    res.json({
      ...stats,
      summary,
      topExporters,
      recentAudits
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
};

// User Session Controllers
export const getUserSessions = async (req, res) => {
  try {
    const { userId, status } = req.query;
    
    let sessions;
    if (userId) {
      sessions = await UserSession.findByUserId(parseInt(userId), status);
    } else {
      sessions = await UserSession.getActiveSessions();
    }

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
};

export const terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.updateStatus(sessionId, 'terminated');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session terminated successfully', session });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
};

export const terminateAllUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await UserSession.terminateAllUserSessions(parseInt(userId));

    res.json({ 
      message: 'All user sessions terminated successfully', 
      terminatedCount: sessions.length 
    });
  } catch (error) {
    console.error('Error terminating all user sessions:', error);
    res.status(500).json({ error: 'Failed to terminate all user sessions' });
  }
};

export const getSessionStats = async (req, res) => {
  try {
    const stats = await UserSession.getSessionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
};

// Export all audit activity logs
export const exportActivityLogs = async (req, res) => {
  try {
    const { 
      format = 'csv', 
      userId, 
      actionType, 
      status, 
      startDate, 
      endDate,
      limit = 1000 
    } = req.query;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      whereConditions.push(`user_id = $${paramCount}`);
      queryParams.push(userId);
    }

    if (actionType) {
      paramCount++;
      whereConditions.push(`action_type = $${paramCount}`);
      queryParams.push(actionType);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    if (startDate && endDate) {
      paramCount++;
      whereConditions.push(`timestamp >= $${paramCount}`);
      queryParams.push(startDate);
      paramCount++;
      whereConditions.push(`timestamp <= $${paramCount}`);
      queryParams.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        ual.log_id,
        ual.user_id,
        u.username,
        r.role_name,
        ual.action_type,
        ual.target_id,
        ual.status,
        ual.ip_address,
        ual.details,
        ual.timestamp
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      ${whereClause}
      ORDER BY ual.timestamp DESC
      LIMIT $${paramCount + 1}
    `;
    
    queryParams.push(parseInt(limit));

    const result = await pool.query(query, queryParams);
    const logs = result.rows;

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Log ID,User ID,Username,Role,Action Type,Target ID,Status,IP Address,Details,Timestamp\n';
      const csvRows = logs.map(log => 
        `"${log.log_id}","${log.user_id || 'N/A'}","${log.username || 'N/A'}","${log.role_name || 'N/A'}","${log.action_type}","${log.target_id || 'N/A'}","${log.status}","${log.ip_address || 'N/A'}","${JSON.stringify(log.details || {})}","${log.timestamp}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_activity_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        exportedAt: new Date(),
        totalLogs: logs.length,
        filters: { userId, actionType, status, startDate, endDate },
        logs
      });
    }
  } catch (error) {
    console.error('Error exporting activity logs:', error);
    res.status(500).json({ error: 'Failed to export activity logs' });
  }
};