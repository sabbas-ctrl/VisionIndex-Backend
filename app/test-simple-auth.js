import mongoose from 'mongoose';
import { SystemLog } from './models/mongodb/SystemLog.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSimpleAuth() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing Simple Authentication...\n');

    // Test the API endpoint multiple times
    for (let i = 1; i <= 3; i++) {
      console.log(`\n${i}. Testing API call ${i}...`);
      try {
        const response = await fetch('http://localhost:3000/system/logs');
        const data = await response.json();
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(data)}`);
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
      
      // Wait between calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Wait for async logging to complete
    console.log('\n4. Waiting for async logging to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check what was logged
    console.log('\n5. Checking logged errors...');
    const recentLogs = await SystemLog.find({
      module: 'auth',
      level: 'warn',
      'details.url': '/system/logs'
    })
    .sort({ timestamp: -1 })
    .limit(5);

    console.log(`\n📈 Found ${recentLogs.length} authentication errors for /system/logs:`);
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
      console.log('\n❌ No authentication errors found for /system/logs!');
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

testSimpleAuth();
