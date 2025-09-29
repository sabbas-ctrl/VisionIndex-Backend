import { SystemLog } from '../models/mongodb/SystemLog.js';
import { Flag } from '../models/mongodb/Flag.js';
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
    const filters = {};

    if (level) filters.level = level;
    if (module) filters.module = module;
    if (host) filters.host = host;
    if (userId) filters.user_id = parseInt(userId);
    if (actionType) filters.action_type = actionType;
    if (startDate && endDate) {
      filters.start_date = new Date(startDate);
      filters.end_date = new Date(endDate);
    }

    let logs;
    if (search) {
      logs = await SystemLog.searchLogs(search, filters, parseInt(limit));
    } else {
      // Build query based on filters
      const query = {};
      if (level) query.level = level;
      if (module) query.module = module;
      if (host) query.host = host;
      if (userId) query.user_id = parseInt(userId);
      if (actionType) query.action_type = actionType;
      if (startDate && endDate) {
        query.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      logs = await SystemLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(offset);
    }

    // Get total count for pagination
    const totalCount = await SystemLog.countDocuments();
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
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
};

export const getSystemLogStats = async (req, res) => {
  try {
    const stats = await SystemLog.getSystemStats();
    const recentErrors = await SystemLog.getRecentErrors(24, 10);
    
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
      recentErrors,
      logsByLevel,
      logsByModule
    });
  } catch (error) {
    console.error('Error fetching system log stats:', error);
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
    const filters = {};

    if (flagType) filters.flag_type = flagType;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (userId) filters.user_id = parseInt(userId);
    if (assignedTo) filters.assigned_to = parseInt(assignedTo);
    if (startDate && endDate) {
      filters.start_date = new Date(startDate);
      filters.end_date = new Date(endDate);
    }

    let flags;
    if (search) {
      flags = await Flag.searchFlags(search, filters, parseInt(limit));
    } else {
      // Build query based on filters
      const query = {};
      if (flagType) query.flag_type = flagType;
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (userId) query.user_id = parseInt(userId);
      if (assignedTo) query.assigned_to = parseInt(assignedTo);
      if (startDate && endDate) {
        query.created_at = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      flags = await Flag.find(query)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(offset);
    }

    // Get total count for pagination
    const totalCount = await Flag.countDocuments();
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
    const resolvedBy = req.user.userId;

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
      query.created_at = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
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
