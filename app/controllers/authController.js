import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { pool } from '../config/postgresql.js';

export const register = async (req, res) => {
  try {
    const { username, email, password, roleId } = req.body;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({ username, email, passwordhash: passwordHash, roleId });
    res.status(201).json({ message: 'User registered', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    await User.updateLogin(user.user_id);

    // Generate refresh token (random string, not JWT)
    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Get device info and IP address
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown IP';
    
    // Store refresh token in separate table
    const refreshTokenRecord = await RefreshToken.create({
      userId: user.user_id,
      refreshToken: refreshTokenValue,
      deviceInfo: deviceInfo.substring(0, 200), // Limit to 200 chars
      ipAddress: ipAddress.substring(0, 50), // Limit to 50 chars
      expiresAt: expiresAt
    });

    // Get user permissions from role_permissions table
    const permissions = await User.getPermissions(user.user_id);

    // Create access token with userId and permissions for security
    const accessToken = jwt.sign(
      { 
        userId: user.user_id,
        permissions: permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // 15 minutes
    );

    // Set HttpOnly cookies for both tokens
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ 
      message: 'Login successful',
      sessionInfo: {
        tokenId: refreshTokenRecord.token_id,
        deviceInfo: refreshTokenRecord.device_info,
        issuedAt: refreshTokenRecord.issued_at
      }
    });

    await pool.query(
      "UPDATE users SET status = 'active' WHERE user_id = $1",
      [user.user_id]
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    // Revoke the specific refresh token from database
    if (refreshToken) {
      await RefreshToken.revokeTokenByToken(refreshToken);
    }

    await pool.query(
      "UPDATE users SET status = 'inactive' WHERE user_id = $1",
      [req.user.userId]   // coming from decoded JWT in middleware
    );

    // Clear both HttpOnly cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshTokenValue = req.cookies.refreshToken;
    
    if (!refreshTokenValue) {
      return res.status(401).json({ error: 'Refresh token not provided' });
    }

    // Find user by refresh token from the new table
    const tokenRecord = await RefreshToken.findByToken(refreshTokenValue);
    if (!tokenRecord) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user permissions from role_permissions table
    const permissions = await User.getPermissions(tokenRecord.user_id);

    // Generate new access token with permissions
    const newAccessToken = jwt.sign(
      { 
        userId: tokenRecord.user_id,
        permissions: permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set new access token cookie
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.json({
      message: "Token refreshed successfully",
      userId: tokenRecord.user_id,
      accessToken: newAccessToken // optional, since it's also in cookie
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyAuth = async (req, res) => {
  try {
    // If we reach here, the authMiddleware has already verified the token
    res.json({ 
      authenticated: true, 
      userId: req.user.userId,
      permissions: req.user.permissions || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// New endpoints for session management
export const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessions = await RefreshToken.findByUserId(userId);
    
    res.json({
      sessions: sessions.map(session => ({
        tokenId: session.token_id,
        deviceInfo: session.device_info,
        ipAddress: session.ip_address,
        issuedAt: session.issued_at,
        expiresAt: session.expires_at,
        isCurrent: session.refresh_token === req.cookies.refreshToken
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user.userId;
    
    // Verify the token belongs to the current user
    const tokenInfo = await RefreshToken.getTokenInfo(tokenId);
    if (!tokenInfo || tokenInfo.user_id !== userId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await RefreshToken.revokeToken(tokenId);
    res.json({ message: 'Session revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const revokeAllSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    await RefreshToken.revokeAllUserTokens(userId);
    
    // Clear current session cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({ message: 'All sessions revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
