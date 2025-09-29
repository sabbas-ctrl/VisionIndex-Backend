-- Analytics and Dashboard Demo Data Seed File
-- This file populates the database with comprehensive demo data for testing

-- First, ensure we have some basic users and videos
-- (Assuming these already exist from previous seed files)

-- Insert sample detection events for analytics
INSERT INTO detection_events (video_id, detection_type, confidence_score, bounding_box, attributes, timestamp_in_video, created_at) VALUES
-- Video 1 detections
(1, 'person', 0.95, '[100, 200, 150, 300]', '{"clothing_color": ["blue"], "age_range": "25-35", "gender": "male"}', '00:01:30', NOW() - INTERVAL '2 hours'),
(1, 'person', 0.87, '[300, 150, 200, 350]', '{"clothing_color": ["red"], "age_range": "20-30", "gender": "female"}', '00:02:15', NOW() - INTERVAL '2 hours'),
(1, 'vehicle', 0.92, '[50, 400, 300, 200]', '{"color": "white", "type": "car"}', '00:03:00', NOW() - INTERVAL '2 hours'),
(1, 'face', 0.89, '[120, 180, 80, 100]', '{"age_range": "25-35", "gender": "male"}', '00:01:45', NOW() - INTERVAL '2 hours'),
(1, 'object', 0.78, '[250, 300, 100, 80]', '{"type": "bag", "color": "black"}', '00:02:30', NOW() - INTERVAL '2 hours'),

-- Video 2 detections
(2, 'person', 0.91, '[150, 250, 120, 280]', '{"clothing_color": ["green"], "age_range": "30-40", "gender": "male"}', '00:00:45', NOW() - INTERVAL '4 hours'),
(2, 'person', 0.83, '[400, 200, 180, 320]', '{"clothing_color": ["yellow"], "age_range": "25-35", "gender": "female"}', '00:01:20', NOW() - INTERVAL '4 hours'),
(2, 'vehicle', 0.88, '[100, 350, 250, 150]', '{"color": "black", "type": "suv"}', '00:02:10', NOW() - INTERVAL '4 hours'),
(2, 'face', 0.94, '[200, 160, 90, 110]', '{"age_range": "30-40", "gender": "male"}', '00:00:55', NOW() - INTERVAL '4 hours'),

-- Video 3 detections
(3, 'person', 0.86, '[80, 180, 140, 290]', '{"clothing_color": ["black"], "age_range": "20-30", "gender": "female"}', '00:00:30', NOW() - INTERVAL '6 hours'),
(3, 'vehicle', 0.93, '[200, 400, 280, 180]', '{"color": "blue", "type": "sedan"}', '00:01:15', NOW() - INTERVAL '6 hours'),
(3, 'object', 0.75, '[350, 280, 120, 90]', '{"type": "backpack", "color": "gray"}', '00:01:45', NOW() - INTERVAL '6 hours'),

-- More recent detections for today's analytics
(1, 'person', 0.92, '[120, 220, 160, 310]', '{"clothing_color": ["white"], "age_range": "25-35", "gender": "male"}', '00:04:20', NOW() - INTERVAL '30 minutes'),
(2, 'person', 0.89, '[180, 190, 150, 300]', '{"clothing_color": ["purple"], "age_range": "20-30", "gender": "female"}', '00:03:30', NOW() - INTERVAL '1 hour'),
(3, 'vehicle', 0.90, '[300, 380, 200, 160]', '{"color": "red", "type": "truck"}', '00:02:45', NOW() - INTERVAL '1 hour 30 minutes');

-- Insert sample search sessions
INSERT INTO search_sessions (user_id, title, created_at, updated_at) VALUES
(1, 'Security Investigation - Zone A', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(1, 'Person of Interest Search', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(1, 'Vehicle Tracking Analysis', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
(2, 'Incident Review - Main Entrance', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(2, 'Daily Security Check', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(3, 'Access Control Audit', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');

-- Insert sample searches
INSERT INTO searches (user_id, search_session_id, query_text, query_type, query_metadata, created_at) VALUES
-- Session 1 searches
(1, (SELECT session_id FROM search_sessions WHERE title = 'Security Investigation - Zone A' LIMIT 1), 'person in blue jacket', 'text', '{"intent": "find_person", "complexity": 0.3}', NOW() - INTERVAL '2 days'),
(1, (SELECT session_id FROM search_sessions WHERE title = 'Security Investigation - Zone A' LIMIT 1), 'man with black bag', 'text', '{"intent": "find_person", "complexity": 0.4}', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
(1, (SELECT session_id FROM search_sessions WHERE title = 'Security Investigation - Zone A' LIMIT 1), 'white car in parking area', 'text', '{"intent": "find_vehicle", "complexity": 0.5}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),

-- Session 2 searches
(1, (SELECT session_id FROM search_sessions WHERE title = 'Person of Interest Search' LIMIT 1), 'woman with red shirt', 'text', '{"intent": "find_person", "complexity": 0.3}', NOW() - INTERVAL '1 day'),
(1, (SELECT session_id FROM search_sessions WHERE title = 'Person of Interest Search' LIMIT 1), 'face recognition search', 'face', '{"intent": "find_person", "complexity": 0.8}', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes'),

-- Session 3 searches
(1, (SELECT session_id FROM search_sessions WHERE title = 'Vehicle Tracking Analysis' LIMIT 1), 'black SUV near entrance', 'text', '{"intent": "find_vehicle", "complexity": 0.6}', NOW() - INTERVAL '6 hours'),
(1, (SELECT session_id FROM search_sessions WHERE title = 'Vehicle Tracking Analysis' LIMIT 1), 'suspicious activity in zone b', 'text', '{"intent": "find_activity", "complexity": 0.7}', NOW() - INTERVAL '6 hours' + INTERVAL '20 minutes'),

-- Other users' searches
(2, (SELECT session_id FROM search_sessions WHERE title = 'Incident Review - Main Entrance' LIMIT 1), 'person with backpack', 'text', '{"intent": "find_person", "complexity": 0.4}', NOW() - INTERVAL '3 days'),
(2, (SELECT session_id FROM search_sessions WHERE title = 'Daily Security Check' LIMIT 1), 'unauthorized access attempt', 'text', '{"intent": "find_activity", "complexity": 0.9}', NOW() - INTERVAL '1 day'),
(3, (SELECT session_id FROM search_sessions WHERE title = 'Access Control Audit' LIMIT 1), 'employee badge verification', 'text', '{"intent": "find_person", "complexity": 0.5}', NOW() - INTERVAL '4 days');

-- Insert sample search filters
INSERT INTO search_filters (search_id, filter_type, filter_value, created_at) VALUES
-- Filters for first search
((SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 'time_range', '{"start": "14:00", "end": "16:00"}', NOW() - INTERVAL '2 days'),
((SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 'zone', '{"zone": "Zone A"}', NOW() - INTERVAL '2 days'),
((SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 'clothing_color', '{"color": "blue"}', NOW() - INTERVAL '2 days'),

-- Filters for second search
((SELECT search_id FROM searches WHERE query_text = 'man with black bag' LIMIT 1), 'object_type', '{"type": "bag"}', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
((SELECT search_id FROM searches WHERE query_text = 'man with black bag' LIMIT 1), 'gender', '{"gender": "male"}', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),

-- Filters for vehicle search
((SELECT search_id FROM searches WHERE query_text = 'white car in parking area' LIMIT 1), 'zone', '{"zone": "Parking Zone"}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
((SELECT search_id FROM searches WHERE query_text = 'white car in parking area' LIMIT 1), 'vehicle_color', '{"color": "white"}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),

-- Filters for face search
((SELECT search_id FROM searches WHERE query_text = 'face recognition search' LIMIT 1), 'age_range', '{"min": 25, "max": 35}', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes'),
((SELECT search_id FROM searches WHERE query_text = 'face recognition search' LIMIT 1), 'zone', '{"zone": "Zone B"}', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes');

-- Insert sample search results
INSERT INTO search_results (search_id, video_id, segment_id, score, thumbnail_url, video_timestamp, match_metadata, created_at) VALUES
-- Results for "person in blue jacket"
((SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 1, 1, 0.92, '/thumbnails/person_blue_jacket_1.jpg', '00:01:30', '{"bounding_box": [100, 200, 150, 300], "confidence": 0.95}', NOW() - INTERVAL '2 days'),
((SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 2, 2, 0.87, '/thumbnails/person_blue_jacket_2.jpg', '00:02:15', '{"bounding_box": [300, 150, 200, 350], "confidence": 0.87}', NOW() - INTERVAL '2 days'),

-- Results for "man with black bag"
((SELECT search_id FROM searches WHERE query_text = 'man with black bag' LIMIT 1), 1, 3, 0.89, '/thumbnails/man_black_bag_1.jpg', '00:02:30', '{"bounding_box": [250, 300, 100, 80], "confidence": 0.78}', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),

-- Results for "white car in parking area"
((SELECT search_id FROM searches WHERE query_text = 'white car in parking area' LIMIT 1), 1, 4, 0.94, '/thumbnails/white_car_1.jpg', '00:03:00', '{"bounding_box": [50, 400, 300, 200], "confidence": 0.92}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
((SELECT search_id FROM searches WHERE query_text = 'white car in parking area' LIMIT 1), 2, 5, 0.91, '/thumbnails/white_car_2.jpg', '00:01:15', '{"bounding_box": [200, 400, 280, 180], "confidence": 0.93}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),

-- Results for "woman with red shirt"
((SELECT search_id FROM searches WHERE query_text = 'woman with red shirt' LIMIT 1), 1, 6, 0.88, '/thumbnails/woman_red_shirt_1.jpg', '00:02:15', '{"bounding_box": [300, 150, 200, 350], "confidence": 0.87}', NOW() - INTERVAL '1 day'),

-- Results for "face recognition search"
((SELECT search_id FROM searches WHERE query_text = 'face recognition search' LIMIT 1), 1, 7, 0.95, '/thumbnails/face_recognition_1.jpg', '00:01:45', '{"bounding_box": [120, 180, 80, 100], "confidence": 0.89}', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes'),
((SELECT search_id FROM searches WHERE query_text = 'face recognition search' LIMIT 1), 2, 8, 0.91, '/thumbnails/face_recognition_2.jpg', '00:00:55', '{"bounding_box": [200, 160, 90, 110], "confidence": 0.94}', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes');

-- Insert sample result interactions
INSERT INTO result_interactions (result_id, search_id, user_id, action_type, duration_viewed, client_info, created_at) VALUES
-- Interactions for first result
(1, (SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 1, 'viewed', '00:00:15', '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days'),
(1, (SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 1, 'bookmarked', NULL, '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),

-- Interactions for second result
(2, (SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 1, 'viewed', '00:00:08', '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days' + INTERVAL '2 minutes'),
(2, (SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 1, 'downloaded', NULL, '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days' + INTERVAL '3 minutes'),

-- More interactions
(3, (SELECT search_id FROM searches WHERE query_text = 'man with black bag' LIMIT 1), 1, 'viewed', '00:00:12', '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
(4, (SELECT search_id FROM searches WHERE query_text = 'white car in parking area' LIMIT 1), 1, 'viewed', '00:00:20', '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
(5, (SELECT search_id FROM searches WHERE query_text = 'white car in parking area' LIMIT 1), 1, 'flagged', NULL, '{"browser": "Chrome", "device": "desktop"}', NOW() - INTERVAL '2 days' + INTERVAL '1 hour' + INTERVAL '5 minutes');

-- Insert sample analytics aggregations
INSERT INTO analytics_aggregations (metric_name, metric_type, time_bucket, time_granularity, value, metadata, created_at) VALUES
-- Today's metrics
('total_detections_today', 'counter', DATE_TRUNC('day', NOW()), 'day', 8, '{"source": "detection_events"}', NOW()),
('videos_uploaded_this_week', 'counter', DATE_TRUNC('week', NOW()), 'week', 3, '{"source": "videos"}', NOW()),
('unique_persons_detected', 'gauge', DATE_TRUNC('week', NOW()), 'week', 5, '{"source": "detection_events"}', NOW()),
('searches_performed_today', 'counter', DATE_TRUNC('day', NOW()), 'day', 3, '{"source": "searches"}', NOW()),
('tool_usage_count', 'counter', DATE_TRUNC('month', NOW()), 'month', 15, '{"source": "searches"}', NOW()),
('daily_usage_time_hours', 'gauge', DATE_TRUNC('day', NOW()), 'day', 4.2, '{"source": "user_sessions"}', NOW()),
('weekly_usage_time_hours', 'gauge', DATE_TRUNC('week', NOW()), 'week', 28.5, '{"source": "user_sessions"}', NOW()),
('avg_video_length_minutes', 'gauge', DATE_TRUNC('day', NOW()), 'day', 12.4, '{"source": "videos"}', NOW()),

-- Yesterday's metrics for comparison
('total_detections_today', 'counter', DATE_TRUNC('day', NOW() - INTERVAL '1 day'), 'day', 12, '{"source": "detection_events"}', NOW() - INTERVAL '1 day'),
('searches_performed_today', 'counter', DATE_TRUNC('day', NOW() - INTERVAL '1 day'), 'day', 5, '{"source": "searches"}', NOW() - INTERVAL '1 day'),

-- Last week's metrics for comparison
('videos_uploaded_this_week', 'counter', DATE_TRUNC('week', NOW() - INTERVAL '1 week'), 'week', 2, '{"source": "videos"}', NOW() - INTERVAL '1 week'),
('unique_persons_detected', 'gauge', DATE_TRUNC('week', NOW() - INTERVAL '1 week'), 'week', 3, '{"source": "detection_events"}', NOW() - INTERVAL '1 week');

-- Insert sample system metrics
INSERT INTO system_metrics (metric_name, metric_value, unit, tags, timestamp) VALUES
('active_users', 3, 'users', '{"type": "system"}', NOW()),
('total_videos_processed', 3, 'videos', '{"type": "system"}', NOW()),
('searches_last_24h', 3, 'searches', '{"type": "system"}', NOW()),
('avg_processing_time_seconds', 45.2, 'seconds', '{"type": "system"}', NOW()),
('gpu_usage_percent', 78.5, 'percent', '{"type": "system"}', NOW()),
('memory_usage_mb', 2048, 'mb', '{"type": "system"}', NOW()),
('cpu_usage_percent', 65.3, 'percent', '{"type": "system"}', NOW()),

-- Historical metrics
('active_users', 2, 'users', '{"type": "system"}', NOW() - INTERVAL '1 hour'),
('active_users', 4, 'users', '{"type": "system"}', NOW() - INTERVAL '2 hours'),
('active_users', 1, 'users', '{"type": "system"}', NOW() - INTERVAL '3 hours');

-- Insert sample upload sessions
INSERT INTO upload_sessions (user_id, video_id, upload_started, upload_completed, processing_started, processing_completed, status, metadata, created_at, updated_at) VALUES
(1, 1, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes', NOW() - INTERVAL '3 days' + INTERVAL '8 minutes', 'completed', '{"file_size": 15728640, "duration": "00:05:30"}', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '8 minutes'),
(2, 2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '3 minutes', NOW() - INTERVAL '2 days' + INTERVAL '3 minutes', NOW() - INTERVAL '2 days' + INTERVAL '6 minutes', 'completed', '{"file_size": 20971520, "duration": "00:07:15"}', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '6 minutes'),
(1, 3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '4 minutes', NOW() - INTERVAL '1 day' + INTERVAL '4 minutes', NOW() - INTERVAL '1 day' + INTERVAL '7 minutes', 'completed', '{"file_size": 12582912, "duration": "00:04:45"}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '7 minutes'),
(3, 4, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '2 minutes', NOW() - INTERVAL '6 hours' + INTERVAL '2 minutes', NOW() - INTERVAL '6 hours' + INTERVAL '5 minutes', 'completed', '{"file_size": 8388608, "duration": "00:03:20"}', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '5 minutes'),
(2, 5, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes', NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes', NULL, 'processing', '{"file_size": 18874368, "duration": "00:06:10"}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes');

-- Insert sample saved searches
INSERT INTO saved_searches (user_id, search_id, label, notes, created_at) VALUES
(1, (SELECT search_id FROM searches WHERE query_text = 'person in blue jacket' LIMIT 1), 'Blue Jacket Person', 'High priority search for security investigation', NOW() - INTERVAL '2 days'),
(1, (SELECT search_id FROM searches WHERE query_text = 'face recognition search' LIMIT 1), 'Face Recognition Query', 'Used for person identification', NOW() - INTERVAL '1 day'),
(2, (SELECT search_id FROM searches WHERE query_text = 'person with backpack' LIMIT 1), 'Backpack Person Search', 'Common search pattern for security', NOW() - INTERVAL '3 days');

-- Insert sample bookmarked results
INSERT INTO bookmarked_results (user_id, result_id, label, created_at) VALUES
(1, 1, 'Important Match - Blue Jacket', NOW() - INTERVAL '2 days'),
(1, 4, 'White Car Evidence', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
(2, 6, 'Red Shirt Person', NOW() - INTERVAL '1 day');

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_detection_events_created_at ON detection_events(created_at);
CREATE INDEX IF NOT EXISTS idx_detection_events_detection_type ON detection_events(detection_type);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at);
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
CREATE INDEX IF NOT EXISTS idx_search_results_search_id ON search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_metric_name ON analytics_aggregations(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_time_bucket ON analytics_aggregations(time_bucket);

-- Update video segments to link with our sample data
UPDATE video_segments SET 
  start_time_sec = 90, 
  end_time_sec = 180, 
  status = 'completed' 
WHERE segment_id = 1;

UPDATE video_segments SET 
  start_time_sec = 180, 
  end_time_sec = 270, 
  status = 'completed' 
WHERE segment_id = 2;

-- Add more video segments if needed
INSERT INTO video_segments (video_id, start_time_sec, end_time_sec, status, created_at, updated_at) VALUES
(1, 270, 360, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(1, 360, 450, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(2, 0, 90, 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(2, 90, 180, 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(2, 180, 270, 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(3, 0, 60, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(3, 60, 120, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(3, 120, 180, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

COMMIT;
