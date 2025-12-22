import dotenv from 'dotenv';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config();

async function testS3Connection() {
  console.log('=== S3 Connection Test ===');
  
  // Check environment variables
  console.log('\n1. Environment Variables:');
  console.log('S3_ACCESS_KEY_ID:', process.env.S3_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  console.log('S3_SECRET_ACCESS_KEY:', process.env.S3_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
  console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME || 'NOT SET');
  console.log('S3_REGION:', process.env.S3_REGION || 'NOT SET');
  console.log('S3_ENDPOINT:', process.env.S3_ENDPOINT || 'NOT SET');

  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
    console.error('\n❌ Missing required environment variables!');
    return;
  }

  const region = process.env.S3_REGION || 'us-west-002';
  const endpoint = process.env.S3_ENDPOINT || `https://s3.${region}.backblazeb2.com`;
  const bucketName = process.env.S3_BUCKET_NAME;

  console.log('\n2. Configuration:');
  console.log('Region:', region);
  console.log('Endpoint:', endpoint);
  console.log('Bucket:', bucketName);

  // Create S3 client
  const s3Client = new S3Client({
    region: region,
    endpoint: endpoint,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  try {
    // Test 1: List objects in bucket
    console.log('\n3. Testing bucket access...');
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1
    });
    
    const listResult = await s3Client.send(listCommand);
    console.log('✅ Successfully listed objects in bucket');
    console.log('Objects found:', listResult.Contents?.length || 0);

    // Test 2: Generate presigned URL
    console.log('\n4. Testing presigned URL generation...');
    const testFileName = `test-${Date.now()}.txt`;
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testFileName,
      ContentType: 'text/plain',
    });

    const presignedUrl = await getSignedUrl(s3Client, putCommand, { 
      expiresIn: 3600 
    });
    
    console.log('✅ Successfully generated presigned URL');
    console.log('Presigned URL:', presignedUrl.substring(0, 100) + '...');

    // Test 3: Try to upload a test file
    console.log('\n5. Testing actual upload...');
    const testContent = 'This is a test file for S3 connection';
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: testContent
    });

    if (uploadResponse.ok) {
      console.log('✅ Successfully uploaded test file');
    } else {
      console.log('❌ Upload failed:', uploadResponse.status, uploadResponse.statusText);
      const errorText = await uploadResponse.text();
      console.log('Error details:', errorText);
    }

  } catch (error) {
    console.error('\n❌ S3 connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.$metadata?.httpStatusCode);
    
    if (error.message.includes('InvalidAccessKeyId')) {
      console.error('\n💡 This suggests your Access Key ID is incorrect');
    } else if (error.message.includes('SignatureDoesNotMatch')) {
      console.error('\n💡 This suggests your Secret Access Key is incorrect');
    } else if (error.message.includes('NoSuchBucket')) {
      console.error('\n💡 This suggests your bucket name is incorrect');
    } else if (error.message.includes('AccessDenied')) {
      console.error('\n💡 This suggests your key lacks the necessary permissions');
    }
  }
}

testS3Connection().catch(console.error);
