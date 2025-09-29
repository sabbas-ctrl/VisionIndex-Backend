import mongoose from 'mongoose';

const searchQueryAnalysisSchema = new mongoose.Schema({
  search_id: {
    type: Number,
    required: true,
    ref: 'Search' // Reference to PostgreSQL searches table
  },
  query_text: {
    type: String,
    required: true
  },
  parsed_attributes: {
    clothing_color: [String],
    clothing_items: [String],
    accessories: [String],
    object_type: String,
    age_range: String,
    gender: String,
    time_references: [String], // "morning", "afternoon", "evening"
    location_references: [String] // "entrance", "parking", "zone_a"
  },
  query_embedding_metadata: {
    model: String, // clip-vit-large, etc.
    vector_id: String,
    embedding_dimension: Number
  },
  similar_past_searches: [Number], // Array of search_ids
  ai_suggestions: [{
    suggestion_type: String, // "refine_query", "add_filter", "try_different_terms"
    suggestion_text: String,
    confidence: Number
  }],
  search_intent: {
    type: String,
    enum: ['find_person', 'find_object', 'find_vehicle', 'find_activity', 'general_search'],
    default: 'general_search'
  },
  complexity_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'search_query_analysis'
});

// Indexes for better query performance
searchQueryAnalysisSchema.index({ search_id: 1 });
searchQueryAnalysisSchema.index({ 'parsed_attributes.object_type': 1 });
searchQueryAnalysisSchema.index({ 'parsed_attributes.clothing_color': 1 });
searchQueryAnalysisSchema.index({ search_intent: 1 });
searchQueryAnalysisSchema.index({ created_at: -1 });

export default mongoose.model('SearchQueryAnalysis', searchQueryAnalysisSchema);
