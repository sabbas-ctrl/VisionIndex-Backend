import express from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { anomalyDetector, activityLogger } from '../middlewares/activityLogger.js';
// import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Apply anomaly detection to all analytics routes
router.use(anomalyDetector({
  rateLimitCheck: true,
  accessPatternCheck: true,
  queryCheck: true,
  errorRateCheck: true
}));

// Dashboard metrics - accessible to all authenticated users
router.get('/dashboard', 
  activityLogger('dashboard_access'),
  AnalyticsController.getDashboardMetrics
);

// Search history - accessible to all authenticated users
router.get('/search-history', 
  activityLogger('history_access'),
  AnalyticsController.getSearchHistory
);

// Export analytics - accessible to all authenticated users
router.get('/export', AnalyticsController.exportAnalytics);

// Calculate metrics - admin only (for cron jobs)
router.post('/calculate-metrics', 
//   roleMiddleware(['admin']), 
  AnalyticsController.calculateMetrics
);

export default router;
