import express from 'express';
import { 
    createPermission,
    listPermissions,
    getPermissionById,
    deletePermission,
    updatePermission
  } from '../controllers/permissionController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { activityLogger, anomalyDetector } from '../middlewares/activityLogger.js';

const router = express.Router();

// Apply anomaly detection to all permission routes (sensitive endpoints)
router.use(anomalyDetector({
  rateLimitCheck: true,
  accessPatternCheck: true,
  queryCheck: true,
  errorRateCheck: true
}));

// Permission routes
router.post('/', 
  authMiddleware, 
  activityLogger('permission_create', { 
    targetId: (req) => req.body.permissionName,
    details: (req) => ({ permissionName: req.body.permissionName, description: req.body.description })
  }),
  createPermission
);

// Special route for permissions page access (logs "permissions viewed")
router.get('/page', 
  authMiddleware, 
  activityLogger('permissions_viewed'),
  (req, res) => {
    res.json({ message: 'Permissions page accessed' });
  }
);

router.get('/', 
  authMiddleware, 
  activityLogger('permission_list_read'),
  listPermissions
);
router.delete('/:id', 
  authMiddleware, 
  activityLogger('permission_delete', { targetId: (req) => req.params.id }),
  deletePermission
);
router.get('/:id', 
  authMiddleware, 
  activityLogger('permission_read', { targetId: (req) => req.params.id }),
  getPermissionById
);
router.put('/:id', 
  authMiddleware, 
  activityLogger('permission_update', { 
    targetId: (req) => req.params.id,
    details: (req) => ({ updatedFields: Object.keys(req.body) })
  }),
  updatePermission
);

export default router;
