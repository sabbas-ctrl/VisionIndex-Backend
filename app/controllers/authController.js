import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { pool } from '../config/postgresql.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { sendMail } from '../config/mailer.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { emailTemplates } from '../utils/emailTemplates.js';

export const register = async (req, res) => {
  try {
    const { username, email, password, roleId } = req.body;

    // Validate email using shared validator (format + blocklist)
    try {
      const { validateEmailOrThrow } = await import('../utils/emailValidator.js');
      validateEmailOrThrow(email);
    } catch (e) {
      const status = e?.statusCode || 400;
      return res.status(status).json({ error: e?.message || 'Invalid email' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({ username, email, passwordhash: passwordHash, roleId });
    // Create email verification token and send verification email
    try {
      const rawToken = EmailVerificationToken.generateToken();
      await EmailVerificationToken.createForUser(user.user_id, rawToken, 24);

      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
      const verifyUrl = `${frontendBase}/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;

      const { subject, html, text } = emailTemplates.verification({ username, verifyUrl });

      const emailConfigured = !!(process.env.RESEND_API_KEY);
      if (emailConfigured) {
        await sendMail({ to: email, subject, html, text });
      } else {
        console.warn('RESEND_API_KEY not configured. Skipping verification email.');
        console.info('DEV VERIFY LINK:', verifyUrl);
      }
    } catch (mailErr) {
      console.warn('Email verification send failed:', mailErr?.message || mailErr);
    }

    res.status(201).json({ message: 'User registered. Please verify your email.', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Ensure is_verified column exists and enforce verification
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
    } catch (_) { }

    if (user.is_verified === false || user.is_verified === 0) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

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

    // Get user role information
    const roleResult = await pool.query(
      `SELECT r.role_id, r.role_name, r.description 
       FROM roles r 
       WHERE r.role_id = $1`,
      [user.role_id]
    );
    const userRole = roleResult.rows[0];

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
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email
      },
      role: {
        role_id: userRole.role_id,
        role_name: userRole.role_name,
        description: userRole.description
      },
      permissions: permissions,
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
      [req.user.userId || req.user.user_id]   // coming from decoded JWT in middleware
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
      userId: req.user.userId || req.user.user_id,
      permissions: req.user.permissions || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSession = async (req, res) => {
  try {
    // authMiddleware has already decoded the access token
    // Access token is stored in req.user.iat (issued at) and exp (expiry)
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token not found' });
    }

    // Decode without verification to get exp claim
    const decoded = jwt.decode(accessToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const userId = req.user.userId || req.user.user_id;
    const refreshTokenValue = req.cookies.refreshToken;

    // Get refresh token expiry from DB
    const refreshTokenRecord = await RefreshToken.findByToken(refreshTokenValue);
    if (!refreshTokenRecord) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    // Get user basic info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email
      },
      accessTokenExp: decoded.exp, // Unix timestamp (seconds)
      refreshTokenExp: Math.floor(refreshTokenRecord.expires_at.getTime() / 1000), // Convert to Unix timestamp
      issuedAt: Math.floor(decoded.iat)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;

    // Get user information
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user role information
    const roleResult = await pool.query(
      `SELECT r.role_id, r.role_name, r.description 
       FROM roles r 
       WHERE r.role_id = $1`,
      [user.role_id]
    );
    const userRole = roleResult.rows[0];

    // Get user permissions
    const permissions = await User.getPermissions(userId);

    res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        status: user.status,
        last_login: user.last_login,
        created_at: user.created_at
      },
      role: {
        role_id: userRole.role_id,
        role_name: userRole.role_name,
        description: userRole.description
      },
      permissions: permissions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// New endpoints for session management
export const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
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
    const userId = req.user.userId || req.user.user_id;

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
    const userId = req.user.userId || req.user.user_id;
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

// Verify email: mark user active after valid token
export const verifyEmail = async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: 'Email and token are required' });

    const record = await EmailVerificationToken.verifyAndUse(email, token);
    if (!record) return res.status(400).json({ error: 'Invalid or expired verification token' });

    // Ensure column exists, then mark as verified (do not change status here)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
    } catch (_) { }
    await pool.query(`UPDATE users SET is_verified = TRUE WHERE user_id = $1`, [record.user_id]);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findByEmail(email);
    // Return explicit not-found so frontend can inform user appropriately
    if (!user) return res.status(404).json({ error: 'User with this email does not exist' });

    let rawToken = null;
    try {
      rawToken = PasswordResetToken.generateToken();
      await PasswordResetToken.createForUser(user.user_id, rawToken, 30);
    } catch (dbErr) {
      console.error('Failed to create password reset token:', dbErr?.message || dbErr);
      // Continue to respond success to avoid user enumeration; no email will be sent
    }

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = rawToken
      ? `${frontendBase}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`
      : null;

    const { subject, html, text } = emailTemplates.passwordReset({ username: user.username, resetUrl });

    const emailConfigured = !!process.env.RESEND_API_KEY;
    try {
      if (emailConfigured && resetUrl) {
        await sendMail({ to: email, subject, html, text });
      } else {
        console.warn('RESEND_API_KEY not configured. Skipping email send.');
        if (resetUrl) console.info('DEV RESET LINK:', resetUrl);
      }
    } catch (mailErr) {
      console.warn('Email send failed for forgot-password:', mailErr?.message || mailErr);
      if (resetUrl) console.info('DEV RESET LINK (email failed):', resetUrl);
      // Intentionally do not fail the request to avoid leaking state
    }

    res.json({ message: `A reset link was sent to ${user.username}`, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reset password: verify token and update password
export const resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) {
      return res.status(400).json({ error: 'Email, token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const record = await PasswordResetToken.verifyAndUse(email, token);
    if (!record) return res.status(400).json({ error: 'Invalid or expired token' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [passwordHash, record.user_id]
    );

    // Revoke all sessions after password reset
    await RefreshToken.revokeAllUserTokens(record.user_id);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Change password: verify current password and update to new password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId; // From auth middleware

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current user data
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [newPasswordHash, userId]
    );

    // Revoke all refresh tokens to force re-login
    await RefreshToken.revokeAllUserTokens(userId);

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};