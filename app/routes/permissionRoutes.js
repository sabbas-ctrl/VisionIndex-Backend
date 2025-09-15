import express from 'express';
import { 
    createPermission,
    listPermissions,
    getPermissionById,
    deletePermission,
    updatePermission
  } from '../controllers/permissionController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Permission routes
router.post('/', authMiddleware, createPermission);
router.get('/', authMiddleware, listPermissions);
router.delete('/:id', authMiddleware, deletePermission);
router.get('/:id', authMiddleware, getPermissionById);
router.put('/:id', authMiddleware, updatePermission);

export default router;
