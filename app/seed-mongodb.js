import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import VideoProcessing from './models/mongodb/VideoProcessing.js';
import SearchQueryAnalysis from './models/mongodb/SearchQueryAnalysis.js';
import VectorEmbeddings from './models/mongodb/VectorEmbeddings.js';
import SystemLog from './models/mongodb/SystemLog.js';
import Flag from './models/mongodb/Flag.js';

async function seedMongoDB() {
  try {
    console.log('🌱 Starting MongoDB analytics data seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    // await VideoProcessing.deleteMany({});
    // await SearchQueryAnalysis.deleteMany({});
    // await VectorEmbeddings.deleteMany({});
    await SystemLog.deleteMany({});
    await Flag.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Seed Video Processing data
    const videoProcessingData = [
      {
        video_id: 1,
        processing_stage: 'completed',
        frames_analyzed: 9900,
        total_frames: 9900,
        detected_objects: [
          {
            frame: 90,
            label: 'person',
            bbox: [100, 200, 150, 300],
            confidence: 0.95,
            attributes: {
              clothing_color: ['blue'],
              clothing_items: ['jacket'],
              age_range: '25-35',
              gender: 'male'
            }
          },
          {
            frame: 135,
            label: 'person',
            bbox: [300, 150, 200, 350],
            confidence: 0.87,
            attributes: {
              clothing_color: ['red'],
              clothing_items: ['shirt'],
              age_range: '20-30',
              gender: 'female'
            }
          },
          {
            frame: 180,
            label: 'vehicle',
            bbox: [50, 400, 300, 200],
            confidence: 0.92,
            attributes: {
              color: 'white',
              type: 'car'
            }
          }
        ],
        embeddings: [
          {
            type: 'face_embedding',
            model: 'facenet',
            vector_id: 'face_001_embedding'
          },
          {
            type: 'person_embedding',
            model: 'clip-vit-large',
            vector_id: 'person_001_embedding'
          }
        ],
        additional_metadata: {
          motion_heatmap: '/heatmaps/video_1_motion.json',
          anomaly_score: 0.76,
          processing_time_seconds: 45.2,
          gpu_usage_percent: 78.5,
          memory_usage_mb: 2048
        }
      },
      {
        video_id: 2,
        processing_stage: 'completed',
        frames_analyzed: 13050,
        total_frames: 13050,
        detected_objects: [
          {
            frame: 45,
            label: 'person',
            bbox: [150, 250, 120, 280],
            confidence: 0.91,
            attributes: {
              clothing_color: ['green'],
              clothing_items: ['shirt'],
              age_range: '30-40',
              gender: 'male'
            }
          },
          {
            frame: 80,
            label: 'vehicle',
            bbox: [100, 350, 250, 150],
            confidence: 0.88,
            attributes: {
              color: 'black',
              type: 'suv'
            }
          }
        ],
        embeddings: [
          {
            type: 'face_embedding',
            model: 'facenet',
            vector_id: 'face_002_embedding'
          }
        ],
        additional_metadata: {
          motion_heatmap: '/heatmaps/video_2_motion.json',
          anomaly_score: 0.45,
          processing_time_seconds: 52.8,
          gpu_usage_percent: 82.1,
          memory_usage_mb: 2560
        }
      }
    ];

    // await VideoProcessing.insertMany(videoProcessingData);
    // console.log('✅ Video processing data seeded');

    // Seed Search Query Analysis data
    const searchAnalysisData = [
      {
        search_id: 1,
        query_text: 'person in blue jacket',
        parsed_attributes: {
          clothing_color: ['blue'],
          clothing_items: ['jacket'],
          object_type: 'person',
          age_range: null,
          gender: null,
          time_references: [],
          location_references: []
        },
        query_embedding_metadata: {
          model: 'clip-vit-large',
          vector_id: 'query_001_embedding',
          embedding_dimension: 512
        },
        similar_past_searches: [2, 3],
        ai_suggestions: [
          {
            suggestion_type: 'refine_query',
            suggestion_text: 'Try adding "with backpack" for more specific results',
            confidence: 0.8
          }
        ],
        search_intent: 'find_person',
        complexity_score: 0.3
      },
      {
        search_id: 2,
        query_text: 'woman with red shirt',
        parsed_attributes: {
          clothing_color: ['red'],
          clothing_items: ['shirt'],
          object_type: 'person',
          age_range: null,
          gender: 'female',
          time_references: [],
          location_references: []
        },
        query_embedding_metadata: {
          model: 'clip-vit-large',
          vector_id: 'query_002_embedding',
          embedding_dimension: 512
        },
        similar_past_searches: [1, 4],
        ai_suggestions: [
          {
            suggestion_type: 'add_filter',
            suggestion_text: 'Consider adding time range filter for better results',
            confidence: 0.7
          }
        ],
        search_intent: 'find_person',
        complexity_score: 0.4
      }
    ];

    // await SearchQueryAnalysis.insertMany(searchAnalysisData);
    // console.log('✅ Search query analysis data seeded');

    // Seed Vector Embeddings data
    const vectorEmbeddingsData = [
      {
        vector_id: 'face_001_embedding',
        video_id: 1,
        segment_id: 1,
        frame_number: 90,
        embedding_type: 'face',
        model_name: 'facenet',
        embedding_vector: Array(512).fill(0).map(() => Math.random() - 0.5),
        embedding_dimension: 512,
        confidence_score: 0.95,
        metadata: {
          bounding_box: [120, 180, 80, 100],
          object_label: 'face',
          attributes: {
            age_range: '25-35',
            gender: 'male'
          },
          timestamp_in_video: 90,
          quality_score: 0.89
        }
      },
      {
        vector_id: 'person_001_embedding',
        video_id: 1,
        segment_id: 1,
        frame_number: 90,
        embedding_type: 'person',
        model_name: 'clip-vit-large',
        embedding_vector: Array(512).fill(0).map(() => Math.random() - 0.5),
        embedding_dimension: 512,
        confidence_score: 0.95,
        metadata: {
          bounding_box: [100, 200, 150, 300],
          object_label: 'person',
          attributes: {
            clothing_color: ['blue'],
            clothing_items: ['jacket'],
            age_range: '25-35',
            gender: 'male'
          },
          timestamp_in_video: 90,
          quality_score: 0.92
        }
      }
    ];

    // await VectorEmbeddings.insertMany(vectorEmbeddingsData);
    // console.log('✅ Vector embeddings data seeded');

    // Seed System Logs data
    const systemLogsData = [
      {
        level: 'info',
        message: 'Video processing completed successfully',
        module: 'video_processor',
        trace_id: 'trace_001',
        host: 'gpu-node-1',
        details: {
          video_id: 1,
          processing_time: '45.2s',
          frames_processed: 9900
        },
        timestamp: new Date()
      },
      {
        level: 'warn',
        message: 'High GPU usage detected',
        module: 'resource_monitor',
        trace_id: 'trace_002',
        host: 'gpu-node-1',
        details: {
          gpu_usage: '85%',
          memory_usage: '2.1GB',
          temperature: '78°C'
        },
        timestamp: new Date()
      },
      {
        level: 'error',
        message: 'Face recognition service timeout',
        module: 'face_recognition',
        trace_id: 'trace_003',
        host: 'gpu-node-2',
        details: {
          timeout_duration: '30s',
          video_id: 3,
          error_code: 'TIMEOUT_001'
        },
        timestamp: new Date()
      }
    ];

    await SystemLog.insertMany(systemLogsData);
    console.log('✅ System logs data seeded');

    // Seed Flags data
    const flagsData = [
      {
        flag_type: 'query_anomaly',
        message: 'Suspicious repeated face search',
        user_id: 1,
        session_id: 'session_001',
        linked_action_id: 1,
        status: 'new',
        priority: 'medium',
        details: {
          search_params: ['face_id: 3321'],
          frequency: 18,
          time_window: '1 hour'
        },
        created_at: new Date()
      },
      {
        flag_type: 'performance_issue',
        message: 'Unusually long video processing time',
        user_id: 2,
        session_id: 'session_002',
        linked_action_id: 2,
        status: 'investigating',
        priority: 'high',
        details: {
          processing_time: '120s',
          expected_time: '60s',
          video_size: '50MB'
        },
        created_at: new Date()
      }
    ];

    await Flag.insertMany(flagsData);
    console.log('✅ Flags data seeded');

    console.log('🎉 MongoDB analytics data seeding completed successfully!');
    console.log('📊 Sample data includes:');
    console.log('   - 2 video processing records');
    console.log('   - 2 search query analyses');
    console.log('   - 2 vector embeddings');
    console.log('   - 3 system logs');
    console.log('   - 2 security flags');

  } catch (error) {
    console.error('❌ MongoDB seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedMongoDB();
