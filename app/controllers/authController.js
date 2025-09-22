import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
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
    const refreshToken = crypto.randomBytes(64).toString('hex');
    
    // Store refresh token in database
    await User.setRefreshToken(user.user_id, refreshToken);

    // Create access token with only userId for security
    const accessToken = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Increased to 15 minutes
    );

    // Set HttpOnly cookies for both tokens
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ message: 'Login successful' });

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
    // Clear refresh token from database
    await User.clearRefreshToken(req.user.userId);

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
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not provided' });
    }

    // Find user by refresh token
    const user = await User.findByRefreshToken(refreshToken);
    if (!user) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: user.user_id },
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
      userId: user.user_id,
      accessToken: newAccessToken // optional, since it's also in cookie
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyAuth = async (req, res) => {
  try {
    // If we reach here, the authMiddleware has already verified the token
    res.json({ authenticated: true, userId: req.user.userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
