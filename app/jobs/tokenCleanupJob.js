import cron from 'node-cron';
import { RefreshToken } from '../models/RefreshToken.js';
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
  transporter = nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function cleanupExpiredTokens() {
  logger.info("🧹 Starting refresh token cleanup...");

  try {
    // Delete expired tokens
    const expiredCount = await RefreshToken.deleteExpiredTokens();
    
    // Delete revoked tokens (optional - you might want to keep them for audit)
    const revokedCount = await RefreshToken.deleteRevokedTokens();

    const summary = `✅ Cleanup complete: Removed ${expiredCount} expired refresh tokens and ${revokedCount} revoked tokens.`;
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
  } catch (error) {
    logger.error(`❌ Error during token cleanup: ${error.message}`);
    console.error('Token cleanup error:', error);
  }
}

// Schedule job — daily at midnight
cron.schedule('0 0 * * *', cleanupExpiredTokens);

export default cleanupExpiredTokens;