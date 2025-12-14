import { SystemLog } from '../models/mongodb/SystemLog.js';

/**
 * Centralized error logging utility
 */
export class ErrorLogger {
  /**
   * Log errors from try-catch blocks
   */
  static async logControllerError(error, req, context = {}) {
    try {
      const userId = req?.user?.userId || req?.user?.user_id || null;
      const sessionId = req?.cookies?.refreshToken || null;
      const ipAddress = req?.ip || req?.connection?.remoteAddress || req?.headers['x-forwarded-for'] || 'unknown';
      
      const logData = {
        level: 'error',
        message: `Controller Error: ${error.message}`,
        module: context.module || 'controller',
        host: process.env.HOSTNAME || 'localhost',
        user_id: userId,
        session_id: sessionId,
        action_type: context.actionType || `${req?.method} ${req?.originalUrl}`,
        details: {
          errorType: error.name,
          errorMessage: error.message,
          stack: error.stack,
          method: req?.method,
          url: req?.originalUrl,
          ipAddress,
          userAgent: req?.headers['user-agent'],
          ...context.details
        }
      };

      await SystemLog.createLog(logData);
    } catch (logError) {
      console.error('Failed to log controller error:', logError);
    }
  }

  /**
   * Log authentication failures
   */
  static async logAuthError(error, req, authType = 'authentication') {
    try {
      const ipAddress = req?.ip || req?.connection?.remoteAddress || req?.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req?.headers['user-agent'] || 'unknown';
      
      const logData = {
        level: 'warn',
        message: `Authentication Failure: ${error.message}`,
        module: 'auth',
        host: process.env.HOSTNAME || 'localhost',
        user_id: null, // No user ID for failed auth
        session_id: null,
        action_type: authType,
        details: {
          errorType: error.name,
          errorMessage: error.message,
          method: req?.method,
          url: req?.originalUrl,
          ipAddress,
          userAgent,
          authType,
          timestamp: new Date().toISOString()
        }
      };

      await SystemLog.createLog(logData);
    } catch (logError) {
      console.error('Failed to log auth error:', logError);
    }
  }

  /**
   * Log database errors
   */
  static async logDatabaseError(error, req, context = {}) {
    try {
      const userId = req?.user?.userId || req?.user?.user_id || null;
      const sessionId = req?.cookies?.refreshToken || null;
      const ipAddress = req?.ip || req?.connection?.remoteAddress || req?.headers['x-forwarded-for'] || 'unknown';
      
      const logData = {
        level: 'error',
        message: `Database Error: ${error.message}`,
        module: 'database',
        host: process.env.HOSTNAME || 'localhost',
        user_id: userId,
        session_id: sessionId,
        action_type: context.actionType || 'database_operation',
        details: {
          errorType: error.name,
          errorMessage: error.message,
          errorCode: error.code,
          stack: error.stack,
          method: req?.method,
          url: req?.originalUrl,
          ipAddress,
          userAgent: req?.headers['user-agent'],
          ...context.details
        }
      };

      await SystemLog.createLog(logData);
    } catch (logError) {
      console.error('Failed to log database error:', logError);
    }
  }

  /**
   * Log general system errors
   */
  static async logSystemError(error, context = {}) {
    try {
      const logData = {
        level: 'error',
        message: `System Error: ${error.message}`,
        module: context.module || 'system',
        host: process.env.HOSTNAME || 'localhost',
        user_id: context.userId || null,
        session_id: context.sessionId || null,
        action_type: context.actionType || 'system_error',
        details: {
          errorType: error.name,
          errorMessage: error.message,
          stack: error.stack,
          ...context.details
        }
      };

      await SystemLog.createLog(logData);
    } catch (logError) {
      console.error('Failed to log system error:', logError);
    }
  }
}

/**
 * Middleware to automatically catch and log unhandled errors
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  ErrorLogger.logControllerError(err, req, {
    module: 'error_handler',
    actionType: 'unhandled_error'
  });

  // Send error response
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

/**
 * Wrapper function for async controllers to catch errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      ErrorLogger.logControllerError(error, req, {
        module: 'async_handler',
        actionType: 'async_error'
      });
      next(error);
    });
  };
};
