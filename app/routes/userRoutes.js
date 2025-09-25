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

const router = express.Router();

// User CRUD operations - require user management permissions
router.get('/', authMiddleware, requirePermission('user.read'), getAllUsers);
router.get('/:id', authMiddleware, requirePermission('user.read'), getUserById);
router.post('/', authMiddleware, requirePermission('user.create'), createUser);
router.put('/:id', authMiddleware, requirePermission('user.update'), updateUser);
router.delete('/:id', authMiddleware, requirePermission('user.delete'), deleteUser);

// User profile (requires auth)
router.get('/me', authMiddleware, getProfile);

// Assign role to user (admin) - requires role management permission
router.put('/:id/role', authMiddleware, requirePermission('role.assign'), assignRole);

// Add/override user permission - requires permission management
router.post('/:id/permissions', authMiddleware, requirePermission('permission.manage'), addUserPermission);

// Get effective permissions - requires user read permission
router.get('/:id/permissions', authMiddleware, requirePermission('user.read'), getEffectivePermissions);

export default router;
