import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/RefreshToken.js';
import { ErrorLogger } from '../utils/errorLogger.js';

export const authMiddleware = (req, res, next) => {
  console.log(`🔍 Auth midd-leware called for ${req.method} ${req.originalUrl}`);
  const token = req.cookies.accessToken;
  if (!token) {
    // Don't log missing token errors for /auth/verify endpoint as it's used for checking auth status
    const isVerifyEndpoint = req.originalUrl === '/auth/verify';
    
    if (!isVerifyEndpoint) {
      // Log missing token asynchronously for other endpoints
      setImmediate(async () => {
        try {
          console.log('🔍 Attempting to log missing token error...');
          await ErrorLogger.logAuthError(
            new Error('Missing token'), 
            req, 
            'missing_token'
          );
          console.log('✅ Successfully logged missing token error');
        } catch (logError) {
          console.error('❌ Failed to log auth error:', logError);
        }
      });
    }
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { 
      userId: decoded.userId || decoded.user_id,
      user_id: decoded.userId || decoded.user_id, // Keep both for backward compatibility
      permissions: decoded.permissions || [] 
    };
    next();
  } catch (err) {
    // Log invalid/expired token asynchronously
    setImmediate(async () => {
      try {
        await ErrorLogger.logAuthError(
          new Error(`Invalid/expired token: ${err.message}`), 
          req, 
          'invalid_token'
        );
      } catch (logError) {
        console.error('Failed to log auth error:', logError);
      }
    });
    res.status(401).json({ error: 'Invalid/expired token' });
  }
};

// Middleware to validate refresh tokens
export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      setImmediate(async () => {
        try {
          await ErrorLogger.logAuthError(
            new Error('Refresh token not provided'), 
            req, 
            'missing_refresh_token'
          );
        } catch (logError) {
          console.error('Failed to log auth error:', logError);
        }
      });
      return res.status(401).json({ error: 'Refresh token not provided' });
    }

    // Validate refresh token from database
    const tokenRecord = await RefreshToken.findByToken(refreshToken);
    if (!tokenRecord) {
      setImmediate(async () => {
        try {
          await ErrorLogger.logAuthError(
            new Error('Invalid or expired refresh token'), 
            req, 
            'invalid_refresh_token'
          );
        } catch (logError) {
          console.error('Failed to log auth error:', logError);
        }
      });
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Add user info to request
    req.user = { 
      userId: tokenRecord.user_id,
      user_id: tokenRecord.user_id // Keep both for backward compatibility
    };
    req.refreshTokenRecord = tokenRecord;
    next();
  } catch (err) {
    setImmediate(async () => {
      try {
        await ErrorLogger.logAuthError(
          new Error(`Token validation error: ${err.message}`), 
          req, 
          'token_validation_error'
        );
      } catch (logError) {
        console.error('Failed to log auth error:', logError);
      }
    });
    res.status(500).json({ error: 'Token validation error' });
  }
};

// Middleware to check specific permissions
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      setImmediate(async () => {
        try {
          await ErrorLogger.logAuthError(
            new Error('Authentication required for permission check'), 
            req, 
            'permission_auth_required'
          );
        } catch (logError) {
          console.error('Failed to log auth error:', logError);
        }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.permissions.includes(permission)) {
      setImmediate(async () => {
        try {
          await ErrorLogger.logAuthError(
            new Error(`Insufficient permissions: required ${permission}, user has ${req.user.permissions.join(', ')}`), 
            req, 
            'insufficient_permissions'
          );
        } catch (logError) {
          console.error('Failed to log auth error:', logError);
        }
      });
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

