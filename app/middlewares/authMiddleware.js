import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/RefreshToken.js';

export const authMiddleware = (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid/expired token' });
  }
};

// Middleware to validate refresh tokens
export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not provided' });
    }

    // Validate refresh token from database
    const tokenRecord = await RefreshToken.findByToken(refreshToken);
    if (!tokenRecord) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Add user info to request
    req.user = { userId: tokenRecord.user_id };
    req.refreshTokenRecord = tokenRecord;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Token validation error' });
  }
};

