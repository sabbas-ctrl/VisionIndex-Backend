import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import './jobs/tokenCleanupJob.js';
import { connectDB } from './config/postgresql.js';
import { connectMongoDB } from './config/mongodb.js'; 
import routes from './routes/index.js';

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
app.use('/', routes); // Update this line

app.get('/', (req, res) => {
  res.send('VisionIndex Backend');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

connectDB();
connectMongoDB();  // MongoDB ✅

export default app;
