import express from 'express';
import multer from 'multer';
import { SearchController } from '../controllers/SearchController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get search results by search_id
router.get('/results/:searchId', authMiddleware, SearchController.getSearchResults);

// Get formatted analysis data for Analysis page
router.get('/analysis/:searchId', authMiddleware, SearchController.getAnalysisData);

// Get all detections (persons + objects) for Detection Summary page
router.get('/detections/:videoId', authMiddleware, SearchController.getAllDetections);

// Post-processing text query - search already processed video data in Qdrant
router.post('/query/:videoId', authMiddleware, SearchController.postProcessingQuery);

// Post-processing image query - search by face image
router.post('/query/image/:videoId', authMiddleware, upload.single('image'), SearchController.postProcessingImageQuery);

export default router;
