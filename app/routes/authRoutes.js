import express from 'express';
import { 
  register, 
  login, 
  logout, 
  verifyAuth, 
  refreshToken,
  getUserSessions,
  revokeSession,
  revokeAllSessions
} from '../controllers/authController.js';
import { authMiddleware, refreshTokenMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authMiddleware, logout);
router.get('/verify', authMiddleware, verifyAuth);

// Password reset routes
import { forgotPassword, resetPassword, verifyEmail } from '../controllers/authController.js';
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);

// Session management routes
router.get('/sessions', authMiddleware, getUserSessions);
router.delete('/sessions/:tokenId', authMiddleware, revokeSession);
router.delete('/sessions', authMiddleware, revokeAllSessions);

export default router;