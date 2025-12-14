import pkg from 'pg';
const { Pool } = pkg;

// Create a direct database connection for this script
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'visionindex',
  password: 'password', // You may need to change this to your actual password
  port: 5432,
});

const insertSampleData = async () => {
  try {
    console.log('🔄 Starting to insert sample search history data...');

    // Insert search sessions
    console.log('📝 Inserting search sessions...');
    await pool.query(`
      INSERT INTO search_sessions (session_id, user_id, title, created_at, updated_at) VALUES
      ('550e8400-e29b-41d4-a716-446655440001', 1, 'Security Investigation - Zone A', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
      ('550e8400-e29b-41d4-a716-446655440002', 2, 'Person Search - Red Hat', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
      ('550e8400-e29b-41d4-a716-446655440003', 1, 'Vehicle Analysis - Parking Lot', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
      ('550e8400-e29b-41d4-a716-446655440004', 3, 'Suspicious Activity Review', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
      ('550e8400-e29b-41d4-a716-446655440005', 2, 'Morning Shift Analysis', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
      ('550e8400-e29b-41d4-a716-446655440006', 1, 'Weekend Security Check', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
      ('550e8400-e29b-41d4-a716-446655440007', 3, 'Night Shift Monitoring', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
      ('550e8400-e29b-41d4-a716-446655440008', 2, 'Incident Investigation', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
      ON CONFLICT (session_id) DO NOTHING
    `);

    // Insert searches
    console.log('🔍 Inserting search queries...');
    await pool.query(`
      INSERT INTO searches (user_id, search_session_id, query_text, query_type, query_vector_id, query_metadata, created_at) VALUES
      (1, '550e8400-e29b-41d4-a716-446655440001', 'Person with red hat entering Zone A', 'text', 'vec_001', '{"confidence": 0.95, "filters_applied": ["zone", "clothing"]}', NOW() - INTERVAL '2 hours'),
      (2, '550e8400-e29b-41d4-a716-446655440002', 'Find person wearing blue jacket', 'text', 'vec_002', '{"confidence": 0.88, "filters_applied": ["clothing"]}', NOW() - INTERVAL '4 hours'),
      (1, '550e8400-e29b-41d4-a716-446655440003', 'White van in parking lot', 'text', 'vec_003', '{"confidence": 0.92, "filters_applied": ["vehicle", "location"]}', NOW() - INTERVAL '6 hours'),
      (3, '550e8400-e29b-41d4-a716-446655440004', 'Suspicious behavior near entrance', 'text', 'vec_004', '{"confidence": 0.76, "filters_applied": ["behavior"]}', NOW() - INTERVAL '1 day'),
      (2, '550e8400-e29b-41d4-a716-446655440005', 'Morning crowd analysis', 'text', 'vec_005', '{"confidence": 0.89, "filters_applied": ["time_range"]}', NOW() - INTERVAL '1 day 2 hours'),
      (1, '550e8400-e29b-41d4-a716-446655440004', 'Person with backpack', 'text', 'vec_006', '{"confidence": 0.83, "filters_applied": ["clothing"]}', NOW() - INTERVAL '1 day 4 hours'),
      (3, '550e8400-e29b-41d4-a716-446655440006', 'Weekend security check', 'text', 'vec_007', '{"confidence": 0.91, "filters_applied": ["time_range"]}', NOW() - INTERVAL '3 days'),
      (2, '550e8400-e29b-41d4-a716-446655440007', 'Night shift monitoring', 'text', 'vec_008', '{"confidence": 0.87, "filters_applied": ["time_range"]}', NOW() - INTERVAL '4 days'),
      (1, '550e8400-e29b-41d4-a716-446655440008', 'Incident investigation', 'text', 'vec_009', '{"confidence": 0.94, "filters_applied": ["incident"]}', NOW() - INTERVAL '5 days'),
      (2, '550e8400-e29b-41d4-a716-446655440008', 'Vehicle license plate search', 'text', 'vec_010', '{"confidence": 0.96, "filters_applied": ["vehicle", "license"]}', NOW() - INTERVAL '5 days 2 hours'),
      (3, '550e8400-e29b-41d4-a716-446655440006', 'Person with hoodie', 'text', 'vec_011', '{"confidence": 0.78, "filters_applied": ["clothing"]}', NOW() - INTERVAL '6 days'),
      (1, '550e8400-e29b-41d4-a716-446655440007', 'Group of people gathering', 'text', 'vec_012', '{"confidence": 0.85, "filters_applied": ["group", "behavior"]}', NOW() - INTERVAL '6 days 3 hours')
      ON CONFLICT DO NOTHING
    `);

    // Insert search filters
    console.log('🔧 Inserting search filters...');
    await pool.query(`
      INSERT INTO search_filters (search_id, filter_type, filter_value, created_at) VALUES
      (1, 'zone', '{"zone": "Zone A"}', NOW() - INTERVAL '2 hours'),
      (1, 'clothing_color', '{"color": "red", "item": "hat"}', NOW() - INTERVAL '2 hours'),
      (2, 'clothing_color', '{"color": "blue", "item": "jacket"}', NOW() - INTERVAL '4 hours'),
      (3, 'vehicle_type', '{"type": "van", "color": "white"}', NOW() - INTERVAL '6 hours'),
      (3, 'location', '{"area": "parking_lot"}', NOW() - INTERVAL '6 hours'),
      (4, 'time_range', '{"start": "08:00", "end": "18:00"}', NOW() - INTERVAL '1 day'),
      (5, 'time_range', '{"start": "06:00", "end": "12:00"}', NOW() - INTERVAL '1 day 2 hours'),
      (6, 'clothing_color', '{"color": "black", "item": "backpack"}', NOW() - INTERVAL '1 day 4 hours'),
      (7, 'time_range', '{"start": "00:00", "end": "23:59", "day": "weekend"}', NOW() - INTERVAL '3 days'),
      (8, 'time_range', '{"start": "22:00", "end": "06:00"}', NOW() - INTERVAL '4 days'),
      (9, 'incident_type', '{"type": "security_breach"}', NOW() - INTERVAL '5 days'),
      (10, 'vehicle_type', '{"type": "car", "search_type": "license_plate"}', NOW() - INTERVAL '5 days 2 hours'),
      (11, 'clothing_color', '{"color": "gray", "item": "hoodie"}', NOW() - INTERVAL '6 days'),
      (12, 'group_size', '{"min_people": 3, "max_people": 10}', NOW() - INTERVAL '6 days 3 hours')
      ON CONFLICT DO NOTHING
    `);

    // Insert search results
    console.log('📊 Inserting search results...');
    await pool.query(`
      INSERT INTO search_results (search_id, video_id, segment_id, score, thumbnail_url, video_timestamp, match_metadata, created_at) VALUES
      (1, 1, 1, 0.95, '/thumbnails/red_hat_person_001.jpg', '00:02:30', '{"bounding_box": [100, 150, 200, 300], "confidence": 0.95}', NOW() - INTERVAL '2 hours'),
      (1, 1, 2, 0.87, '/thumbnails/red_hat_person_002.jpg', '00:04:15', '{"bounding_box": [120, 160, 180, 280], "confidence": 0.87}', NOW() - INTERVAL '2 hours'),
      (2, 2, 1, 0.88, '/thumbnails/blue_jacket_001.jpg', '00:01:45', '{"bounding_box": [80, 140, 220, 320], "confidence": 0.88}', NOW() - INTERVAL '4 hours'),
      (3, 2, 2, 0.92, '/thumbnails/white_van_001.jpg', '00:03:20', '{"bounding_box": [50, 100, 400, 200], "confidence": 0.92}', NOW() - INTERVAL '6 hours'),
      (4, 3, 1, 0.76, '/thumbnails/suspicious_behavior_001.jpg', '00:05:10', '{"bounding_box": [90, 130, 250, 350], "confidence": 0.76}', NOW() - INTERVAL '1 day'),
      (5, 1, 3, 0.89, '/thumbnails/morning_crowd_001.jpg', '00:08:30', '{"bounding_box": [0, 0, 1920, 1080], "confidence": 0.89}', NOW() - INTERVAL '1 day 2 hours'),
      (6, 3, 2, 0.83, '/thumbnails/backpack_person_001.jpg', '00:02:15', '{"bounding_box": [110, 145, 190, 290], "confidence": 0.83}', NOW() - INTERVAL '1 day 4 hours'),
      (7, 1, 4, 0.91, '/thumbnails/weekend_security_001.jpg', '00:12:45', '{"bounding_box": [0, 0, 1920, 1080], "confidence": 0.91}', NOW() - INTERVAL '3 days'),
      (8, 2, 3, 0.87, '/thumbnails/night_shift_001.jpg', '00:23:30', '{"bounding_box": [0, 0, 1920, 1080], "confidence": 0.87}', NOW() - INTERVAL '4 days'),
      (9, 3, 3, 0.94, '/thumbnails/incident_001.jpg', '00:15:20', '{"bounding_box": [0, 0, 1920, 1080], "confidence": 0.94}', NOW() - INTERVAL '5 days'),
      (10, 2, 4, 0.96, '/thumbnails/license_plate_001.jpg', '00:07:55', '{"bounding_box": [200, 300, 400, 400], "confidence": 0.96}', NOW() - INTERVAL '5 days 2 hours'),
      (11, 1, 5, 0.78, '/thumbnails/hoodie_person_001.jpg', '00:09:40', '{"bounding_box": [95, 135, 205, 295], "confidence": 0.78}', NOW() - INTERVAL '6 days'),
      (12, 3, 4, 0.85, '/thumbnails/group_gathering_001.jpg', '00:11:25', '{"bounding_box": [0, 0, 1920, 1080], "confidence": 0.85}', NOW() - INTERVAL '6 days 3 hours')
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Sample search history data inserted successfully!');
    console.log('📋 Summary:');
    console.log('   - 8 search sessions created');
    console.log('   - 12 search queries created');
    console.log('   - 14 search filters created');
    console.log('   - 13 search results created');
    console.log('');
    console.log('🎯 The history page should now show real data instead of sample data!');

  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  } finally {
    await pool.end();
  }
};

// Run the script
insertSampleData();
