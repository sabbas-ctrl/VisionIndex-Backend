import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
  level: {
    type: String,
    required: true,
    enum: ['error', 'warn', 'info', 'debug', 'critical'],
    default: 'info'
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  module: {
    type: String,
    required: true,
    maxlength: 100
  },
  trace_id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  host: {
    type: String,
    required: true,
    maxlength: 100
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Additional fields for VisionIndex specific logging
  user_id: {
    type: Number,
    index: true,
    sparse: true
  },
  session_id: {
    type: String,
    index: true,
    sparse: true
  },
  action_type: {
    type: String,
    maxlength: 50,
    index: true
  },
  // For GPU/processing specific logs
  gpu_usage: {
    type: Number,
    min: 0,
    max: 100
  },
  memory_usage: {
    type: Number,
    min: 0
  },
  // For facial recognition specific logs
  detection_count: {
    type: Number,
    min: 0
  },
  processing_time: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'system_logs'
});

// Indexes for better query performance
systemLogSchema.index({ level: 1, timestamp: -1 });
systemLogSchema.index({ module: 1, timestamp: -1 });
systemLogSchema.index({ host: 1, timestamp: -1 });
systemLogSchema.index({ user_id: 1, timestamp: -1 });
systemLogSchema.index({ action_type: 1, timestamp: -1 });

// Compound indexes for common queries
systemLogSchema.index({ level: 1, module: 1, timestamp: -1 });
systemLogSchema.index({ user_id: 1, action_type: 1, timestamp: -1 });

// Text index for message search
systemLogSchema.index({ message: 'text' });

// Static methods
systemLogSchema.statics.createLog = function(logData) {
  return this.create({
    level: logData.level || 'info',
    message: logData.message,
    module: logData.module || 'unknown',
    host: logData.host || 'localhost',
    details: logData.details || {},
    user_id: logData.user_id,
    session_id: logData.session_id,
    action_type: logData.action_type,
    gpu_usage: logData.gpu_usage,
    memory_usage: logData.memory_usage,
    detection_count: logData.detection_count,
    processing_time: logData.processing_time
  });
};

systemLogSchema.statics.getLogsByLevel = function(level, limit = 100) {
  return this.find({ level })
    .sort({ timestamp: -1 })
    .limit(limit);
};

systemLogSchema.statics.getLogsByModule = function(module, limit = 100) {
  return this.find({ module })
    .sort({ timestamp: -1 })
    .limit(limit);
};

systemLogSchema.statics.getLogsByUser = function(userId, limit = 100) {
  return this.find({ user_id: userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

systemLogSchema.statics.getRecentErrors = function(hours = 24, limit = 50) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    level: { $in: ['error', 'critical'] },
    timestamp: { $gte: since }
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

systemLogSchema.statics.getSystemStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        errorsToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$timestamp', new Date(new Date().setHours(0, 0, 0, 0))] },
                  { $in: ['$level', ['error', 'critical']] }
                ]
              },
              1,
              0
            ]
          }
        },
        criticalErrors: {
          $sum: {
            $cond: [{ $eq: ['$level', 'critical'] }, 1, 0]
          }
        },
        warnings: {
          $sum: {
            $cond: [{ $eq: ['$level', 'warn'] }, 1, 0]
          }
        }
      }
    }
  ]);
};

systemLogSchema.statics.searchLogs = function(query, filters = {}, limit = 100) {
  const searchQuery = {
    $text: { $search: query }
  };

  // Apply additional filters
  if (filters.level) {
    searchQuery.level = filters.level;
  }
  if (filters.module) {
    searchQuery.module = filters.module;
  }
  if (filters.host) {
    searchQuery.host = filters.host;
  }
  if (filters.user_id) {
    searchQuery.user_id = filters.user_id;
  }
  if (filters.start_date && filters.end_date) {
    searchQuery.timestamp = {
      $gte: new Date(filters.start_date),
      $lte: new Date(filters.end_date)
    };
  }

  return this.find(searchQuery)
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Instance methods
systemLogSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  return obj;
};

export const SystemLog = mongoose.model('SystemLog', systemLogSchema);
export default SystemLog;
