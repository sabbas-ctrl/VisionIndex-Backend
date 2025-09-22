import express from 'express';
import { register, login, logout, verifyAuth, refreshToken } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authMiddleware, logout);
router.get('/verify', authMiddleware, verifyAuth);

export default router;