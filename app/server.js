import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { startAnalyticsJobs } from './jobs/analyticsJob.js';
import { connectDB } from './config/postgresql.js';
import { connectMongoDB } from './config/mongodb.js'; 
import routes from './routes/index.js';
import internalRoutes from './routes/internalRoutes.js';
import { initializeTemporalClient } from './utils/temporalClient.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Allow cookies to be sent
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());

// Routes
// Internal worker callbacks (no auth, token-protected)
app.use('/internal', internalRoutes);
app.use('/', routes); // Update this line

app.get('/', (req, res) => {
  res.send('VisionIndex Backend');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  
  // Initialize database connections
  await connectDB();
  await connectMongoDB();
  
  // Initialize Temporal client (optional - will log warning if not available)
  try {
    await initializeTemporalClient();
    console.log('✅ Temporal client initialized');
  } catch (error) {
    console.warn('⚠️  Temporal client not available:', error.message);
    console.warn('   Video processing workflows will not work until Temporal server is started');
    console.warn('   Run: docker run -p 7233:7233 temporalio/auto-setup:latest');
  }
  
  // Start analytics jobs
  startAnalyticsJobs();
});

export default app;
