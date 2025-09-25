-- VisionIndex Database Seeding Script
-- This SQL script populates the database with roles and permissions
-- Run this script in your PostgreSQL database

-- Clear existing data (in correct order due to foreign key constraints)
DELETE FROM role_permissions;
DELETE FROM permissions;
DELETE FROM roles;

-- Reset sequences (optional, but ensures clean IDs)
ALTER SEQUENCE roles_role_id_seq RESTART WITH 1;
ALTER SEQUENCE permissions_permission_id_seq RESTART WITH 1;

-- Insert Permissions
INSERT INTO permissions (permission_name, description) VALUES
-- User Management
('user.read', 'View user information and profiles'),
('user.create', 'Create new user accounts'),
('user.update', 'Update user information and settings'),
('user.delete', 'Delete user accounts'),
('user.manage', 'Full user management capabilities'),

-- Role Management
('role.read', 'View roles and their permissions'),
('role.create', 'Create new roles'),
('role.update', 'Update role information and permissions'),
('role.delete', 'Delete roles'),
('role.assign', 'Assign roles to users'),

-- Permission Management
('permission.read', 'View available permissions'),
('permission.manage', 'Manage permissions and role assignments'),

-- Video Management
('video.upload', 'Upload CCTV videos for analysis'),
('video.read', 'View and access uploaded videos'),
('video.delete', 'Delete uploaded videos'),
('video.process', 'Process videos for facial recognition'),

-- Detection & Analysis
('detection.view', 'View detection results and analytics'),
('detection.search', 'Search through detection data'),
('detection.export', 'Export detection data and reports'),
('detection.analyze', 'Perform advanced analysis on detection data'),

-- Facial Recognition
('face.detect', 'Detect faces in video footage'),
('face.match', 'Match faces across different videos'),
('face.identify', 'Identify specific individuals'),
('face.manage', 'Manage facial recognition database'),

-- Zone Management
('zone.read', 'View institutional zones and areas'),
('zone.create', 'Create new zones for tracking'),
('zone.update', 'Update zone information'),
('zone.delete', 'Delete zones'),

-- Analytics & Reporting
('analytics.view', 'View system analytics and statistics'),
('analytics.export', 'Export analytics data'),
('report.generate', 'Generate custom reports'),
('report.export', 'Export reports in various formats'),

-- System Administration
('system.settings', 'Manage system settings and configuration'),
('system.logs', 'View system logs and audit trails'),
('system.monitor', 'Monitor system health and performance'),
('system.backup', 'Perform system backups'),

-- Dashboard Access
('dashboard.view', 'Access main dashboard'),
('dashboard.admin', 'Access administrative dashboard'),

-- Session Management
('session.view', 'View active user sessions'),
('session.manage', 'Manage user sessions'),
('session.revoke', 'Revoke user sessions');

-- Insert Roles
INSERT INTO roles (role_name, description) VALUES
('Super Admin', 'Full system access with all permissions. Can manage everything in the system.'),
('Admin', 'Administrative access with most permissions except critical system functions.'),
('Security Analyst', 'Security-focused role for analyzing CCTV footage and managing facial recognition.'),
('Data Analyst', 'Analytics-focused role for viewing and analyzing detection data.'),
('Operator', 'Basic operational role for uploading videos and viewing basic analytics.'),
('Viewer', 'Read-only access for viewing basic information and reports.'),
('System Manager', 'System management role with access to system settings and monitoring.');

-- Assign permissions to roles
-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Super Admin';

-- Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Admin'
AND p.permission_name IN (
    'user.read', 'user.create', 'user.update', 'user.delete',
    'role.read', 'role.create', 'role.update', 'role.assign',
    'permission.read', 'permission.manage',
    'video.upload', 'video.read', 'video.delete', 'video.process',
    'detection.view', 'detection.search', 'detection.export', 'detection.analyze',
    'face.detect', 'face.match', 'face.identify', 'face.manage',
    'zone.read', 'zone.create', 'zone.update', 'zone.delete',
    'analytics.view', 'analytics.export', 'report.generate', 'report.export',
    'dashboard.view', 'dashboard.admin',
    'session.view', 'session.manage', 'session.revoke'
);

-- Security Analyst permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Security Analyst'
AND p.permission_name IN (
    'video.upload', 'video.read', 'video.process',
    'detection.view', 'detection.search', 'detection.export', 'detection.analyze',
    'face.detect', 'face.match', 'face.identify', 'face.manage',
    'zone.read',
    'analytics.view', 'analytics.export', 'report.generate', 'report.export',
    'dashboard.view',
    'session.view'
);

-- Data Analyst permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Data Analyst'
AND p.permission_name IN (
    'video.read',
    'detection.view', 'detection.search', 'detection.export', 'detection.analyze',
    'face.detect', 'face.match', 'face.identify',
    'zone.read',
    'analytics.view', 'analytics.export', 'report.generate', 'report.export',
    'dashboard.view'
);

-- Operator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Operator'
AND p.permission_name IN (
    'video.upload', 'video.read',
    'detection.view', 'detection.search',
    'face.detect',
    'zone.read',
    'analytics.view',
    'dashboard.view'
);

-- Viewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Viewer'
AND p.permission_name IN (
    'video.read',
    'detection.view',
    'zone.read',
    'analytics.view',
    'dashboard.view'
);

-- System Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'System Manager'
AND p.permission_name IN (
    'user.read', 'user.create', 'user.update',
    'role.read',
    'permission.read',
    'video.read', 'video.delete',
    'detection.view', 'detection.export',
    'zone.read', 'zone.create', 'zone.update', 'zone.delete',
    'analytics.view', 'analytics.export', 'report.generate', 'report.export',
    'system.settings', 'system.logs', 'system.monitor',
    'dashboard.view', 'dashboard.admin',
    'session.view', 'session.manage'
);

-- Display summary
SELECT 
    'Seeding Complete' as status,
    (SELECT COUNT(*) FROM roles) as roles_created,
    (SELECT COUNT(*) FROM permissions) as permissions_created,
    (SELECT COUNT(*) FROM role_permissions) as assignments_created;

-- Show roles and their permission counts
SELECT 
    r.role_name,
    r.description,
    COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
GROUP BY r.role_id, r.role_name, r.description
ORDER BY r.role_id;
