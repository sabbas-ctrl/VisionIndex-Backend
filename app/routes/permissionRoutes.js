import express from 'express';
import { createPermission, listPermissions } from '../controllers/permissionController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Permission routes
router.post('/', authMiddleware, createPermission);
router.get('/', authMiddleware, listPermissions);

export default router;
