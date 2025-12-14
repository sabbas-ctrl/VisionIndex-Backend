import { SystemLog } from '../models/mongodb/SystemLog.js';
import { Flag } from '../models/mongodb/Flag.js';
import { ErrorLogger } from '../utils/errorLogger.js';
import mongoose from 'mongoose';

// System Log Controllers
export const getSystemLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      level, 
      module, 
      host, 
      userId,
      actionType,
      search,
      startDate,
      endDate
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build base query for both search and regular filtering
    const baseQuery = {};
    if (level) baseQuery.level = level;
    if (module) baseQuery.module = module;
    if (host) baseQuery.host = host;
    if (userId) baseQuery.user_id = parseInt(userId);
    if (actionType) baseQuery.action_type = actionType;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      baseQuery.timestamp = {
        $gte: start,
        $lte: end
      };
    }

    let logs;
    let totalCount;

    if (search) {
      // Use case-insensitive regex search across common fields for broader matching
      const regex = new RegExp(search, 'i');
      const searchQuery = {
        ...baseQuery,
        $or: [
          { message: regex },
          { module: regex },
          { action_type: regex },
          { host: regex }
        ]
      };

      logs = await SystemLog.find(searchQuery)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(offset);

      totalCount = await SystemLog.countDocuments(searchQuery);
    } else {
      // Regular filtering without text search
      logs = await SystemLog.find(baseQuery)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(offset);
        
      totalCount = await SystemLog.countDocuments(baseQuery);
    }

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    await ErrorLogger.logControllerError(error, req, {
      module: 'system_log_controller',
      actionType: 'get_system_logs'
    });
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
};

export const getSystemLogStats = async (req, res) => {
  try {
    const stats = await SystemLog.getSystemStats();
    const recentErrors = await SystemLog.getRecentErrors(24, 10);
    
    // Get active users (users who have logged activity in the last 24 hours)
    const activeUsersResult = await SystemLog.aggregate([
      {
        $match: {
          user_id: { $exists: true, $ne: null },
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$user_id'
        }
      },
      {
        $count: 'activeUsers'
      }
    ]);
    
    const activeUsers = activeUsersResult[0]?.activeUsers || 0;
    
    // Calculate system health based on error rate
    const healthStats = await SystemLog.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          errorLogs: {
            $sum: {
              $cond: [
                { $in: ['$level', ['error', 'critical']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    let systemHealth = 100; // Default to 100% healthy
    if (healthStats[0] && healthStats[0].totalLogs > 0) {
      const errorRate = (healthStats[0].errorLogs / healthStats[0].totalLogs) * 100;
      systemHealth = Math.max(0, 100 - errorRate); // Health decreases with error rate
    }
    
    // Get logs by level for the last 7 days
    const logsByLevel = await SystemLog.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get logs by module for the last 7 days
    const logsByModule = await SystemLog.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$module',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      ...stats[0],
      activeUsers,
      systemHealth: Math.round(systemHealth),
      recentErrors,
      logsByLevel,
      logsByModule
    });
  } catch (error) {
    console.error('Error fetching system log stats:', error);
    await ErrorLogger.logControllerError(error, req, {
      module: 'system_log_controller',
      actionType: 'get_system_log_stats'
    });
    res.status(500).json({ error: 'Failed to fetch system log stats' });
  }
};

export const getLogsByLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const { limit = 100 } = req.query;

    const logs = await SystemLog.getLogsByLevel(level, parseInt(limit));
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs by level:', error);
    res.status(500).json({ error: 'Failed to fetch logs by level' });
  }
};

export const getLogsByModule = async (req, res) => {
  try {
    const { module } = req.params;
    const { limit = 100 } = req.query;

    const logs = await SystemLog.getLogsByModule(module, parseInt(limit));
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs by module:', error);
    res.status(500).json({ error: 'Failed to fetch logs by module' });
  }
};

export const getRecentErrors = async (req, res) => {
  try {
    const { hours = 24, limit = 50 } = req.query;
    const logs = await SystemLog.getRecentErrors(parseInt(hours), parseInt(limit));
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent errors:', error);
    res.status(500).json({ error: 'Failed to fetch recent errors' });
  }
};

export const createSystemLog = async (req, res) => {
  try {
    const logData = req.body;
    const log = await SystemLog.createLog(logData);
    
    res.status(201).json({
      message: 'System log created successfully',
      log
    });
  } catch (error) {
    console.error('Error creating system log:', error);
    res.status(500).json({ error: 'Failed to create system log' });
  }
};

export const exportSystemLogs = async (req, res) => {
  try {
    const { 
      format = 'json', 
      level, 
      module, 
      startDate, 
      endDate,
      limit = 1000 
    } = req.query;

    const query = {};
    if (level) query.level = level;
    if (module) query.module = module;
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Timestamp,Level,Module,Message,Host,User ID,Action Type,Details\n';
      const csvRows = logs.map(log => 
        `"${log.timestamp}","${log.level}","${log.module}","${log.message}","${log.host}","${log.user_id || 'N/A'}","${log.action_type || 'N/A'}","${JSON.stringify(log.details || {})}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="system_logs_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        exportedAt: new Date(),
        totalLogs: logs.length,
        filters: { level, module, startDate, endDate },
        logs
      });
    }
  } catch (error) {
    console.error('Error exporting system logs:', error);
    res.status(500).json({ error: 'Failed to export system logs' });
  }
};

// Flag Controllers
export const getFlags = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      flagType, 
      status, 
      priority, 
      userId,
      assignedTo,
      search,
      startDate,
      endDate
    } = req.query;

    const offset = (page - 1) * limit;

    // Build base query for filters
    const baseQuery = {};
    if (flagType) baseQuery.flag_type = flagType;
    if (status) baseQuery.status = status;
    if (priority) baseQuery.priority = priority;
    if (userId) baseQuery.user_id = parseInt(userId);
    if (assignedTo) baseQuery.assigned_to = parseInt(assignedTo);
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      baseQuery.created_at = {
        $gte: start,
        $lte: end
      };
    }

    let flags;
    let totalCount;

    if (search) {
      // Case-insensitive regex across message, flag_type, status, priority
      const regex = new RegExp(search, 'i');
      const searchQuery = {
        ...baseQuery,
        $or: [
          { message: regex },
          { flag_type: regex },
          { status: regex },
          { priority: regex }
        ]
      };

      flags = await Flag.find(searchQuery)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(offset);

      totalCount = await Flag.countDocuments(searchQuery);
    } else {
      flags = await Flag.find(baseQuery)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(offset);

      totalCount = await Flag.countDocuments(baseQuery);
    }

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      flags,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching flags:', error);
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
};

export const getFlagStats = async (req, res) => {
  try {
    const stats = await Flag.getFlagStats();
    
    // Get flags by type for the last 30 days
    const flagsByType = await Flag.aggregate([
      {
        $match: {
          created_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$flag_type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get flags by priority for the last 30 days
    const flagsByPriority = await Flag.aggregate([
      {
        $match: {
          created_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      ...stats[0],
      flagsByType,
      flagsByPriority
    });
  } catch (error) {
    console.error('Error fetching flag stats:', error);
    res.status(500).json({ error: 'Failed to fetch flag stats' });
  }
};

export const createFlag = async (req, res) => {
  try {
    const flagData = req.body;
    const flag = await Flag.createFlag(flagData);
    
    res.status(201).json({
      message: 'Flag created successfully',
      flag
    });
  } catch (error) {
    console.error('Error creating flag:', error);
    res.status(500).json({ error: 'Failed to create flag' });
  }
};

export const getFlagById = async (req, res) => {
  try {
    const { flagId } = req.params;
    const flag = await Flag.findById(flagId);

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json(flag);
  } catch (error) {
    console.error('Error fetching flag:', error);
    res.status(500).json({ error: 'Failed to fetch flag' });
  }
};

export const updateFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const updateData = req.body;

    const flag = await Flag.findByIdAndUpdate(
      flagId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({
      message: 'Flag updated successfully',
      flag
    });
  } catch (error) {
    console.error('Error updating flag:', error);
    res.status(500).json({ error: 'Failed to update flag' });
  }
};

export const assignFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { assignedTo } = req.body;

    const flag = await Flag.findById(flagId);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    await flag.assignTo(assignedTo);

    res.json({
      message: 'Flag assigned successfully',
      flag
    });
  } catch (error) {
    console.error('Error assigning flag:', error);
    res.status(500).json({ error: 'Failed to assign flag' });
  }
};

export const resolveFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { notes } = req.body;
    const resolvedBy = req.user.userId || req.user.user_id;

    const flag = await Flag.findById(flagId);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    await flag.resolve(resolvedBy, notes);

    res.json({
      message: 'Flag resolved successfully',
      flag
    });
  } catch (error) {
    console.error('Error resolving flag:', error);
    res.status(500).json({ error: 'Failed to resolve flag' });
  }
};

export const escalateFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { notes } = req.body;

    const flag = await Flag.findById(flagId);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    await flag.escalate(notes);

    res.json({
      message: 'Flag escalated successfully',
      flag
    });
  } catch (error) {
    console.error('Error escalating flag:', error);
    res.status(500).json({ error: 'Failed to escalate flag' });
  }
};

export const markFlagFalsePositive = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { notes } = req.body;

    const flag = await Flag.findById(flagId);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    await flag.markFalsePositive(notes);

    res.json({
      message: 'Flag marked as false positive successfully',
      flag
    });
  } catch (error) {
    console.error('Error marking flag as false positive:', error);
    res.status(500).json({ error: 'Failed to mark flag as false positive' });
  }
};

export const addFlagNote = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { note } = req.body;

    const flag = await Flag.findById(flagId);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    await flag.addInvestigationNote(note);

    res.json({
      message: 'Note added successfully',
      flag
    });
  } catch (error) {
    console.error('Error adding flag note:', error);
    res.status(500).json({ error: 'Failed to add flag note' });
  }
};

export const getActiveFlags = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const flags = await Flag.getActiveFlags(parseInt(limit));
    res.json(flags);
  } catch (error) {
    console.error('Error fetching active flags:', error);
    res.status(500).json({ error: 'Failed to fetch active flags' });
  }
};

export const exportFlags = async (req, res) => {
  try {
    const { 
      format = 'json', 
      flagType, 
      status, 
      priority,
      startDate, 
      endDate,
      limit = 1000 
    } = req.query;

    const query = {};
    if (flagType) query.flag_type = flagType;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate && endDate) {
      // Add time range to include the entire day
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      query.created_at = {
        $gte: start,
        $lte: end
      };
    }

    const flags = await Flag.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'ID,Flag Type,Message,User ID,Status,Priority,Confidence Score,Anomaly Score,Created At,Resolved At\n';
      const csvRows = flags.map(flag => 
        `"${flag._id}","${flag.flag_type}","${flag.message}","${flag.user_id || 'N/A'}","${flag.status}","${flag.priority}","${flag.confidence_score || 'N/A'}","${flag.anomaly_score || 'N/A'}","${flag.created_at}","${flag.resolved_at || 'N/A'}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="flags_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        exportedAt: new Date(),
        totalFlags: flags.length,
        filters: { flagType, status, priority, startDate, endDate },
        flags
      });
    }
  } catch (error) {
    console.error('Error exporting flags:', error);
    res.status(500).json({ error: 'Failed to export flags' });
  }
};
