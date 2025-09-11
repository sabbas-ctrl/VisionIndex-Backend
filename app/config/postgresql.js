import pkg from 'pg';
import dotenv from 'dotenv';
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
    process.exit(1);
  }
};