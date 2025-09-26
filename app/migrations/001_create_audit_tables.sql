-- VisionIndex Audit and Logging Tables Migration
-- This migration creates the necessary tables for user audit and system logging

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Sessions Table
-- Tracks multiple devices/sessions per user
CREATE TABLE IF NOT EXISTS public.user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES public.users(user_id) ON DELETE CASCADE,
    device_info VARCHAR(255),
    ip_address VARCHAR(50),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' -- active, expired, terminated
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON public.user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_time ON public.user_sessions(login_time);

-- 2. User Activity Log Table
-- Every action performed by a user, tied to a session
CREATE TABLE IF NOT EXISTS public.user_activity_log (
    log_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES public.users(user_id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.user_sessions(session_id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,       -- upload, search, export, login, logout, etc.
    target_id TEXT,                         -- flexible reference (e.g., video_id, search_id)
    ip_address VARCHAR(50),
    status VARCHAR(20) DEFAULT 'success',   -- success, failure, warning
    details JSONB,                          -- params, device info, etc.
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_session_id ON public.user_activity_log(session_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action_type ON public.user_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_timestamp ON public.user_activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_status ON public.user_activity_log(status);

-- 3. Audit Trail Table
-- Immutable exports of activity logs for admins
CREATE TABLE IF NOT EXISTS public.audit_trail (
    audit_id SERIAL PRIMARY KEY,
    exported_by_user_id INT REFERENCES public.users(user_id) ON DELETE SET NULL,
    audit_name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    source_log_ids JSONB,       -- array of user_activity_log IDs
    details JSONB,              -- frozen snapshot of logs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_trail_exported_by ON public.audit_trail(exported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON public.audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_time_range ON public.audit_trail(start_time, end_time);

-- 4. Create trigger to prevent UPDATE/DELETE on audit_trail (security best practice)
CREATE OR REPLACE FUNCTION prevent_audit_trail_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail records cannot be modified or deleted for security reasons';
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to audit_trail table
DROP TRIGGER IF EXISTS audit_trail_protection_trigger ON public.audit_trail;
CREATE TRIGGER audit_trail_protection_trigger
    BEFORE UPDATE OR DELETE ON public.audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_trail_modification();

-- 5. Create function to automatically log user activities
CREATE OR REPLACE FUNCTION log_user_activity(
    p_user_id INT,
    p_session_id UUID,
    p_action_type VARCHAR(50),
    p_target_id TEXT DEFAULT NULL,
    p_ip_address VARCHAR(50) DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success',
    p_details JSONB DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    log_id INT;
BEGIN
    INSERT INTO public.user_activity_log (
        user_id, session_id, action_type, target_id, 
        ip_address, status, details
    ) VALUES (
        p_user_id, p_session_id, p_action_type, p_target_id,
        p_ip_address, p_status, p_details
    ) RETURNING log_id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get user activity statistics
CREATE OR REPLACE FUNCTION get_user_activity_stats(p_user_id INT DEFAULT NULL)
RETURNS TABLE (
    total_activities BIGINT,
    activities_today BIGINT,
    active_users BIGINT,
    system_health NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_activities,
        COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as activities_today,
        COUNT(DISTINCT user_id) as active_users,
        ROUND(
            (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
             NULLIF(COUNT(*), 0) * 100), 2
        ) as system_health
    FROM public.user_activity_log
    WHERE (p_user_id IS NULL OR user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 7. Create view for audit log summary
CREATE OR REPLACE VIEW audit_log_summary AS
SELECT 
    ual.log_id,
    u.username,
    r.role_name,
    ual.action_type,
    ual.target_id,
    ual.status,
    ual.timestamp,
    ual.details,
    us.device_info,
    us.ip_address as session_ip
FROM public.user_activity_log ual
LEFT JOIN public.users u ON ual.user_id = u.user_id
LEFT JOIN public.roles r ON u.role_id = r.role_id
LEFT JOIN public.user_sessions us ON ual.session_id = us.session_id
ORDER BY ual.timestamp DESC;

-- 8. Insert some sample data for testing (optional)
-- This can be removed in production
INSERT INTO public.user_sessions (user_id, device_info, ip_address, status) VALUES
(1, 'Chrome 120.0 on Windows 10', '192.168.1.100', 'active'),
(2, 'Firefox 121.0 on macOS', '192.168.1.101', 'active'),
(3, 'Safari 17.0 on iOS', '192.168.1.102', 'expired');

-- Sample activity logs
INSERT INTO public.user_activity_log (user_id, session_id, action_type, target_id, ip_address, status, details) VALUES
(1, (SELECT session_id FROM public.user_sessions WHERE user_id = 1 LIMIT 1), 'login', NULL, '192.168.1.100', 'success', '{"browser": "Chrome", "os": "Windows 10"}'),
(1, (SELECT session_id FROM public.user_sessions WHERE user_id = 1 LIMIT 1), 'video_upload', 'video_123', '192.168.1.100', 'success', '{"file_size": "50MB", "duration": "300s"}'),
(2, (SELECT session_id FROM public.user_sessions WHERE user_id = 2 LIMIT 1), 'search', 'search_456', '192.168.1.101', 'success', '{"query": "face detection", "results_count": 15}'),
(3, (SELECT session_id FROM public.user_sessions WHERE user_id = 3 LIMIT 1), 'export', 'export_789', '192.168.1.102', 'success', '{"format": "CSV", "records_count": 100}');

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO your_app_user;
-- GRANT SELECT, INSERT ON public.user_activity_log TO your_app_user;
-- GRANT SELECT, INSERT ON public.audit_trail TO your_app_user;
-- GRANT USAGE ON SEQUENCE user_activity_log_log_id_seq TO your_app_user;
-- GRANT USAGE ON SEQUENCE audit_trail_audit_id_seq TO your_app_user;
