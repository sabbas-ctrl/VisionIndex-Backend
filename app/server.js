import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes.js';
import './jobs/tokenCleanupJob.js';
import { connectDB } from './config/postgresql.js';
import routes from './routes/index.js'; // Add this line

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet())



// Routes
// app.use('/auth', authRoutes);
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

connectDB(); // Connect to DB on server start

export default app; // 👈 Add this line
