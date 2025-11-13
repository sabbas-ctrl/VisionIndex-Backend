-- Prerequisites for Analytics Data Seeding
-- This file ensures required users and videos exist before seeding analytics data

-- Insert basic users if they don't exist
INSERT INTO users (user_id, username, email, password_hash, role_id, status, is_verified, created_at) VALUES
(1, 'admin', 'admin@visionindex.com', '$2b$10$example_hash_admin', 1, 'active', true, NOW() - INTERVAL '30 days'),
(2, 'analyst', 'analyst@visionindex.com', '$2b$10$example_hash_analyst', 2, 'active', true, NOW() - INTERVAL '25 days'),
(3, 'operator', 'operator@visionindex.com', '$2b$10$example_hash_operator', 3, 'active', true, NOW() - INTERVAL '20 days')
ON CONFLICT (user_id) DO NOTHING;

-- Insert basic roles if they don't exist
INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'admin', 'System Administrator'),
(2, 'analyst', 'Security Analyst'),
(3, 'operator', 'Security Operator')
ON CONFLICT (role_id) DO NOTHING;

-- Insert basic videos if they don't exist
INSERT INTO videos (video_id, uploader_id, file_name, original_name, storage_path, file_size, duration, resolution, checksum, upload_time, status, labels, metadata, created_at, updated_at) VALUES
(1, 1, 'security_cam_zone_a_001.mp4', 'security_cam_zone_a_001.mp4', '/storage/videos/security_cam_zone_a_001.mp4', 15728640, '00:05:30', '1920x1080', 'abc123def456', NOW() - INTERVAL '3 days', 'completed', '["zone_a", "security"]', '{"camera_id": "cam_001", "location": "Zone A Entrance"}', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(2, 2, 'parking_lot_surveillance_002.mp4', 'parking_lot_surveillance_002.mp4', '/storage/videos/parking_lot_surveillance_002.mp4', 20971520, '00:07:15', '1920x1080', 'def456ghi789', NOW() - INTERVAL '2 days', 'completed', '["parking", "surveillance"]', '{"camera_id": "cam_002", "location": "Parking Lot"}', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(3, 1, 'main_entrance_003.mp4', 'main_entrance_003.mp4', '/storage/videos/main_entrance_003.mp4', 12582912, '00:04:45', '1920x1080', 'ghi789jkl012', NOW() - INTERVAL '1 day', 'completed', '["entrance", "main"]', '{"camera_id": "cam_003", "location": "Main Entrance"}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(4, 3, 'zone_b_monitoring_004.mp4', 'zone_b_monitoring_004.mp4', '/storage/videos/zone_b_monitoring_004.mp4', 8388608, '00:03:20', '1920x1080', 'jkl012mno345', NOW() - INTERVAL '6 hours', 'completed', '["zone_b", "monitoring"]', '{"camera_id": "cam_004", "location": "Zone B"}', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
(5, 2, 'emergency_exit_005.mp4', 'emergency_exit_005.mp4', '/storage/videos/emergency_exit_005.mp4', 18874368, '00:06:10', '1920x1080', 'mno345pqr678', NOW() - INTERVAL '2 hours', 'processing', '["emergency", "exit"]', '{"camera_id": "cam_005", "location": "Emergency Exit"}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
ON CONFLICT (video_id) DO NOTHING;

-- Insert basic video segments if they don't exist
INSERT INTO video_segments (segment_id, video_id, start_time_sec, end_time_sec, status, created_at, updated_at) VALUES
(1, 1, 90, 180, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(2, 1, 180, 270, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(3, 1, 270, 360, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(4, 1, 360, 450, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(5, 2, 0, 90, 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(6, 2, 90, 180, 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(7, 2, 180, 270, 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(8, 3, 0, 60, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(9, 3, 60, 120, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(10, 3, 120, 180, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (segment_id) DO NOTHING;

COMMIT;
