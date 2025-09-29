import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/RefreshToken.js';

export const authMiddleware = (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { 
      user_id: decoded.userId || decoded.user_id, 
      permissions: decoded.permissions || [] 
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid/expired token' });
  }
};

// Middleware to validate refresh tokens
export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not provided' });
    }

    // Validate refresh token from database
    const tokenRecord = await RefreshToken.findByToken(refreshToken);
    if (!tokenRecord) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Add user info to request
    req.user = { userId: tokenRecord.user_id };
    req.refreshTokenRecord = tokenRecord;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Token validation error' });
  }
};

// Middleware to check specific permissions
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

// Middleware to check multiple permissions (user needs ALL of them)
export const requireAllPermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAllPermissions = permissions.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

// Middleware to check multiple permissions (user needs ANY of them)
export const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAnyPermission = permissions.some(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

