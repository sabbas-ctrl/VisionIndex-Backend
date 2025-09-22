import express from 'express';
<<<<<<< HEAD
import { register, login, logout, verifyAuth, refreshToken } from '../controllers/authController.js';
=======
import { register, login, logout, verifyAuth } from '../controllers/authController.js';
>>>>>>> 02b4b7394aa667efc713606e37283be7dffd5901
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
<<<<<<< HEAD
router.post('/refresh', refreshToken);
=======
>>>>>>> 02b4b7394aa667efc713606e37283be7dffd5901
router.post('/logout', authMiddleware, logout);
router.get('/verify', authMiddleware, verifyAuth);

export default router;