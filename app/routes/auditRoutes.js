import express from 'express';
import {
  getActivityLogs,
  getActivityStats,
  getUserActivity,
  getSessionActivity,
  createAuditTrail,
  getAuditTrails,
  getAuditTrailById,
  exportAuditTrail,
  getAuditStats,
  getUserSessions,
  terminateSession,
  terminateAllUserSessions,
  getSessionStats
} from '../controllers/auditController.js';
import { authMiddleware, requirePermission } from '../middlewares/authMiddleware.js';
import { activityLogger } from '../middlewares/activityLogger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Activity Log Routes
router.get('/activity', 
  requirePermission('audit.read'), 
  activityLogger('audit_read'),
  getActivityLogs
);

router.get('/activity/stats', 
  requirePermission('audit.read'), 
  getActivityStats
);

router.get('/activity/user/:userId', 
  requirePermission('audit.read'), 
  activityLogger('user_activity_read'),
  getUserActivity
);

router.get('/activity/session/:sessionId', 
  requirePermission('audit.read'), 
  activityLogger('session_activity_read'),
  getSessionActivity
);

// Audit Trail Routes
router.post('/trail', 
  requirePermission('audit.create'), 
  activityLogger('audit_create'),
  createAuditTrail
);

router.get('/trail', 
  requirePermission('audit.read'), 
  activityLogger('audit_read'),
  getAuditTrails
);

router.get('/trail/stats', 
  requirePermission('audit.read'), 
  getAuditStats
);

router.get('/trail/:auditId', 
  requirePermission('audit.read'), 
  activityLogger('audit_read'),
  getAuditTrailById
);

router.get('/trail/:auditId/export', 
  requirePermission('audit.export'), 
  activityLogger('audit_export'),
  exportAuditTrail
);

// User Session Routes
router.get('/sessions', 
  requirePermission('session.read'), 
  activityLogger('session_read'),
  getUserSessions
);

router.get('/sessions/stats', 
  requirePermission('session.read'), 
  getSessionStats
);

router.delete('/sessions/:sessionId', 
  requirePermission('session.manage'), 
  activityLogger('session_terminate'),
  terminateSession
);

router.delete('/sessions/user/:userId', 
  requirePermission('session.manage'), 
  activityLogger('session_terminate_all'),
  terminateAllUserSessions
);

export default router;
