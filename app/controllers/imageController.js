import { Image } from '../models/Image.js';
import s3Config from '../config/s3.js';
import crypto from 'crypto';
import { SearchMedia } from '../models/SearchMedia.js';
import { startVideoProcessingWorkflow } from '../utils/temporalClient.js';
import { Video } from '../models/Video.js';
import { pool } from '../config/postgresql.js';

export class ImageController {
  // Get presigned URL for direct image upload to S3 (images/ folder)
  static async getUploadUrl(req, res) {
    try {
      const { fileName, fileSize, fileType } = req.body;
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: missing userId'
        });
      }

      // Validate required fields
      if (!fileName || !fileSize || !fileType) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: fileName, fileSize, fileType'
        });
      }

      // Validate image file type
      if (!ImageController.validateImageFileType(fileName)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Supported formats: PNG, JPG, JPEG, GIF, WEBP'
        });
      }

      // Validate file size (images: max 50MB)
      if (fileSize > 50 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size for images: 50MB'
        });
      }

      // Generate unique file name with "images/" prefix
      const uniqueFileName = ImageController.generateImageFileName(fileName, userId);

      // Get presigned upload URL from S3 (images/ folder)
      const uploadResult = await s3Config.getPresignedUploadUrl(uniqueFileName, fileType, 3600);

      if (!uploadResult.success) {
        console.error('S3 upload URL generation failed:', uploadResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to get presigned upload URL.',
          error: uploadResult.error
        });
      }

      const checksum = crypto.randomBytes(16).toString('hex');

      res.json({
        success: true,
        presignedUrl: uploadResult.presignedUrl,
        fileName: uniqueFileName,
        checksum
      });
    } catch (error) {
      console.error('Error getting image upload URL:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upload URL',
        error: error.message
      });
    }
  }

  // Helper function to fetch text query for a video
  static async getTextQueryForVideo(videoId) {
    try {
      const query = `
        SELECT query_text FROM public.searches 
        WHERE query_video_id = $1 AND query_type = 'text'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const result = await pool.query(query, [videoId]);
      
      if (result.rows.length > 0) {
        return result.rows[0].query_text;
      }
      return null;
    } catch (error) {
      console.warn(`Warning: Failed to fetch text query for video_id ${videoId}:`, error.message);
      return null;
    }
  }

  // Register uploaded image metadata in database
  static async registerImage(req, res) {
    try {
      const {
        fileName,
        originalName,
        checksum,
        videoId
      } = req.body;

      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: missing userId'
        });
      }

      // Validate required fields
      if (!fileName || !checksum) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: fileName, checksum'
        });
      }

      // Create image record in database
      const imageData = {
        uploader_id: userId,
        file_name: fileName,
        original_name: originalName || fileName,
        storage_path: fileName,
        checksum: checksum,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      };

      const image = await Image.create(imageData);

      // Log a search record for this image upload, optionally linking a video
      try {
        await SearchMedia.createForImage({
          user_id: userId,
          search_session_id: req.sessionId || null,
          image_id: image.image_id,
          video_id: videoId || null
        });
      } catch (searchErr) {
        console.warn('Warning: Failed to log search for image upload:', searchErr.message);
      }

      // Image registration complete. Workflow will be started when user clicks "Start Analysis"
      console.log(videoId 
        ? `Image registered with video_id: ${videoId}. Waiting for user to start analysis.`
        : 'Image registered without video association.');

      res.status(201).json({
        success: true,
        message: videoId 
          ? 'Image registered successfully. Click "Start Analysis" to begin processing.'
          : 'Image registered successfully',
        image: {
          image_id: image.image_id,
          file_name: image.file_name,
          original_name: image.original_name,
          status: image.status,
          created_at: image.created_at
        },
        workflow: null
      });
    } catch (error) {
      console.error('Error registering image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register image',
        error: error.message
      });
    }
  }

  // Start image-based analysis workflow
  static async startImageAnalysis(req, res) {
    try {
      const { videoId } = req.body;
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: missing userId'
        });
      }

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: videoId'
        });
      }

      // Verify video exists and user has access
      const video = await Video.findById(videoId);
      if (!video) {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }

      // Check permissions
      if (video.uploader_id !== userId && req.user.role_id !== 1) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Fetch associated reference image
      const imageQuery = `
        SELECT i.image_id, i.file_name, i.original_name
        FROM public.searches s
        JOIN public.images i ON s.query_image_id = i.image_id
        WHERE s.query_video_id = $1 AND s.query_type = 'image'
        ORDER BY s.created_at DESC
        LIMIT 1
      `;
      const imageResult = await pool.query(imageQuery, [videoId]);
      
      if (imageResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No reference image found for this video. Please upload an image first.'
        });
      }

      const imageData = imageResult.rows[0];

      // Fetch text query if it exists for this video
      const textQuery = await ImageController.getTextQueryForVideo(videoId);

      // ========================================================================
      // 🚀 START TEMPORAL WORKFLOW FOR VIDEO PROCESSING (image-based)
      // ========================================================================
      let workflowResult = null;
      try {
        console.log(`Starting image-based analysis for video_id: ${videoId}...`);
        
        // Start workflow with both video and image data
        const workflowData = {
          video_id: videoId,
          file_name: video.file_name,
          original_name: video.original_name,
          uploader_id: video.uploader_id,
          storage_path: video.storage_path,
          image_data: {
            image_id: imageData.image_id,
            file_name: imageData.file_name,
            original_name: imageData.original_name,
            video_id: videoId
          },
          text_query: textQuery || null
        };
        
        workflowResult = await startVideoProcessingWorkflow(workflowData);
        console.log('✅ Temporal workflow started for image-based analysis:', workflowResult);
        
        // Update video status to processing
        await Video.updateStatus(videoId, 'processing');
      } catch (workflowError) {
        console.error('⚠ Failed to start Temporal workflow:', workflowError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to start processing workflow',
          error: workflowError.message
        });
      }

      res.status(200).json({
        success: true,
        message: 'Image-based analysis started',
        workflow: {
          id: workflowResult.workflowId,
          status: 'started',
          message: 'Video processing workflow has been initiated'
        }
      });

    } catch (error) {
      console.error('Error starting image analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start image analysis',
        error: error.message
      });
    }
  }

  // Get user's images
  static async getUserImages(req, res) {
    try {
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: missing userId'
        });
      }

      const images = await Image.getByUploaderId(userId);

      res.json({
        success: true,
        images: images.map(img => ({
          image_id: img.image_id,
          file_name: img.file_name,
          original_name: img.original_name,
          status: img.status,
          created_at: img.created_at
        }))
      });
    } catch (error) {
      console.error('Error fetching user images:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch images',
        error: error.message
      });
    }
  }

  // Get specific image
  static async getImage(req, res) {
    try {
      const { imageId } = req.params;
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: missing userId'
        });
      }

      const image = await Image.getById(imageId);

      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      // Verify ownership
      if (image.uploader_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: you do not own this image'
        });
      }

      res.json({
        success: true,
        image: {
          image_id: image.image_id,
          file_name: image.file_name,
          original_name: image.original_name,
          status: image.status,
          created_at: image.created_at
        }
      });
    } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch image',
        error: error.message
      });
    }
  }

  // Delete image
  static async deleteImage(req, res) {
    try {
      const { imageId } = req.params;
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: missing userId'
        });
      }

      const image = await Image.getById(imageId);

      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      // Verify ownership
      if (image.uploader_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: you do not own this image'
        });
      }

      // Delete from S3
      try {
        await s3Config.deleteFile(image.file_name);
      } catch (s3Error) {
        console.warn('Warning: Failed to delete file from S3:', s3Error.message);
        // Continue with DB deletion even if S3 deletion fails
      }

      // Delete from database
      await Image.delete(imageId);

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete image',
        error: error.message
      });
    }
  }

  // Helper: Validate image file type
  static validateImageFileType(fileName) {
    const allowedTypes = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return allowedTypes.includes(ext);
  }

  // Helper: Generate unique image file name with "images/" prefix
  static generateImageFileName(fileName, userId) {
    const timestamp = Date.now();
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    const uniqueName = `images/${userId}/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
    return uniqueName;
  }
}
