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
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// User CRUD operations
router.get('/', authMiddleware, getAllUsers);
router.get('/:id', authMiddleware, getUserById);
router.post('/', authMiddleware, createUser);
router.put('/:id', authMiddleware, updateUser);
router.delete('/:id', authMiddleware, deleteUser);

// User profile (requires auth)
router.get('/me', authMiddleware, getProfile);

// Assign role to user (admin)
router.put('/:id/role', authMiddleware, assignRole);

// Add/override user permission
router.post('/:id/permissions', authMiddleware, addUserPermission);

// Get effective permissions
router.get('/:id/permissions', authMiddleware, getEffectivePermissions);

export default router;
