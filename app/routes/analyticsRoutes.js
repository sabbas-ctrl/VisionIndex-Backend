import express from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
// import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Dashboard metrics - accessible to all authenticated users
router.get('/dashboard', AnalyticsController.getDashboardMetrics);

// Search history - accessible to all authenticated users
router.get('/search-history', AnalyticsController.getSearchHistory);

// Export analytics - accessible to all authenticated users
router.get('/export', AnalyticsController.exportAnalytics);

// Calculate metrics - admin only (for cron jobs)
router.post('/calculate-metrics', 
//   roleMiddleware(['admin']), 
  AnalyticsController.calculateMetrics
);

export default router;
