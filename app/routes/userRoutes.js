import express from 'express';
import { 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  getProfile, 
  assignRole, 
  addUserPermission 
} from '../controllers/userController.js';
import { getEffectivePermissions } from '../controllers/accessController.js';
import { 
  authMiddleware, 
  requirePermission, 
  requireAnyPermission 
} from '../middlewares/authMiddleware.js';
import { activityLogger } from '../middlewares/activityLogger.js';

const router = express.Router();

// User CRUD operations - require user management permissions
router.get('/', 
  authMiddleware, 
  requirePermission('user.read'), 
  activityLogger('user_list_read'),
  getAllUsers
);
router.get('/:id', 
  authMiddleware, 
  requirePermission('user.read'), 
  activityLogger('user_read', { targetId: (req) => req.params.id }),
  getUserById
);
router.post('/', 
  authMiddleware, 
  requirePermission('user.create'), 
  activityLogger('user_create', { 
    targetId: (req) => req.body.email,
    details: (req) => ({ username: req.body.username, email: req.body.email })
  }),
  createUser
);
router.put('/:id', 
  authMiddleware, 
  requirePermission('user.update'), 
  activityLogger('user_update', { 
    targetId: (req) => req.params.id,
    details: (req) => ({ updatedFields: Object.keys(req.body) })
  }),
  updateUser
);
router.delete('/:id', 
  authMiddleware, 
  requirePermission('user.delete'), 
  activityLogger('user_delete', { targetId: (req) => req.params.id }),
  deleteUser
);

// User profile (requires auth)
router.get('/me', 
  authMiddleware, 
  activityLogger('profile_read'),
  getProfile
);

// Assign role to user (admin) - requires role management permission
router.put('/:id/role', 
  authMiddleware, 
  requirePermission('role.assign'), 
  activityLogger('user_role_assign', { 
    targetId: (req) => req.params.id,
    details: (req) => ({ roleId: req.body.roleId })
  }),
  assignRole
);

// Add/override user permission - requires permission management
router.post('/:id/permissions', 
  authMiddleware, 
  requirePermission('permission.manage'), 
  activityLogger('user_permission_add', { 
    targetId: (req) => req.params.id,
    details: (req) => ({ permissionId: req.body.permissionId })
  }),
  addUserPermission
);

// Get effective permissions - requires user read permission
router.get('/:id/permissions', 
  authMiddleware, 
  requirePermission('user.read'), 
  activityLogger('user_permissions_read', { targetId: (req) => req.params.id }),
  getEffectivePermissions
);

export default router;
