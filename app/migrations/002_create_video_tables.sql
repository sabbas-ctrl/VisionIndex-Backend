-- VisionIndex Video Upload and Ingestion Tables Migration
-- This migration creates the necessary tables for video upload, metadata, and segment management

-- 1. Videos Table
-- Main table for video file registry and basic metadata
CREATE TABLE IF NOT EXISTS public.videos (
    video_id SERIAL PRIMARY KEY,
    uploader_id INT REFERENCES public.users(user_id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,  -- Backblaze B2 bucket URL
    file_size BIGINT NOT NULL,
    duration INTERVAL,            -- Video duration
    resolution VARCHAR(50),       -- e.g., "1920x1080"
    checksum VARCHAR(128),        -- File integrity hash
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'uploaded', -- uploaded, processing, processed, failed
    labels JSONB,                 -- User-defined tags: { "zone": "Parking Lot A", "camera": "C12" }
    metadata JSONB,               -- Basic extracted info: { "codec": "h264", "fps": 30, "bitrate": "5000kbps" }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Video Segments Table
-- For pre-processing and analysis segments
CREATE TABLE IF NOT EXISTS public.video_segments (
    segment_id SERIAL PRIMARY KEY,
    video_id INT REFERENCES public.videos(video_id) ON DELETE CASCADE,
    start_time_sec INT NOT NULL,
    end_time_sec INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, processed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_uploader_id ON public.videos(uploader_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_upload_time ON public.videos(upload_time);
CREATE INDEX IF NOT EXISTS idx_videos_labels ON public.videos USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_videos_metadata ON public.videos USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON public.video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_segments_status ON public.video_segments(status);
CREATE INDEX IF NOT EXISTS idx_video_segments_time_range ON public.video_segments(start_time_sec, end_time_sec);

-- 3. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create triggers for updated_at
DROP TRIGGER IF EXISTS videos_updated_at_trigger ON public.videos;
CREATE TRIGGER videos_updated_at_trigger
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS video_segments_updated_at_trigger ON public.video_segments;
CREATE TRIGGER video_segments_updated_at_trigger
    BEFORE UPDATE ON public.video_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Create function to log video upload activity
CREATE OR REPLACE FUNCTION log_video_upload_activity(
    p_user_id INT,
    p_session_id UUID,
    p_video_id INT,
    p_file_name VARCHAR(255),
    p_file_size BIGINT,
    p_ip_address VARCHAR(50) DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    log_id INT;
BEGIN
    INSERT INTO public.user_activity_log (
        user_id, session_id, action_type, target_id, 
        ip_address, status, details
    ) VALUES (
        p_user_id, p_session_id, 'video_upload', p_video_id::TEXT,
        p_ip_address, 'success', 
        jsonb_build_object(
            'file_name', p_file_name,
            'file_size', p_file_size,
            'video_id', p_video_id
        )
    ) RETURNING log_id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get video statistics
CREATE OR REPLACE FUNCTION get_video_stats(p_user_id INT DEFAULT NULL)
RETURNS TABLE (
    total_videos BIGINT,
    total_size_gb NUMERIC,
    videos_today BIGINT,
    avg_duration_sec NUMERIC,
    processing_videos BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_videos,
        ROUND(SUM(file_size) / (1024.0 * 1024.0 * 1024.0), 2) as total_size_gb,
        COUNT(*) FILTER (WHERE upload_time >= CURRENT_DATE) as videos_today,
        ROUND(AVG(EXTRACT(EPOCH FROM duration)), 2) as avg_duration_sec,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_videos
    FROM public.videos
    WHERE (p_user_id IS NULL OR uploader_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 7. Create view for video summary with user info
CREATE OR REPLACE VIEW video_summary AS
SELECT 
    v.video_id,
    v.file_name,
    v.original_name,
    v.file_size,
    v.duration,
    v.resolution,
    v.status,
    v.upload_time,
    v.labels,
    v.metadata,
    u.username as uploader_username,
    u.email as uploader_email,
    r.role_name as uploader_role
FROM public.videos v
LEFT JOIN public.users u ON v.uploader_id = u.user_id
LEFT JOIN public.roles r ON u.role_id = r.role_id
ORDER BY v.upload_time DESC;

-- 8. Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON public.videos TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON public.video_segments TO your_app_user;
-- GRANT USAGE ON SEQUENCE videos_video_id_seq TO your_app_user;
-- GRANT USAGE ON SEQUENCE video_segments_segment_id_seq TO your_app_user;

