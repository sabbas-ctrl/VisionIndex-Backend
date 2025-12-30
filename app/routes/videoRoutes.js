import express from 'express';
import { VideoController } from '../controllers/videoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { anomalyDetector, activityLogger } from '../middlewares/activityLogger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply anomaly detection to all video routes
router.use(anomalyDetector({
  rateLimitCheck: true,
  accessPatternCheck: true,
  queryCheck: true,
  errorRateCheck: true
}));

// Video upload page access - log when user visits upload page
router.get('/upload-page', 
  activityLogger('video_upload_page_access'),
  (req, res) => {
    res.json({ 
      message: 'Video upload page accessed',
      user: req.user.userId || req.user.user_id,
      timestamp: new Date().toISOString()
    });
  }
);

// Upload routes
router.post('/upload-url', VideoController.getUploadUrl);
router.post('/upload', VideoController.uploadVideo);
router.post('/register', VideoController.registerVideo);

// Video management routes
router.get('/my-videos', VideoController.getUserVideos);
router.get('/all', VideoController.getAllVideos);
router.get('/:videoId', VideoController.getVideoDetails);
router.put('/:videoId/labels', VideoController.updateVideoLabels);
router.delete('/:videoId', VideoController.deleteVideo);

// Download route
router.get('/:videoId/download', VideoController.getDownloadUrl);

// Video segments routes
router.post('/:videoId/segments', VideoController.createVideoSegments);
router.get('/:videoId/segments', VideoController.getVideoSegments);

// Statistics and search routes
router.get('/stats/overview', VideoController.getVideoStats);
router.get('/search', VideoController.searchVideos);

// Workflow management routes
router.get('/:videoId/workflow-status', VideoController.getWorkflowStatus);
router.post('/:videoId/reprocess', VideoController.reprocessVideo);

// Search/query routes
router.post('/search/text-query', VideoController.storeTextQuery);

export default router;