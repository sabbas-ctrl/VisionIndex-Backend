import express from 'express';
import { register, login, logout } from '../controllers/authController.js';
import { verifyToken, verifyRole } from '../middlewares/authMiddleware.js';
import { refreshToken } from '../controllers/authController.js';
import { devRegister } from '../controllers/authController.js';

const router = express.Router();

// 🛡️ Protected: Only admins can register new users
router.post('/register', verifyToken, verifyRole('admin'), register);

// ✅ Public Login Route
router.post('/login', login);

// ❌ Stateless logout
router.post('/logout', logout);

router.post('/refresh', refreshToken);

router.post('/dev-register', devRegister); // 🚨 remove after use

export default router;
