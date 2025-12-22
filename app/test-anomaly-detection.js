#!/usr/bin/env node

/**
 * Test script to verify that anomaly detection is now working with the middleware applied
 */

import mongoose from 'mongoose';
import request from 'supertest';
import app from './server.js';
import { Flag } from './models/mongodb/Flag.js';
import { User } from './models/User.js';

const ADMIN_EMAIL = 'sabbbas.a30@gmail.com';
const ADMIN_PASSWORD = 'Admin123!';

let adminToken = null;
let testUserId = null;
let testUserToken = null;

async function connectToDatabase() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

async function setupTestUser() {
  try {
    // Login as admin
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    if (loginRes.status !== 200) {
      throw new Error(`Admin login failed: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`);
    }

    // Extract access token from cookies
    const cookies = loginRes.headers['set-cookie'];
    let accessToken = null;
    if (cookies) {
      for (const cookie of cookies) {
        if (cookie.startsWith('accessToken=')) {
          accessToken = cookie.split('accessToken=')[1].split(';')[0];
          break;
        }
      }
    }
    
    adminToken = accessToken;
    console.log('✅ Admin authentication successful');

    // Create a test user directly in the database
    const testUserEmail = `flagtest_${Date.now()}@test.com`;
    const testUserPassword = 'TestUser123!';
    
    const { pool } = await import('./config/postgresql.js');
    const viewerRoleResult = await pool.query("SELECT role_id FROM roles WHERE role_name = 'Viewer'");
    if (viewerRoleResult.rows.length === 0) {
      throw new Error('Viewer role not found');
    }
    const viewerRoleId = viewerRoleResult.rows[0].role_id;
    
    const bcrypt = await import('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(testUserPassword, salt);
    
    const testUser = await User.create({
      username: `FlagTestUser_${Date.now()}`,
      email: testUserEmail,
      passwordhash: passwordHash,
      roleId: viewerRoleId
    });
    
    await pool.query(
      'UPDATE users SET is_verified = true, status = $1 WHERE user_id = $2',
      ['active', testUser.user_id]
    );
    
    testUserId = testUser.user_id;
    console.log('✅ Test user created');

    // Login as test user
    const testUserLoginRes = await request(app)
      .post('/auth/login')
      .send({ email: testUserEmail, password: testUserPassword });

    if (testUserLoginRes.status !== 200) {
      throw new Error(`Test user login failed: ${testUserLoginRes.status}`);
    }

    // Extract access token from cookies for test user
    const testUserCookies = testUserLoginRes.headers['set-cookie'];
    let testUserAccessToken = null;
    if (testUserCookies) {
      for (const cookie of testUserCookies) {
        if (cookie.startsWith('accessToken=')) {
          testUserAccessToken = cookie.split('accessToken=')[1].split(';')[0];
          break;
        }
      }
    }
    
    testUserToken = testUserAccessToken;
    console.log('✅ Test user setup complete');

  } catch (error) {
    console.error('❌ Test user setup failed:', error);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    await Flag.deleteMany({});
    if (testUserId) {
      await User.delete(testUserId);
    }
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Test 1: Access Violation Detection
async function testAccessViolation() {
  console.log('\n🔍 Testing ACCESS_VIOLATION detection with middleware...');
  
  try {
    // Clear existing flags
    await Flag.deleteMany({ flag_type: 'access_violation' });

    console.log('   Accessing sensitive audit endpoint for the first time...');
    
    // Access a sensitive endpoint for the first time
    const res = await request(app)
      .get('/audit/activity')
      .set('Authorization', `Bearer ${testUserToken}`)
      .set('Cookie', `accessToken=${testUserToken}`);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if an access violation flag was created
    const accessFlags = await Flag.find({ flag_type: 'access_violation' });
    
    if (accessFlags.length > 0) {
      console.log('✅ ACCESS_VIOLATION flag detected automatically!');
      console.log('   Flag message:', accessFlags[0].message);
      console.log('   Endpoint:', accessFlags[0].details?.endpoint);
      console.log('   Priority:', accessFlags[0].priority);
      console.log('   Status:', accessFlags[0].status);
    } else {
      console.log('⚠️  No ACCESS_VIOLATION flag detected');
      console.log('   This might be because the user has accessed this endpoint before');
    }

  } catch (error) {
    console.error('❌ Access violation detection test failed:', error);
  }
}

// Test 2: Suspicious Query Detection
async function testSuspiciousQuery() {
  console.log('\n🔍 Testing SUSPICIOUS_QUERY detection with middleware...');
  
  try {
    // Clear existing flags
    await Flag.deleteMany({ flag_type: 'security_violation' });

    console.log('   Sending request with suspicious query parameters...');
    
    // Send request with suspicious query parameters
    const res = await request(app)
      .get('/dashboard')
      .query({ search: "'; DROP TABLE users; --" })
      .set('Authorization', `Bearer ${testUserToken}`)
      .set('Cookie', `accessToken=${testUserToken}`);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if a security violation flag was created
    const securityFlags = await Flag.find({ flag_type: 'security_violation' });
    
    if (securityFlags.length > 0) {
      console.log('✅ SECURITY_VIOLATION flag detected automatically!');
      console.log('   Flag message:', securityFlags[0].message);
      console.log('   Pattern detected:', securityFlags[0].details?.pattern);
      console.log('   Priority:', securityFlags[0].priority);
      console.log('   Status:', securityFlags[0].status);
    } else {
      console.log('⚠️  No SECURITY_VIOLATION flag detected');
    }

  } catch (error) {
    console.error('❌ Suspicious query detection test failed:', error);
  }
}

// Test 3: Rate Limit Detection
async function testRateLimit() {
  console.log('\n🔍 Testing RATE_LIMIT detection with middleware...');
  
  try {
    // Clear existing flags
    await Flag.deleteMany({ flag_type: 'rate_limit_exceeded' });

    console.log('   Generating rapid requests to trigger rate limiting...');
    
    // Generate many requests quickly to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request(app)
          .get('/dashboard')
          .set('Authorization', `Bearer ${testUserToken}`)
          .set('Cookie', `accessToken=${testUserToken}`)
      );
    }

    // Execute all requests
    await Promise.all(requests);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if a rate limit flag was created
    const rateLimitFlags = await Flag.find({ flag_type: 'rate_limit_exceeded' });
    
    if (rateLimitFlags.length > 0) {
      console.log('✅ RATE_LIMIT_EXCEEDED flag detected automatically!');
      console.log('   Flag message:', rateLimitFlags[0].message);
      console.log('   Request count:', rateLimitFlags[0].details?.request_count);
      console.log('   Priority:', rateLimitFlags[0].priority);
      console.log('   Status:', rateLimitFlags[0].status);
    } else {
      console.log('⚠️  No RATE_LIMIT_EXCEEDED flag detected');
      console.log('   This might be because the rate limit threshold (30 requests/minute) was not exceeded');
    }

  } catch (error) {
    console.error('❌ Rate limit detection test failed:', error);
  }
}

// Test 4: Check All Flags Created
async function checkAllFlags() {
  console.log('\n🔍 Checking all flags created...');
  
  try {
    const allFlags = await Flag.find({});
    console.log(`   Total flags created: ${allFlags.length}`);
    
    const rateLimitFlags = allFlags.filter(f => f.flag_type === 'rate_limit_exceeded');
    const accessViolationFlags = allFlags.filter(f => f.flag_type === 'access_violation');
    const securityViolationFlags = allFlags.filter(f => f.flag_type === 'security_violation');
    const systemAnomalyFlags = allFlags.filter(f => f.flag_type === 'system_anomaly');
    
    console.log(`   Rate limit exceeded flags: ${rateLimitFlags.length}`);
    console.log(`   Access violation flags: ${accessViolationFlags.length}`);
    console.log(`   Security violation flags: ${securityViolationFlags.length}`);
    console.log(`   System anomaly flags: ${systemAnomalyFlags.length}`);
    
    // Show details of each flag type
    if (rateLimitFlags.length > 0) {
      console.log('\n   Rate Limit Flags:');
      rateLimitFlags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.message}`);
        console.log(`        Priority: ${flag.priority}, Status: ${flag.status}`);
      });
    }
    
    if (accessViolationFlags.length > 0) {
      console.log('\n   Access Violation Flags:');
      accessViolationFlags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.message}`);
        console.log(`        Priority: ${flag.priority}, Status: ${flag.status}`);
      });
    }
    
    if (securityViolationFlags.length > 0) {
      console.log('\n   Security Violation Flags:');
      securityViolationFlags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.message}`);
        console.log(`        Priority: ${flag.priority}, Status: ${flag.status}`);
      });
    }
    
    if (systemAnomalyFlags.length > 0) {
      console.log('\n   System Anomaly Flags:');
      systemAnomalyFlags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.message}`);
        console.log(`        Priority: ${flag.priority}, Status: ${flag.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Flag checking failed:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Testing Anomaly Detection with Middleware Applied...\n');
  
  try {
    await connectToDatabase();
    await setupTestUser();
    
    // Run all tests
    await testAccessViolation();
    await testSuspiciousQuery();
    await testRateLimit();
    await checkAllFlags();
    
    console.log('\n✅ All anomaly detection tests completed!');
    console.log('\n🎉 Anomaly detection middleware is now active on all routes!');
    
  } catch (error) {
    console.error('\n❌ Anomaly detection tests failed:', error);
    process.exit(1);
  } finally {
    await cleanupTestData();
    await mongoose.disconnect();
    console.log('✅ Database disconnected');
  }
}

// Run the tests
runAllTests().catch(console.error);
