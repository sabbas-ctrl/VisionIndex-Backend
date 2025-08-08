import cron from 'node-cron';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import winston from 'winston';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: 'logs/auth.log' })],
});

// Email transport (only if email reporting enabled)
let transporter = null;
if (process.env.SEND_CLEANUP_EMAIL === 'true') {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

async function cleanupExpiredTokens() {
  logger.info("🧹 Starting refresh token cleanup...");

  const usersWithTokens = await User.find({ refreshToken: { $exists: true, $ne: null } });
  let removedCount = 0;
  let keptCount = 0;

  for (const user of usersWithTokens) {
    try {
      // Verify without throwing
      jwt.verify(user.refreshToken, JWT_REFRESH_SECRET);
      keptCount++;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        await User.updateOne({ _id: user._id }, { $unset: { refreshToken: "" } });
        removedCount++;
      } else {
        logger.error(`❌ Error verifying token for ${user.email}: ${err.message}`);
      }
    }
  }

  const summary = `✅ Cleanup complete: Removed ${removedCount} expired refresh tokens, kept ${keptCount} active ones.`;
  logger.info(summary);
  console.log(summary);

  // Optional email report
  if (transporter) {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.CLEANUP_EMAIL_TO,
      subject: "Refresh Token Cleanup Summary",
      text: summary
    });
    logger.info("📧 Cleanup summary email sent.");
  }
}

// Schedule job — daily at midnight
cron.schedule('0 0 * * *', cleanupExpiredTokens);

export default cleanupExpiredTokens;
