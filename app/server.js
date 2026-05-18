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
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Allow cookies to be sent
}));

app.use(helmet());
app.use(cookieParser());

// Routes
// Internal worker callbacks (no auth, token-protected)
app.use('/internal', internalRoutes);
app.use('/', routes);

app.get('/', (req, res) => {
  res.send('VisionIndex Backend');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// ─── Global error handler ─────────────────────────────────────────────
// Catches unhandled errors from route handlers and sanitizes before sending
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  const status = err.status || err.statusCode || 500;
  const raw = err.message || '';

  // Strip technical / SQL / stack-trace noise from client-facing response
  const isTechnical = /relation|column|syntax|ECONNREFUSED|ETIMEDOUT|duplicate key|violates|constraint|stack|at\s+\w+\s*\(/i.test(raw);
  const message = (!isTechnical && raw.length > 0 && raw.length < 120)
    ? raw
    : 'Internal server error';

  res.status(status).json({ success: false, error: message });
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
