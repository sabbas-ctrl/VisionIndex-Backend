import mongoose from 'mongoose';

const videoProcessingSchema = new mongoose.Schema({
  video_id: {
    type: Number,
    required: true,
    ref: 'Video' // Reference to PostgreSQL videos table
  },
  processing_stage: {
    type: String,
    enum: ['preprocessing', 'object_detection', 'face_recognition', 'embedding_generation', 'indexing', 'completed', 'failed'],
    default: 'preprocessing'
  },
  frames_analyzed: {
    type: Number,
    default: 0
  },
  total_frames: {
    type: Number,
    required: true
  },
  detected_objects: [{
    frame: Number,
    label: String,
    bbox: [Number], // [x, y, width, height]
    confidence: Number,
    attributes: {
      clothing_color: [String],
      clothing_items: [String],
      accessories: [String],
      age_range: String,
      gender: String,
      face_embedding_id: String
    }
  }],
  embeddings: [{
    type: String, // vector-data-or-uri
    model: String, // clip-vit-large, etc.
    vector_id: String
  }],
  additional_metadata: {
    motion_heatmap: String, // URI to JSON file
    anomaly_score: Number,
    processing_time_seconds: Number,
    gpu_usage_percent: Number,
    memory_usage_mb: Number
  },
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
  collection: 'video_processing'
});

// Indexes for better query performance
videoProcessingSchema.index({ video_id: 1 });
videoProcessingSchema.index({ processing_stage: 1 });
videoProcessingSchema.index({ created_at: -1 });
videoProcessingSchema.index({ 'detected_objects.label': 1 });
videoProcessingSchema.index({ 'detected_objects.attributes.clothing_color': 1 });

export default mongoose.model('VideoProcessing', videoProcessingSchema);
