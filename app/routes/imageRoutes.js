import express from 'express';
import { ImageController } from '../controllers/imageController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Image upload routes
router.post('/upload-url', ImageController.getUploadUrl);
router.post('/register', ImageController.registerImage);

// Image analysis routes
router.post('/start-analysis', ImageController.startImageAnalysis);

// Image management routes
router.get('/my-images', ImageController.getUserImages);
router.get('/:imageId', ImageController.getImage);
router.delete('/:imageId', ImageController.deleteImage);

export default router;
