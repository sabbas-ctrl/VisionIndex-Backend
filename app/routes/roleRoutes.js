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

const router = express.Router();

// Role CRUD operations
router.get('/', authMiddleware, getAllRoles);
router.get('/:id', authMiddleware, getRoleById);
router.post('/', authMiddleware, createRole);
router.put('/:id', authMiddleware, updateRole);
router.delete('/:id', authMiddleware, deleteRole);

// Role permission operations
router.post('/assign-permission', authMiddleware, assignPermissionToRole);
router.get('/:id/permissions', authMiddleware, getRolePermissions);
router.delete('/:roleId/permissions/:permissionId', authMiddleware, removePermissionFromRole);

export default router;
