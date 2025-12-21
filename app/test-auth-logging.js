import mongoose from 'mongoose';
import { SystemLog } from './models/mongodb/SystemLog.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAuthLogging() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing Authentication Error Logging...\n');

    // Wait a moment for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test the API endpoint
    console.log('1. Testing API endpoint without token...');
    try {
      const response = await fetch('http://localhost:3000/system/logs');
      const data = await response.json();
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(data)}`);
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }

    // Wait a moment for async logging to complete
    console.log('\n2. Waiting for async logging to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check what was logged
    console.log('\n3. Checking logged errors...');
    const recentLogs = await SystemLog.find({
      module: 'auth',
      level: 'warn'
    })
    .sort({ timestamp: -1 })
    .limit(5);

    console.log(`\n📈 Found ${recentLogs.length} authentication errors:`);
    recentLogs.forEach((log, index) => {
      const timeAgo = new Date() - new Date(log.timestamp);
      const secondsAgo = Math.floor(timeAgo / 1000);
      
      console.log(`\n${index + 1}. ${log.action_type.toUpperCase()}`);
      console.log(`   Message: ${log.message}`);
      console.log(`   Time: ${secondsAgo} seconds ago`);
      console.log(`   IP: ${log.details?.ipAddress || 'N/A'}`);
      console.log(`   URL: ${log.details?.url || 'N/A'}`);
    });

    if (recentLogs.length === 0) {
      console.log('\n❌ No authentication errors found!');
      console.log('   This means the error logging is still not working properly.');
    } else {
      console.log('\n✅ Authentication errors are being logged!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testAuthLogging();
