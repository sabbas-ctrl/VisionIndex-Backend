import mongoose from 'mongoose';

const flagSchema = new mongoose.Schema({
  flag_type: {
    type: String,
    required: true,
    enum: [
      'query_anomaly',
      'suspicious_activity',
      'security_violation',
      'data_breach',
      'system_anomaly',
      'performance_issue',
      'access_violation',
      'rate_limit_exceeded',
      'unusual_pattern',
      'ai_anomaly'
    ]
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
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
  linked_action_id: {
    type: Number,
    index: true,
    sparse: true
  },
  status: {
    type: String,
    required: true,
    enum: ['new', 'investigating', 'resolved', 'false_positive', 'escalated'],
    default: 'new',
    index: true
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // AI/ML specific fields
  confidence_score: {
    type: Number,
    min: 0,
    max: 1
  },
  anomaly_score: {
    type: Number,
    min: 0,
    max: 1
  },
  // Investigation fields
  assigned_to: {
    type: Number,
    index: true,
    sparse: true
  },
  investigation_notes: {
    type: String,
    maxlength: 2000
  },
  resolution_notes: {
    type: String,
    maxlength: 2000
  },
  resolved_at: {
    type: Date,
    index: true
  },
  resolved_by: {
    type: Number,
    index: true,
    sparse: true
  },
  // Metadata
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'flags'
});

// Indexes for better query performance
flagSchema.index({ flag_type: 1, status: 1, created_at: -1 });
flagSchema.index({ user_id: 1, status: 1, created_at: -1 });
flagSchema.index({ priority: 1, status: 1, created_at: -1 });
flagSchema.index({ assigned_to: 1, status: 1, created_at: -1 });

// Compound indexes for common queries
flagSchema.index({ status: 1, priority: 1, created_at: -1 });
flagSchema.index({ flag_type: 1, priority: 1, created_at: -1 });

// Text index for message and notes search
flagSchema.index({ 
  message: 'text', 
  investigation_notes: 'text', 
  resolution_notes: 'text' 
});

// Pre-save middleware to update updated_at
flagSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Static methods
flagSchema.statics.createFlag = function(flagData) {
  return this.create({
    flag_type: flagData.flag_type,
    message: flagData.message,
    user_id: flagData.user_id,
    session_id: flagData.session_id,
    linked_action_id: flagData.linked_action_id,
    priority: flagData.priority || 'medium',
    details: flagData.details || {},
    confidence_score: flagData.confidence_score,
    anomaly_score: flagData.anomaly_score
  });
};

flagSchema.statics.getFlagsByStatus = function(status, limit = 100) {
  return this.find({ status })
    .sort({ created_at: -1 })
    .limit(limit);
};

flagSchema.statics.getFlagsByType = function(flagType, limit = 100) {
  return this.find({ flag_type: flagType })
    .sort({ created_at: -1 })
    .limit(limit);
};

flagSchema.statics.getFlagsByUser = function(userId, limit = 100) {
  return this.find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit);
};

flagSchema.statics.getFlagsByPriority = function(priority, limit = 100) {
  return this.find({ priority })
    .sort({ created_at: -1 })
    .limit(limit);
};

flagSchema.statics.getFlagsByAssignee = function(assignedTo, limit = 100) {
  return this.find({ assigned_to: assignedTo })
    .sort({ created_at: -1 })
    .limit(limit);
};

flagSchema.statics.getActiveFlags = function(limit = 100) {
  return this.find({ 
    status: { $in: ['new', 'investigating', 'escalated'] } 
  })
    .sort({ priority: 1, created_at: -1 })
    .limit(limit);
};

flagSchema.statics.getFlagStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalFlags: { $sum: 1 },
        newFlags: {
          $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] }
        },
        investigating: {
          $sum: { $cond: [{ $eq: ['$status', 'investigating'] }, 1, 0] }
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        critical: {
          $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
        },
        high: {
          $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
        }
      }
    }
  ]);
};

flagSchema.statics.searchFlags = function(query, filters = {}, limit = 100) {
  const searchQuery = {
    $text: { $search: query }
  };

  // Apply additional filters
  if (filters.flag_type) {
    searchQuery.flag_type = filters.flag_type;
  }
  if (filters.status) {
    searchQuery.status = filters.status;
  }
  if (filters.priority) {
    searchQuery.priority = filters.priority;
  }
  if (filters.user_id) {
    searchQuery.user_id = filters.user_id;
  }
  if (filters.assigned_to) {
    searchQuery.assigned_to = filters.assigned_to;
  }
  if (filters.start_date && filters.end_date) {
    searchQuery.created_at = {
      $gte: new Date(filters.start_date),
      $lte: new Date(filters.end_date)
    };
  }

  return this.find(searchQuery)
    .sort({ created_at: -1 })
    .limit(limit);
};

// Instance methods
flagSchema.methods.assignTo = function(userId) {
  this.assigned_to = userId;
  this.status = 'investigating';
  return this.save();
};

flagSchema.methods.resolve = function(resolvedBy, notes) {
  this.status = 'resolved';
  this.resolved_by = resolvedBy;
  this.resolved_at = new Date();
  this.resolution_notes = notes;
  return this.save();
};

flagSchema.methods.escalate = function(notes) {
  this.status = 'escalated';
  this.investigation_notes = notes;
  return this.save();
};

flagSchema.methods.markFalsePositive = function(notes) {
  this.status = 'false_positive';
  this.resolution_notes = notes;
  this.resolved_at = new Date();
  return this.save();
};

flagSchema.methods.addInvestigationNote = function(note) {
  const currentNotes = this.investigation_notes || '';
  this.investigation_notes = currentNotes + '\n' + new Date().toISOString() + ': ' + note;
  return this.save();
};

flagSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  return obj;
};

export const Flag = mongoose.model('Flag', flagSchema);
export default Flag;
