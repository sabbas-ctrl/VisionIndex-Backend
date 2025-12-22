import mongoose from 'mongoose';

const videoMetadataSchema = new mongoose.Schema({
  video_id: {
    type: Number,
    required: true,
    ref: 'Video' // Reference to PostgreSQL video_id
  },
  processing_stage: {
    type: String,
    enum: ['downloading', 'preprocessing', 'analysis', 'postprocessing', 'completed', 'failed'],
    default: 'preprocessing'
  },
  frames_analyzed: {
    type: Number,
    default: 0
  },
  total_frames: {
    type: Number,
    default: 0
  },
  detected_objects: [{
    frame: Number,
    timestamp: Number, // seconds from start
    label: String,
    confidence: Number,
    bbox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    track_id: String, // for tracking same object across frames
    zone: String // if zone detection is implemented
  }],
  face_detections: [{
    frame: Number,
    timestamp: Number,
    face_id: String, // unique identifier for the face
    confidence: Number,
    bbox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    embeddings: [Number], // face embedding vector
    quality_score: Number,
    pose: {
      yaw: Number,
      pitch: Number,
      roll: Number
    }
  }],
  person_tracks: [{
    track_id: String,
    start_frame: Number,
    end_frame: Number,
    start_timestamp: Number,
    end_timestamp: Number,
    zone_entries: [{
      zone: String,
      entry_time: Number,
      exit_time: Number
    }],
    appearance_features: {
      clothing_color: String,
      clothing_type: String,
      height_estimate: Number,
      gender: String,
      age_range: String
    },
    path_coordinates: [{
      frame: Number,
      x: Number,
      y: Number,
      timestamp: Number
    }]
  }],
  motion_analysis: {
    motion_heatmap: String, // URI to heatmap data
    high_activity_zones: [{
      zone: String,
      activity_score: Number,
      time_range: {
        start: Number,
        end: Number
      }
    }],
    crowd_density: [{
      timestamp: Number,
      density_score: Number,
      zone: String
    }]
  },
  anomaly_detection: {
    anomalies: [{
      type: String, // 'unusual_movement', 'crowd_gathering', 'suspicious_behavior'
      timestamp: Number,
      frame: Number,
      confidence: Number,
      description: String,
      zone: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
      }
    }],
    overall_anomaly_score: Number
  },
  embeddings: {
    scene_embeddings: [String], // URIs to embedding data
    object_embeddings: [String],
    face_embeddings: [String]
  },
  additional_metadata: {
    weather_conditions: String,
    lighting_conditions: String,
    camera_angle: String,
    quality_metrics: {
      brightness: Number,
      contrast: Number,
      sharpness: Number,
      noise_level: Number
    }
  },
  processing_log: [{
    timestamp: Date,
    stage: String,
    message: String,
    status: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info'
    },
    details: mongoose.Schema.Types.Mixed
  }],
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'video_metadata'
});

// Indexes for better performance
videoMetadataSchema.index({ video_id: 1 });
videoMetadataSchema.index({ processing_stage: 1 });
videoMetadataSchema.index({ 'detected_objects.timestamp': 1 });
videoMetadataSchema.index({ 'face_detections.timestamp': 1 });
videoMetadataSchema.index({ 'person_tracks.track_id': 1 });
videoMetadataSchema.index({ 'anomaly_detection.anomalies.timestamp': 1 });
videoMetadataSchema.index({ created_at: -1 });

// Pre-save middleware to update updated_at
videoMetadataSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Static methods
videoMetadataSchema.statics.findByVideoId = function(videoId) {
  return this.findOne({ video_id: videoId });
};

videoMetadataSchema.statics.findByProcessingStage = function(stage) {
  return this.find({ processing_stage: stage });
};

videoMetadataSchema.statics.findByAnomalyType = function(anomalyType) {
  return this.find({ 'anomaly_detection.anomalies.type': anomalyType });
};

videoMetadataSchema.statics.findByTimeRange = function(startTime, endTime) {
  return this.find({
    'detected_objects.timestamp': {
      $gte: startTime,
      $lte: endTime
    }
  });
};

videoMetadataSchema.statics.findByZone = function(zone) {
  return this.find({
    $or: [
      { 'detected_objects.zone': zone },
      { 'person_tracks.zone_entries.zone': zone },
      { 'motion_analysis.high_activity_zones.zone': zone }
    ]
  });
};

// Instance methods
videoMetadataSchema.methods.addProcessingLog = function(stage, message, status = 'info', details = null) {
  this.processing_log.push({
    timestamp: new Date(),
    stage,
    message,
    status,
    details
  });
  return this.save();
};

videoMetadataSchema.methods.updateProcessingStage = function(stage) {
  this.processing_stage = stage;
  return this.save();
};

videoMetadataSchema.methods.addDetectedObject = function(objectData) {
  this.detected_objects.push(objectData);
  this.frames_analyzed += 1;
  return this.save();
};

videoMetadataSchema.methods.addFaceDetection = function(faceData) {
  this.face_detections.push(faceData);
  return this.save();
};

videoMetadataSchema.methods.addPersonTrack = function(trackData) {
  this.person_tracks.push(trackData);
  return this.save();
};

videoMetadataSchema.methods.addAnomaly = function(anomalyData) {
  this.anomaly_detection.anomalies.push(anomalyData);
  return this.save();
};

videoMetadataSchema.methods.getStats = function() {
  return {
    total_objects: this.detected_objects.length,
    total_faces: this.face_detections.length,
    total_tracks: this.person_tracks.length,
    total_anomalies: this.anomaly_detection.anomalies.length,
    processing_stage: this.processing_stage,
    frames_analyzed: this.frames_analyzed,
    total_frames: this.total_frames,
    analysis_progress: this.total_frames > 0 ? (this.frames_analyzed / this.total_frames) * 100 : 0
  };
};

const VideoMetadata = mongoose.model('VideoMetadata', videoMetadataSchema);

export default VideoMetadata;


