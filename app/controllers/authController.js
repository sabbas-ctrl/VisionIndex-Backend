import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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

    // Create token with only userId for security
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set HttpOnly cookie
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: 'strict',
      // maxAge: 1 * 60 * 1000, // 15 minutes in milliseconds
      expires: '1m'
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
    await pool.query(
      "UPDATE users SET status = 'inactive' WHERE user_id = $1",
      [req.user.userId]   // coming from decoded JWT in middleware
    );

    // Clear the HttpOnly cookie
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ message: 'Logged out successfully' });
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
