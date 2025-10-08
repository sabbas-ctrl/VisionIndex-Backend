import express from 'express';
import { 
  getAllRoles, 
  getRoleById, 
  createRole, 
  updateRole, 
  deleteRole,
  assignPermissionToRole, 
  getRolePermissions,
  removePermissionFromRole 
} from '../controllers/roleController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { activityLogger, anomalyDetector } from '../middlewares/activityLogger.js';

const router = express.Router();

// Apply anomaly detection to all role routes (sensitive endpoints)
router.use(anomalyDetector({
  rateLimitCheck: true,
  accessPatternCheck: true,
  queryCheck: true,
  errorRateCheck: true
}));

// Role CRUD operations
router.get('/', 
  authMiddleware, 
  activityLogger('role_list_read'),
  getAllRoles
);
router.get('/:id', 
  authMiddleware, 
  activityLogger('role_read', { targetId: (req) => req.params.id }),
  getRoleById
);
router.post('/', 
  authMiddleware, 
  activityLogger('role_create', { 
    targetId: (req) => req.body.roleName,
    details: (req) => ({ roleName: req.body.roleName, description: req.body.description })
  }),
  createRole
);
router.put('/:id', 
  authMiddleware, 
  activityLogger('role_update', { 
    targetId: (req) => req.params.id,
    details: (req) => ({ updatedFields: Object.keys(req.body) })
  }),
  updateRole
);
router.delete('/:id', 
  authMiddleware, 
  activityLogger('role_delete', { targetId: (req) => req.params.id }),
  deleteRole
);

// Role permission operations
router.post('/assign-permission', 
  authMiddleware, 
  activityLogger('role_permission_assign', { 
    targetId: (req) => req.body.roleId,
    details: (req) => ({ roleId: req.body.roleId, permissionId: req.body.permissionId })
  }),
  assignPermissionToRole
);
router.get('/:id/permissions', 
  authMiddleware, 
  activityLogger('role_permissions_read', { targetId: (req) => req.params.id }),
  getRolePermissions
);
router.delete('/:roleId/permissions/:permissionId', 
  authMiddleware, 
  activityLogger('role_permission_remove', { 
    targetId: (req) => req.params.roleId,
    details: (req) => ({ roleId: req.params.roleId, permissionId: req.params.permissionId })
  }),
  removePermissionFromRole
);

export default router;
