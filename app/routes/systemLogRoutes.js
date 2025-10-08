import express from 'express';
import {
  getSystemLogs,
  getSystemLogStats,
  getLogsByLevel,
  getLogsByModule,
  getRecentErrors,
  createSystemLog,
  exportSystemLogs,
  getFlags,
  getFlagStats,
  createFlag,
  getFlagById,
  updateFlag,
  assignFlag,
  resolveFlag,
  escalateFlag,
  markFlagFalsePositive,
  addFlagNote,
  getActiveFlags,
  exportFlags
} from '../controllers/systemLogController.js';
import { authMiddleware, requirePermission } from '../middlewares/authMiddleware.js';
import { activityLogger, anomalyDetector } from '../middlewares/activityLogger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply anomaly detection to all system log routes (sensitive endpoints)
router.use(anomalyDetector({
  rateLimitCheck: true,
  accessPatternCheck: true,
  queryCheck: true,
  errorRateCheck: true
}));

// System Log Routes
router.get('/logs', 
  authMiddleware,
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getSystemLogs
);

router.get('/logs/stats', 
  authMiddleware,
  requirePermission('system.logs'), 
  getSystemLogStats
);

router.get('/logs/level/:level', 
  authMiddleware,
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getLogsByLevel
);

router.get('/logs/module/:module', 
  authMiddleware,
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getLogsByModule
);

router.get('/logs/errors', 
  authMiddleware,
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getRecentErrors
);

router.post('/logs', 
  authMiddleware,
  requirePermission('system.logs'), 
  activityLogger('system_log_create'),
  createSystemLog
);

router.get('/logs/export', 
  authMiddleware,
  requirePermission('system.logs'), 
  activityLogger('system_logs_export'),
  exportSystemLogs
);

// Flag Routes
router.get('/flags', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flags_read'),
  getFlags
);

router.get('/flags/stats', 
  authMiddleware,
  requirePermission('system.monitor'), 
  getFlagStats
);

router.get('/flags/active', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flags_read'),
  getActiveFlags
);

router.get('/flags/export', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flags_export'),
  exportFlags
);

router.post('/flags', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_create'),
  createFlag
);

router.get('/flags/:flagId', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_read'),
  getFlagById
);

router.put('/flags/:flagId', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_update'),
  updateFlag
);

router.post('/flags/:flagId/assign', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_assign'),
  assignFlag
);

router.post('/flags/:flagId/resolve', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_resolve'),
  resolveFlag
);

router.post('/flags/:flagId/escalate',
  authMiddleware, 
  requirePermission('system.monitor'), 
  activityLogger('flag_escalate'),
  escalateFlag
);

router.post('/flags/:flagId/false-positive', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_false_positive'),
  markFlagFalsePositive
);

router.post('/flags/:flagId/notes', 
  authMiddleware,
  requirePermission('system.monitor'), 
  activityLogger('flag_note_add'),
  addFlagNote
);

export default router;
