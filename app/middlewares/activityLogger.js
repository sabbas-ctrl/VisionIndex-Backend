import { UserActivityLog } from '../models/UserActivityLog.js';
import { SystemLog } from '../models/mongodb/SystemLog.js';
import { Flag } from '../models/mongodb/Flag.js';

// Middleware to automatically log user activities
export const activityLogger = (actionType, options = {}) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const startTime = Date.now();

    // Extract user and session information
    const userId = req.user?.userId || req.user?.user_id;
    // Use refresh token as session identifier only if it's a valid UUID; otherwise set null
    const refreshTokenCookie = req.cookies?.refreshToken;
    const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const sessionId = isUuid(refreshTokenCookie) ? refreshTokenCookie : null;
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Skip logging if no user context, except for login events
    if (!userId && actionType !== 'login') {
      return next();
    }

    // Skip logging for pagination requests to prevent audit log pollution
    // This prevents every page turn from creating audit entries
    const paginationActionTypes = [
      'audit_read', 'user_activity_read', 'session_activity_read',
      'system_logs_read', 'flags_read', 'user_list_read', 
      'role_list_read', 'permission_list_read'
    ];
    
    // Check for pagination in multiple ways to be more robust
    const pageParam = req.query.page || req.query.p || req.query.pageNumber;
    const isPaginationHeader = req.headers['x-pagination-request'] === 'true';
    const isPaginationRequest = paginationActionTypes.includes(actionType) && 
                               (isPaginationHeader || (pageParam && parseInt(pageParam) > 1));
    
    // Skip logging for role list reads when they're part of user page loads
    const isUserPageRoleRequest = actionType === 'role_list_read' && 
                                 req.headers['x-user-page-request'] === 'true';
    
    // Skip logging for supporting API calls when they're part of permissions page loads
    const isPermissionsPageRequest = req.headers['x-permissions-page-request'] === 'true' &&
                                   (actionType === 'role_list_read' || 
                                    actionType === 'role_permissions_read' || 
                                    actionType === 'permission_list_read');
    
    if (isPaginationRequest || isUserPageRoleRequest || isPermissionsPageRequest) {
      return next();
    }

    // Override res.send to capture response details
    res.send = function(data) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';

      // For login events, try to get userId from response data or request body
      let finalUserId = userId;
      let finalTargetId = options.targetId ? options.targetId(req) : null;
      let finalDetails = options.details ? options.details(req, res, data) : null;
      
      if (actionType === 'login' && !userId && status === 'success') {
        // Try to extract userId from response data or request body
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          if (responseData?.user?.user_id) {
            finalUserId = responseData.user.user_id;
          } else if (req.body?.email) {
            // If we can't get userId from response, we'll log with email as targetId
            // and set userId to null (will be handled by the database)
            finalUserId = null;
          }
        } catch (e) {
          // If parsing fails, keep userId as null
          finalUserId = null;
        }
      }
      
      // For role operations, enhance targetId and details with role name from response
      if ((actionType === 'role_update' || actionType === 'role_create' || actionType === 'role_delete') && status === 'success') {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          if (responseData?.role_name) {
            finalTargetId = responseData.role_name;
            finalDetails = {
              ...finalDetails,
              roleName: responseData.role_name,
              roleId: responseData.role_id,
              description: responseData.description
            };
          }
        } catch (e) {
          // If parsing fails, keep original values
        }
      }
      
      // For user operations, enhance targetId and details with user name from response
      if ((actionType === 'user_create' || actionType === 'user_update' || actionType === 'user_delete') && status === 'success') {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          if (responseData?.username) {
            finalTargetId = responseData.username;
            finalDetails = {
              ...finalDetails,
              username: responseData.username,
              email: responseData.email,
              user_id: responseData.user_id
            };
          }
        } catch (e) {
          // If parsing fails, keep original values
        }
      }
      
      // For permission operations, enhance targetId and details with role and permission names from response
      if ((actionType === 'role_permission_assign' || actionType === 'role_permission_remove') && status === 'success') {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          if (responseData?.role_name && responseData?.permission_name) {
            finalTargetId = `${responseData.role_name} - ${responseData.permission_name}`;
            finalDetails = {
              ...finalDetails,
              role_name: responseData.role_name,
              role_id: responseData.role_id,
              permission_name: responseData.permission_name,
              permission_id: responseData.permission_id
            };
          }
        } catch (e) {
          // If parsing fails, keep original values
        }
      }

      // Prepare activity log data
      const activityData = {
        userId: finalUserId,
        sessionId,
        actionType,
        targetId: finalTargetId,
        ipAddress,
        status,
        details: {
          method: req.method,
          url: req.originalUrl,
          userAgent,
          processingTime,
          statusCode: res.statusCode,
          ...finalDetails
        }
      };

      // Log activity asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await UserActivityLog.create(activityData);
        } catch (error) {
          console.error('Failed to log user activity:', error);
        }
      });

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
};

// Middleware to log system events
export const systemLogger = (level, module, message, options = {}) => {
  return async (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';
      const userId = req.user?.userId || req.user?.user_id;
      const sessionId = req.cookies?.refreshToken;
      const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

      // Prepare system log data
      const logData = {
        level,
        message: typeof message === 'function' ? message(req, res, data) : message,
        module,
        host: process.env.HOSTNAME || 'localhost',
        user_id: userId,
        session_id: sessionId,
        action_type: req.method + ' ' + req.route?.path || req.originalUrl,
        details: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          ipAddress,
          ...options.details?.(req, res, data)
        }
      };

      // Log system event asynchronously
      setImmediate(async () => {
        try {
          await SystemLog.createLog(logData);
        } catch (error) {
          console.error('Failed to log system event:', error);
        }
      });

      originalSend.call(this, data);
    };

    next();
  };
};

// Middleware to detect and flag suspicious activities
export const anomalyDetector = (options = {}) => {
  return async (req, res, next) => {
    const userId = req.user?.userId || req.user?.user_id;
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Skip if no user context
    if (!userId) {
      return next();
    }

    const originalSend = res.send;

    res.send = function(data) {
      // Check for anomalies asynchronously
      setImmediate(async () => {
        try {
          await checkForAnomalies(req, res, data, userId, ipAddress, userAgent, options);
        } catch (error) {
          console.error('Failed to check for anomalies:', error);
        }
      });

      originalSend.call(this, data);
    };

    next();
  };
};

// Function to check for various types of anomalies
async function checkForAnomalies(req, res, data, userId, ipAddress, userAgent, options) {
  const checks = [];

  // Check for rapid successive requests (rate limiting)
  if (options.rateLimitCheck !== false) {
    checks.push(checkRateLimit(userId, ipAddress));
  }

  // Check for unusual access patterns
  if (options.accessPatternCheck !== false) {
    checks.push(checkAccessPatterns(userId, req.originalUrl, req.method));
  }

  // Check for suspicious query parameters
  if (options.queryCheck !== false) {
    checks.push(checkSuspiciousQueries(req.query, req.body));
  }

  // Check for unusual error rates
  if (options.errorRateCheck !== false) {
    checks.push(checkErrorRates(userId, res.statusCode));
  }

  // Run all checks in parallel
  const results = await Promise.allSettled(checks);
  
  // Process results and create flags if needed
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      await createFlag(result.value, userId, ipAddress, userAgent, req);
    }
  }
}

// Check for rate limiting anomalies
async function checkRateLimit(userId, ipAddress) {
  try {
    // Check for requests in the last minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentRequests = await UserActivityLog.findByUserId(userId, 100, 0);
    
    const recentCount = recentRequests.filter(log => 
      new Date(log.timestamp) > oneMinuteAgo
    ).length;

    if (recentCount > 30) { // More than 30 requests per minute
      return {
        flag_type: 'rate_limit_exceeded',
        message: `User ${userId} exceeded rate limit: ${recentCount} requests in 1 minute`,
        priority: 'high',
        details: {
          request_count: recentCount,
          time_window: '1 minute',
          ip_address: ipAddress
        },
        confidence_score: 0.9
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return null;
  }
}

// Check for unusual access patterns
async function checkAccessPatterns(userId, url, method) {
  try {
    // Check for access to sensitive endpoints
    const sensitiveEndpoints = ['/admin', '/users', '/roles', '/permissions', '/audit'];
    const isSensitive = sensitiveEndpoints.some(endpoint => url.includes(endpoint));

    if (isSensitive) {
      // Do not flag normal first-time page views (read-only)
      const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      const isWriteOperation = writeMethods.includes(method);

      // If it's a GET to a sensitive endpoint (typical first-time page load), skip flagging
      if (!isWriteOperation) {
        return null;
      }

      // Check if user has accessed this endpoint before
      const previousAccess = await UserActivityLog.findByUserId(userId, 1000, 0);
      const hasAccessedBefore = previousAccess.some(log => 
        log.action_type === 'access' && log.details?.url?.includes(url)
      );

      if (!hasAccessedBefore) {
        return {
          flag_type: 'access_violation',
          message: `User ${userId} accessed sensitive endpoint for the first time: ${url}`,
          priority: 'medium',
          details: {
            endpoint: url,
            method,
            first_access: true
          },
          confidence_score: 0.7
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking access patterns:', error);
    return null;
  }
}

// Check for suspicious query parameters
async function checkSuspiciousQueries(query, body) {
  try {
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /<script/i,
      /union.*select/i,
      /drop.*table/i,
      /insert.*into/i,
      /delete.*from/i,
      /update.*set/i
    ];

    const queryString = JSON.stringify({ ...query, ...body });
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(queryString)) {
        return {
          flag_type: 'security_violation',
          message: `Suspicious query parameters detected: ${pattern.source}`,
          priority: 'high',
          details: {
            pattern: pattern.source,
            query_data: { query, body }
          },
          confidence_score: 0.8
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking suspicious queries:', error);
    return null;
  }
}

// Check for unusual error rates
async function checkErrorRates(userId, statusCode) {
  try {
    if (statusCode >= 400) {
      // Check error rate in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentLogs = await UserActivityLog.findByUserId(userId, 1000, 0);
      
      const recentErrors = recentLogs.filter(log => 
        new Date(log.timestamp) > oneHourAgo && log.status === 'failure'
      ).length;

      const recentTotal = recentLogs.filter(log => 
        new Date(log.timestamp) > oneHourAgo
      ).length;

      if (recentTotal > 0) {
        const errorRate = recentErrors / recentTotal;
        
        if (errorRate > 0.5) { // More than 50% error rate
          return {
            flag_type: 'system_anomaly',
            message: `User ${userId} has high error rate: ${(errorRate * 100).toFixed(1)}% in the last hour`,
            priority: 'medium',
            details: {
              error_rate: errorRate,
              error_count: recentErrors,
              total_requests: recentTotal,
              time_window: '1 hour'
            },
            confidence_score: 0.6
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking error rates:', error);
    return null;
  }
}

// Create a flag for detected anomalies
async function createFlag(anomalyData, userId, ipAddress, userAgent, req) {
  try {
    const flag = await Flag.createFlag({
      ...anomalyData,
      user_id: userId,
      ip_address: ipAddress,
      details: {
        ...anomalyData.details,
        user_agent: userAgent,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date()
      }
    });

    console.log(`Flag created: ${flag.flag_type} - ${flag.message}`);
  } catch (error) {
    console.error('Failed to create flag:', error);
  }
}

// Middleware to log authentication events
export const authLogger = () => {
  return activityLogger('auth', {
    targetId: (req) => req.body?.email || req.user?.userId || req.user?.user_id,
    details: (req, res, data) => ({
      authType: req.route?.path?.includes('login') ? 'login' : 
                req.route?.path?.includes('logout') ? 'logout' : 'auth',
      success: res.statusCode < 400
    })
  });
};

// Middleware to log video operations
export const videoLogger = () => {
  return activityLogger('video_operation', {
    targetId: (req) => req.params?.videoId || req.body?.videoId,
    details: (req, res, data) => ({
      operation: req.route?.path?.includes('upload') ? 'upload' :
                 req.route?.path?.includes('delete') ? 'delete' :
                 req.route?.path?.includes('process') ? 'process' : 'video',
      fileSize: req.body?.fileSize,
      duration: req.body?.duration
    })
  });
};

// Middleware to log search operations
export const searchLogger = () => {
  return activityLogger('search', {
    targetId: (req) => req.body?.queryId || req.params?.searchId,
    details: (req, res, data) => ({
      query: req.body?.query || req.query?.q,
      filters: req.body?.filters || req.query,
      resultCount: data?.results?.length || 0
    })
  });
};

// Middleware to log export operations
export const exportLogger = () => {
  return activityLogger('export', {
    targetId: (req) => req.params?.exportId || req.body?.exportId,
    details: (req, res, data) => ({
      format: req.query?.format || req.body?.format,
      recordCount: data?.recordCount || 0,
      exportType: req.route?.path?.includes('audit') ? 'audit' : 'data'
    })
  });
};
