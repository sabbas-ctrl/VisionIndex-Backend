import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const configureCORS = async () => {
  const region = process.env.S3_REGION || 'us-west-002';
  const endpoint = process.env.S3_ENDPOINT || `https://s3.${region}.backblazeb2.com`;
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    console.error('❌ S3_BUCKET_NAME environment variable is required');
    process.exit(1);
  }

  const s3Client = new S3Client({
    region: region,
    endpoint: endpoint,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  const corsConfiguration = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD'],
        AllowedOrigins: [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000',
          // Add your production domain here
          // 'https://yourdomain.com'
        ],
        ExposeHeaders: ['ETag', 'x-amz-request-id'],
        MaxAgeSeconds: 3600
      }
    ]
  };

  try {
    console.log('🔧 Configuring CORS for bucket:', bucketName);
    console.log('📋 CORS Configuration:');
    console.log(JSON.stringify(corsConfiguration, null, 2));

    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration
    });

    await s3Client.send(command);
    console.log('✅ CORS configuration applied successfully!');
    console.log('🎉 Your frontend should now be able to upload files directly to Backblaze B2');

  } catch (error) {
    console.error('❌ Failed to configure CORS:');
    console.error('Error:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.error('💡 Make sure the bucket name is correct and exists');
    } else if (error.name === 'AccessDenied') {
      console.error('💡 Make sure your S3 credentials have the necessary permissions');
    }
  }
};

// Run the configuration
configureCORS();
