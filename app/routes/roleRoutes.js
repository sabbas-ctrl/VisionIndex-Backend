import express from 'express';
import { createRole, assignPermissionToRole, getRolePermissions } from '../controllers/roleController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Role routes
router.post('/', authMiddleware, createRole);
router.post('/assign-permission', authMiddleware, assignPermissionToRole);
router.get('/:id/permissions', authMiddleware, getRolePermissions);

export default router;
