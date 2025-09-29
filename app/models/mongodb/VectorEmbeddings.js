import mongoose from 'mongoose';

const vectorEmbeddingsSchema = new mongoose.Schema({
  vector_id: {
    type: String,
    required: true,
    unique: true
  },
  video_id: {
    type: Number,
    required: true,
    ref: 'Video'
  },
  segment_id: {
    type: Number,
    ref: 'VideoSegment'
  },
  frame_number: {
    type: Number,
    required: true
  },
  embedding_type: {
    type: String,
    enum: ['face', 'object', 'scene', 'person', 'vehicle'],
    required: true
  },
  model_name: {
    type: String,
    required: true // e.g., "clip-vit-large", "facenet", "yolov8"
  },
  embedding_vector: {
    type: [Number], // The actual vector data
    required: true
  },
  embedding_dimension: {
    type: Number,
    required: true
  },
  confidence_score: {
    type: Number,
    min: 0,
    max: 1
  },
  metadata: {
    bounding_box: [Number], // [x, y, width, height]
    object_label: String,
    attributes: {
      clothing_color: [String],
      clothing_items: [String],
      accessories: [String],
      age_range: String,
      gender: String
    },
    timestamp_in_video: Number, // seconds
    quality_score: Number
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'vector_embeddings'
});

// Indexes for vector similarity search and performance
vectorEmbeddingsSchema.index({ video_id: 1, frame_number: 1 });
vectorEmbeddingsSchema.index({ embedding_type: 1 });
vectorEmbeddingsSchema.index({ model_name: 1 });
vectorEmbeddingsSchema.index({ 'metadata.object_label': 1 });
vectorEmbeddingsSchema.index({ 'metadata.attributes.clothing_color': 1 });
vectorEmbeddingsSchema.index({ created_at: -1 });

// Compound index for efficient similarity search
vectorEmbeddingsSchema.index({ 
  embedding_type: 1, 
  model_name: 1, 
  'metadata.object_label': 1 
});

export default mongoose.model('VectorEmbeddings', vectorEmbeddingsSchema);
