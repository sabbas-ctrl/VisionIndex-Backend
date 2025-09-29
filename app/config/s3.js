import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

class S3Config {
  constructor() {
    // Validate required environment variables
    if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
        throw new Error('Missing required S3 environment variables');
      }
    
      const region = process.env.S3_REGION || 'us-west-002';
      const endpoint = process.env.S3_ENDPOINT || `https://s3.${region}.backblazeb2.com`;
    
      this.bucketName = process.env.S3_BUCKET_NAME;   // <— assign before log
      console.log('S3 Configuration:');
      console.log('- Region:', region);
      console.log('- Endpoint:', endpoint);
      console.log('- Bucket:', this.bucketName);

    this.s3Client = new S3Client({
      region: region,
      endpoint: endpoint,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Required for Backblaze B2
    });
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('Initializing S3 connection...');
      
      // Test connection by trying to list objects in the bucket
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1
      });
      
      console.log('Sending ListObjectsV2 command...');
      await this.s3Client.send(command);
      
      this.initialized = true;
      console.log(`✅ S3 client initialized successfully with bucket: ${this.bucketName}`);
      return true;
    } catch (error) {
      console.error('❌ S3 initialization failed:');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.$metadata?.httpStatusCode);
      
      if (error.message.includes('Invalid URL')) {
        console.error('The S3 endpoint URL is invalid. Please check your S3_ENDPOINT environment variable.');
      }
      
      return false;
    }
  }

  async getPresignedUploadUrl(fileName, contentType, expiresIn = 3600) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: expiresIn 
      });

      return {
        presignedUrl: presignedUrl,
        success: true
      };
    } catch (error) {
      console.error('Failed to get presigned upload URL:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPresignedDownloadUrl(fileName, expiresIn = 3600) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: expiresIn 
      });

      return {
        downloadUrl: presignedUrl,
        success: true
      };
    } catch (error) {
      console.error('Failed to get presigned download URL:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteFile(fileName) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.s3Client.send(command);

      return {
        success: true
      };
    } catch (error) {
      console.error('Failed to delete file:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fileExists(fileName) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileName
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  generateFileName(originalName, userId) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    return `videos/${userId}/${timestamp}_${randomString}.${extension}`;
  }

  validateFileType(fileName) {
    const allowedExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];
    const extension = fileName.split('.').pop().toLowerCase();
    return allowedExtensions.includes(extension);
  }

  validateFileSize(fileSize) {
    const maxSize = 500 * 1024 * 1024; // 500MB
    return fileSize <= maxSize;
  }

  getFileUrl(fileName) {
    const endpoint = process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION || 'us-west-002'}.backblazeb2.com`;
    return `${endpoint}/${this.bucketName}/${fileName}`;
  }
}

// Create singleton instance
const s3Config = new S3Config();

export default s3Config;
