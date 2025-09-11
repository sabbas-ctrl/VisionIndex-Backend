import express from 'express';
import { getProfile, assignRole, addUserPermission } from '../controllers/userController.js';
import { getEffectivePermissions } from '../controllers/accessController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// User profile (requires auth)
router.get('/me', authMiddleware, getProfile);

// Assign role to user (admin)
router.put('/:id/role', authMiddleware, assignRole);

// Add/override user permission
router.post('/:id/permissions', authMiddleware, addUserPermission);

// Get effective permissions
router.get('/:id/permissions', authMiddleware, getEffectivePermissions);

export default router;
