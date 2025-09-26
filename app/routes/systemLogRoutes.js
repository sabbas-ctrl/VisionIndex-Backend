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
import { activityLogger } from '../middlewares/activityLogger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// System Log Routes
router.get('/logs', 
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getSystemLogs
);

router.get('/logs/stats', 
  requirePermission('system.logs'), 
  getSystemLogStats
);

router.get('/logs/level/:level', 
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getLogsByLevel
);

router.get('/logs/module/:module', 
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getLogsByModule
);

router.get('/logs/errors', 
  requirePermission('system.logs'), 
  activityLogger('system_logs_read'),
  getRecentErrors
);

router.post('/logs', 
  requirePermission('system.logs'), 
  activityLogger('system_log_create'),
  createSystemLog
);

router.get('/logs/export', 
  requirePermission('system.logs'), 
  activityLogger('system_logs_export'),
  exportSystemLogs
);

// Flag Routes
router.get('/flags', 
  requirePermission('system.monitor'), 
  activityLogger('flags_read'),
  getFlags
);

router.get('/flags/stats', 
  requirePermission('system.monitor'), 
  getFlagStats
);

router.get('/flags/active', 
  requirePermission('system.monitor'), 
  activityLogger('flags_read'),
  getActiveFlags
);

router.post('/flags', 
  requirePermission('system.monitor'), 
  activityLogger('flag_create'),
  createFlag
);

router.get('/flags/:flagId', 
  requirePermission('system.monitor'), 
  activityLogger('flag_read'),
  getFlagById
);

router.put('/flags/:flagId', 
  requirePermission('system.monitor'), 
  activityLogger('flag_update'),
  updateFlag
);

router.post('/flags/:flagId/assign', 
  requirePermission('system.monitor'), 
  activityLogger('flag_assign'),
  assignFlag
);

router.post('/flags/:flagId/resolve', 
  requirePermission('system.monitor'), 
  activityLogger('flag_resolve'),
  resolveFlag
);

router.post('/flags/:flagId/escalate', 
  requirePermission('system.monitor'), 
  activityLogger('flag_escalate'),
  escalateFlag
);

router.post('/flags/:flagId/false-positive', 
  requirePermission('system.monitor'), 
  activityLogger('flag_false_positive'),
  markFlagFalsePositive
);

router.post('/flags/:flagId/notes', 
  requirePermission('system.monitor'), 
  activityLogger('flag_note_add'),
  addFlagNote
);

router.get('/flags/export', 
  requirePermission('system.monitor'), 
  activityLogger('flags_export'),
  exportFlags
);

export default router;
