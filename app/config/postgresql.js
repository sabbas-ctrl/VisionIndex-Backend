import pkg from 'pg';
import dotenv from 'dotenv';
import { ErrorLogger } from '../utils/errorLogger.js';
const { Pool } = pkg;
dotenv.config();

console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD); // Add this line
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

export const pool = new Pool({
  user: process.env.DB_USER,      // e.g. "postgres"
  host: process.env.DB_HOST,      // e.g. "localhost"
  database: process.env.DB_NAME,  // your db name
  password: process.env.DB_PASSWORD,  // your db password
  port: process.env.DB_PORT || 5432,
});

// optional: verify connection at startup
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected');
    client.release();
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
    // Log database connection error
    await ErrorLogger.logDatabaseError(err, null, {
      actionType: 'database_connection',
      details: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
      }
    });
    process.exit(1);
  }
};

// Enhanced pool with error logging
const originalQuery = pool.query;
pool.query = async function(text, params) {
  try {
    return await originalQuery.call(this, text, params);
  } catch (error) {
    // Log database query errors
    await ErrorLogger.logDatabaseError(error, null, {
      actionType: 'database_query',
      details: {
        query: text.substring(0, 200), // First 200 chars of query
        params: params ? params.length : 0
      }
    });
    throw error;
  }
};