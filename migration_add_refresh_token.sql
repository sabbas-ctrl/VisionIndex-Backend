-- Migration: Add refresh_token column to users table
-- Run this SQL script in your PostgreSQL database

-- Add refresh_token column to users table
ALTER TABLE users ADD COLUMN refresh_token TEXT;

-- Add index for better performance when looking up refresh tokens
CREATE INDEX idx_users_refresh_token ON users(refresh_token);

-- Optional: Add comment to document the column
COMMENT ON COLUMN users.refresh_token IS 'Refresh token for JWT authentication, stored as random hex string';
