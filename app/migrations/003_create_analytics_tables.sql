-- Analytics and Dashboard Tables
-- This migration creates tables for analytics, search sessions, and dashboard data

-- Upload sessions to track video processing pipeline
CREATE TABLE IF NOT EXISTS public.upload_sessions (
    upload_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES public.users(user_id) ON DELETE SET NULL,
    video_id INT REFERENCES public.videos(video_id) ON DELETE CASCADE,
    upload_started TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    upload_completed TIMESTAMP,
    processing_started TIMESTAMP,
    processing_completed TIMESTAMP,
    status VARCHAR(30) DEFAULT 'uploading', -- uploading, processing, completed, failed
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search sessions to group related searches (chat-like functionality)
CREATE TABLE IF NOT EXISTS public.search_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES public.users(user_id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual search queries
CREATE TABLE IF NOT EXISTS public.searches (
    search_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES public.users(user_id) ON DELETE SET NULL,
    search_session_id UUID REFERENCES public.search_sessions(session_id) ON DELETE CASCADE,
    query_text TEXT,
    query_type VARCHAR(30),  -- text, image, face, vehicle
    query_vector_id UUID,    -- pointer to vector DB
    query_metadata JSONB,    -- image hash, preprocessing info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search filters applied to searches
CREATE TABLE IF NOT EXISTS public.search_filters (
    filter_id SERIAL PRIMARY KEY,
    search_id INT REFERENCES public.searches(search_id) ON DELETE CASCADE,
    filter_type VARCHAR(50),  -- time_range, zone, clothing_color, object_type, age_range, gender
    filter_value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search results linking to videos/segments
CREATE TABLE IF NOT EXISTS public.search_results (
    result_id SERIAL PRIMARY KEY,
    search_id INT REFERENCES public.searches(search_id) ON DELETE CASCADE,
    video_id INT REFERENCES public.videos(video_id) ON DELETE CASCADE,
    segment_id INT REFERENCES public.video_segments(segment_id) ON DELETE CASCADE,
    score NUMERIC(5,3),
    thumbnail_url TEXT,
    video_timestamp INTERVAL,
    match_metadata JSONB, -- bounding box, confidence, object details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User interactions with search results
CREATE TABLE IF NOT EXISTS public.result_interactions (
    interaction_id BIGSERIAL PRIMARY KEY,
    result_id INT REFERENCES public.search_results(result_id) ON DELETE CASCADE,
    search_id INT REFERENCES public.searches(search_id) ON DELETE CASCADE,
    user_id INT REFERENCES public.users(user_id) ON DELETE CASCADE,
    action_type VARCHAR(30),  -- viewed, downloaded, flagged, bookmarked, shared
    duration_viewed INTERVAL,
    client_info JSONB, -- device/browser/IP
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved searches for quick access
CREATE TABLE IF NOT EXISTS public.saved_searches (
    saved_search_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES public.users(user_id) ON DELETE CASCADE,
    search_id INT REFERENCES public.searches(search_id) ON DELETE CASCADE,
    label VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookmarked results
CREATE TABLE IF NOT EXISTS public.bookmarked_results (
    bookmark_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES public.users(user_id) ON DELETE CASCADE,
    result_id INT REFERENCES public.search_results(result_id) ON DELETE CASCADE,
    label VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics aggregations for dashboard performance
CREATE TABLE IF NOT EXISTS public.analytics_aggregations (
    aggregation_id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- counter, gauge, histogram
    time_bucket TIMESTAMP NOT NULL,
    time_granularity VARCHAR(20) NOT NULL, -- hour, day, week, month
    value NUMERIC(15,3) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_name, time_bucket, time_granularity)
);

-- Detection events for real-time analytics
CREATE TABLE IF NOT EXISTS public.detection_events (
    event_id BIGSERIAL PRIMARY KEY,
    video_id INT REFERENCES public.videos(video_id) ON DELETE CASCADE,
    segment_id INT REFERENCES public.video_segments(segment_id) ON DELETE CASCADE,
    detection_type VARCHAR(50) NOT NULL, -- person, vehicle, face, object
    confidence_score NUMERIC(5,3),
    bounding_box JSONB, -- [x, y, width, height]
    attributes JSONB, -- clothing, age, gender, etc.
    timestamp_in_video INTERVAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System performance metrics
CREATE TABLE IF NOT EXISTS public.system_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(15,3) NOT NULL,
    unit VARCHAR(20),
    tags JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON public.upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_video_id ON public.upload_sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON public.upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON public.upload_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_search_sessions_user_id ON public.search_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON public.search_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_searches_user_id ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_session_id ON public.searches(search_session_id);
CREATE INDEX IF NOT EXISTS idx_searches_query_type ON public.searches(query_type);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON public.searches(created_at);

CREATE INDEX IF NOT EXISTS idx_search_filters_search_id ON public.search_filters(search_id);
CREATE INDEX IF NOT EXISTS idx_search_filters_type ON public.search_filters(filter_type);

CREATE INDEX IF NOT EXISTS idx_search_results_search_id ON public.search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_search_results_video_id ON public.search_results(video_id);
CREATE INDEX IF NOT EXISTS idx_search_results_score ON public.search_results(score);
CREATE INDEX IF NOT EXISTS idx_search_results_created_at ON public.search_results(created_at);

CREATE INDEX IF NOT EXISTS idx_result_interactions_result_id ON public.result_interactions(result_id);
CREATE INDEX IF NOT EXISTS idx_result_interactions_user_id ON public.result_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_result_interactions_action_type ON public.result_interactions(action_type);
CREATE INDEX IF NOT EXISTS idx_result_interactions_created_at ON public.result_interactions(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_metric_name ON public.analytics_aggregations(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_time_bucket ON public.analytics_aggregations(time_bucket);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_metric_type ON public.analytics_aggregations(metric_type);

CREATE INDEX IF NOT EXISTS idx_detection_events_video_id ON public.detection_events(video_id);
CREATE INDEX IF NOT EXISTS idx_detection_events_detection_type ON public.detection_events(detection_type);
CREATE INDEX IF NOT EXISTS idx_detection_events_created_at ON public.detection_events(created_at);
CREATE INDEX IF NOT EXISTS idx_detection_events_timestamp_in_video ON public.detection_events(timestamp_in_video);

CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_name ON public.system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON public.system_metrics(timestamp);

-- Add comments for documentation
COMMENT ON TABLE public.upload_sessions IS 'Tracks video upload and processing pipeline status';
COMMENT ON TABLE public.search_sessions IS 'Groups related searches into chat-like sessions';
COMMENT ON TABLE public.searches IS 'Individual search queries with metadata';
COMMENT ON TABLE public.search_filters IS 'Filters applied to search queries';
COMMENT ON TABLE public.search_results IS 'Search results linking to video segments';
COMMENT ON TABLE public.result_interactions IS 'User interactions with search results';
COMMENT ON TABLE public.saved_searches IS 'User-saved searches for quick access';
COMMENT ON TABLE public.bookmarked_results IS 'User-bookmarked search results';
COMMENT ON TABLE public.analytics_aggregations IS 'Pre-computed analytics for dashboard performance';
COMMENT ON TABLE public.detection_events IS 'Individual detection events from AI pipeline';
COMMENT ON TABLE public.system_metrics IS 'System performance and health metrics';
