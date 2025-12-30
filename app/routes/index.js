import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import roleRoutes from './roleRoutes.js';
import permissionRoutes from './permissionRoutes.js';
import auditRoutes from './auditRoutes.js';
import systemLogRoutes from './systemLogRoutes.js';
import videoRoutes from './videoRoutes.js';
import imageRoutes from './imageRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { activityLogger, anomalyDetector } from '../middlewares/activityLogger.js';

const router = express.Router();

// Dashboard route with activity logging and anomaly detection
router.get('/dashboard', 
  authMiddleware, 
  anomalyDetector({
    rateLimitCheck: true,
    accessPatternCheck: true,
    queryCheck: true,
    errorRateCheck: true
  }),
  activityLogger('dashboard_access'),
  (req, res) => {
    res.json({ 
      message: 'Dashboard accessed',
      user: req.user.userId || req.user.user_id,
      timestamp: new Date().toISOString()
    });
  }
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/audit', auditRoutes);
router.use('/system', systemLogRoutes);
router.use('/videos', videoRoutes);
router.use('/images', imageRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
