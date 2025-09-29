import express from 'express';
import { VideoController } from '../controllers/videoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Upload routes
router.post('/upload-url', VideoController.getUploadUrl);
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

export default router;


