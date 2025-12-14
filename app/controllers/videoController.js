import { Video } from '../models/Video.js';
import { VideoSegment } from '../models/VideoSegment.js';
import VideoMetadata from '../models/mongodb/VideoMetadata.js';
import { UserActivityLog } from '../models/UserActivityLog.js';
import s3Config from '../config/s3.js';
import crypto from 'crypto';
import { activityLogger } from '../middlewares/activityLogger.js';

// Helper function to format duration from seconds to HH:MM:SS format
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export class VideoController {
  // Get presigned URL for direct upload to S3
  static async getUploadUrl(req, res) {
    try {
      const { fileName, fileSize, fileType } = req.body;
      console.log("sui");
      console.log(req.user);
      console.log(req.user.user_id);
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

      // Validate file type
      if (!s3Config.validateFileType(fileName)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Supported formats: MP4, AVI, MOV, MKV, WMV, FLV, WEBM'
        });
      }

      // Validate file size
      if (!s3Config.validateFileSize(fileSize)) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size: 500MB'
        });
      }

      // Generate unique file name
      const uniqueFileName = s3Config.generateFileName(fileName, userId);

      // Get presigned upload URL from S3
      const uploadResult = await s3Config.getPresignedUploadUrl(uniqueFileName, fileType, 3600);
      
      if (!uploadResult.success) {
        console.error('S3 upload URL generation failed:', uploadResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to get presigned upload URL. Please check S3 configuration.',
          error: uploadResult.error
        });
      }

      // Generate checksum for file integrity
      const checksum = crypto.randomBytes(16).toString('hex');

      res.json({
        success: true,
        presignedUrl: uploadResult.presignedUrl,
        fileName: uniqueFileName,
        checksum,
        expiresIn: 3600
      });

    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Proxy upload endpoint to handle CORS issues
  static async uploadVideo(req, res) {
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

      // Validate file type
      if (!s3Config.validateFileType(fileName)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Supported formats: MP4, AVI, MOV, MKV, WMV, FLV, WEBM'
        });
      }

      // Validate file size
      if (!s3Config.validateFileSize(fileSize)) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size: 500MB'
        });
      }

      // Generate unique file name
      const uniqueFileName = s3Config.generateFileName(fileName, userId);

      // Get presigned upload URL from S3
      const uploadResult = await s3Config.getPresignedUploadUrl(uniqueFileName, fileType, 3600);
      
      if (!uploadResult.success) {
        console.error('S3 upload URL generation failed:', uploadResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to get presigned upload URL. Please check S3 configuration.',
          error: uploadResult.error
        });
      }

      // Generate checksum for file integrity
      const checksum = crypto.randomBytes(16).toString('hex');

      res.json({
        success: true,
        presignedUrl: uploadResult.presignedUrl,
        fileName: uniqueFileName,
        checksum,
        expiresIn: 3600
      });

    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Register video after successful upload
  static async registerVideo(req, res) {
    try {
      const {
        fileName,
        originalName,
        fileSize,
        checksum,
        duration,
        resolution,
        labels = {},
        metadata = {}
      } = req.body;
      const userId = req.user.user_id;
      console.log('Registering video for user:', userId);
      console.log('Video data:', { fileName, originalName, fileSize });

      // Create video record in PostgreSQL
      const videoData = {
        uploader_id: userId,
        file_name: fileName,
        original_name: originalName,
        storage_path: s3Config.getFileUrl(fileName),
        file_size: fileSize,
        duration: duration ? formatDuration(duration) : null,
        resolution: resolution,
        checksum: checksum,
        labels: labels,
        metadata: metadata
      };

      console.log('Creating video record...');
      const video = await Video.create(videoData);
      console.log('Video created with ID:', video.video_id);

      // Create initial video metadata record in MongoDB
      console.log('Creating video metadata...');
      const videoMetadata = new VideoMetadata({
        video_id: video.video_id,
        processing_stage: 'preprocessing',
        total_frames: 0,
        frames_analyzed: 0
      });

      await videoMetadata.save();
      console.log('Video metadata saved');

      // Log activity
      console.log('Logging user activity...');
      await UserActivityLog.create({
        userId: userId,
        sessionId: req.sessionId,
        actionType: 'video_upload',
        targetId: video.video_id.toString(),
        ipAddress: req.ip,
        status: 'success',
        details: {
          file_name: originalName,
          file_size: fileSize,
          video_id: video.video_id
        }
      });
      console.log('User activity logged');

      res.status(201).json({
        success: true,
        message: 'Video registered successfully',
        video: video.toJSON()
      });

    } catch (error) {
      console.error('Error registering video:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Failed to register video',
        error: error.message
      });
    }
  }

  // Get video download URL
  static async getDownloadUrl(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.user_id;

      const video = await Video.findById(videoId);
      if (!video) {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }

      // Check if user has permission to download this video
      if (video.uploader_id !== userId && req.user.role_id !== 1) { // Assuming role_id 1 is admin
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const downloadResult = await s3Config.getPresignedDownloadUrl(video.file_name, 3600);
      
      if (!downloadResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to get download URL',
          error: downloadResult.error
        });
      }

      res.json({
        success: true,
        downloadUrl: downloadResult.downloadUrl,
        expiresIn: 3600 // 1 hour
      });

    } catch (error) {
      console.error('Error getting download URL:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get user's videos
  static async getUserVideos(req, res) {
    try {
      const userId = req.user.user_id;
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      const videos = await Video.findByUploader(userId, parseInt(limit), offset);
      const totalVideos = await Video.getStats(userId);

      res.json({
        success: true,
        videos: videos.map(video => video.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalVideos.total_videos,
          pages: Math.ceil(totalVideos.total_videos / limit)
        }
      });

    } catch (error) {
      console.error('Error getting user videos:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get all videos (admin only)
  static async getAllVideos(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      const videos = await Video.findAll(parseInt(limit), offset, status);
      const totalVideos = await Video.getStats();

      res.json({
        success: true,
        videos: videos.map(video => video.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalVideos.total_videos,
          pages: Math.ceil(totalVideos.total_videos / limit)
        }
      });

    } catch (error) {
      console.error('Error getting all videos:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get video details
  static async getVideoDetails(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.user_id;

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

      // Get video metadata from MongoDB
      const videoMetadata = await VideoMetadata.findByVideoId(videoId);

      res.json({
        success: true,
        video: video.toJSON(),
        metadata: videoMetadata ? videoMetadata.getStats() : null
      });

    } catch (error) {
      console.error('Error getting video details:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update video labels
  static async updateVideoLabels(req, res) {
    try {
      const { videoId } = req.params;
      const { labels } = req.body;
      const userId = req.user.user_id;

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

      const updatedVideo = await Video.updateLabels(videoId, labels);

      res.json({
        success: true,
        message: 'Video labels updated successfully',
        video: updatedVideo.toJSON()
      });

    } catch (error) {
      console.error('Error updating video labels:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete video
  static async deleteVideo(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.user_id;

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

      // Delete from S3
      const deleteResult = await s3Config.deleteFile(video.file_name);
      if (!deleteResult.success) {
        console.warn('Failed to delete file from S3:', deleteResult.error);
      }

      // Delete video segments
      await VideoSegment.deleteByVideoId(videoId);

      // Delete video metadata
      await VideoMetadata.findOneAndDelete({ video_id: videoId });

      // Delete video record
      await Video.delete(videoId);

      res.json({
        success: true,
        message: 'Video deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting video:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create video segments
  static async createVideoSegments(req, res) {
    try {
      const { videoId } = req.params;
      const { segments } = req.body;
      const userId = req.user.user_id;

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

      const createdSegments = await VideoSegment.createMultiple(videoId, segments);

      res.status(201).json({
        success: true,
        message: 'Video segments created successfully',
        segments: createdSegments.map(segment => segment.toJSON())
      });

    } catch (error) {
      console.error('Error creating video segments:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get video segments
  static async getVideoSegments(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.user_id;

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

      const segments = await VideoSegment.findByVideoId(videoId);

      res.json({
        success: true,
        segments: segments.map(segment => segment.toJSON())
      });

    } catch (error) {
      console.error('Error getting video segments:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get video statistics
  static async getVideoStats(req, res) {
    try {
      const userId = req.user.user_id;
      const isAdmin = req.user.role_id === 1;

      const stats = await Video.getStats(isAdmin ? null : userId);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Error getting video stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Search videos by labels
  static async searchVideos(req, res) {
    try {
      const { q } = req.query;
      const userId = req.user.user_id;
      const isAdmin = req.user.role_id === 1;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const videos = await Video.searchByLabels(q, isAdmin ? null : userId);

      res.json({
        success: true,
        videos: videos.map(video => video.toJSON()),
        query: q
      });

    } catch (error) {
      console.error('Error searching videos:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

