// Quick S3 configuration test script
// Run with: node test-s3.js

import dotenv from 'dotenv';
import s3Config from './config/s3.js';

dotenv.config();

async function testS3Config() {
  console.log('🔧 Testing S3 Configuration...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('S3_ACCESS_KEY_ID:', process.env.S3_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing');
  console.log('S3_SECRET_ACCESS_KEY:', process.env.S3_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing');
  console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME || '✗ Missing');
  console.log('S3_REGION:', process.env.S3_REGION || 'us-west-002');
  console.log('S3_ENDPOINT:', process.env.S3_ENDPOINT || 'https://s3.us-west-002.backblazeb2.com');
  console.log('');

  // Validate required variables
  const missingVars = [];
  if (!process.env.S3_ACCESS_KEY_ID) missingVars.push('S3_ACCESS_KEY_ID');
  if (!process.env.S3_SECRET_ACCESS_KEY) missingVars.push('S3_SECRET_ACCESS_KEY');
  if (!process.env.S3_BUCKET_NAME) missingVars.push('S3_BUCKET_NAME');

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('\n📝 Please create a .env file in the VisionIndex-Backend directory with:');
    console.log('S3_ACCESS_KEY_ID=your_access_key_id');
    console.log('S3_SECRET_ACCESS_KEY=your_secret_access_key');
    console.log('S3_BUCKET_NAME=your_bucket_name');
    console.log('S3_REGION=us-west-002');
    console.log('S3_ENDPOINT=https://s3.us-west-002.backblazeb2.com');
    return;
  }

  try {
    // Test initialization
    console.log('🚀 Testing S3 initialization...');
    const initResult = await s3Config.initialize();
    console.log('Initialization:', initResult ? '✅ Success' : '❌ Failed');
    
    if (initResult) {
      // Test presigned URL generation
      console.log('\n🔗 Testing presigned URL generation...');
      const uploadResult = await s3Config.getPresignedUploadUrl(
        'test-file.mp4',
        'video/mp4',
        3600
      );
      console.log('Presigned URL:', uploadResult.success ? '✅ Generated' : '❌ Failed');
      
      if (uploadResult.success) {
        console.log('URL (first 100 chars):', uploadResult.presignedUrl.substring(0, 100) + '...');
        console.log('\n🎉 S3 configuration is working correctly!');
      } else {
        console.log('❌ Error:', uploadResult.error);
      }
    } else {
      console.log('\n❌ S3 initialization failed. Please check your credentials and bucket configuration.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testS3Config();
