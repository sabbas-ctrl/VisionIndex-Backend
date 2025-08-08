import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { ROLES, PERMISSIONS } from '../models/User.js';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

// === Logger Setup ===
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'logs/auth.log' })],
});

// === Secrets from Environment ===
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.error("❌ JWT secrets are missing from .env");
}

// === Generate Access + Refresh Tokens ===
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    permissions: user.permissions,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// === REGISTER ===
export const register = async (req, res) => {
  try {
    const { fullName, email, password, role, permissions, addedBy } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists.' });

    const addedByUser = await User.findById(addedBy);
    if (!addedByUser || addedByUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can register users.' });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    const validPermissions = permissions?.filter(p => PERMISSIONS.includes(p)) || [];
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      permissions: validPermissions,
      addedBy,
    });

    await newUser.save();
    logger.info(`✅ User registered: ${email} by ${addedBy}`);

    res.status(201).json({ message: 'User registered successfully.' });

  } catch (err) {
    logger.error('❌ Registration failed', err);
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// === LOGIN ===
export const login = async (req, res) => {
  try {
    console.log("ENV JWT_SECRET:", !!JWT_SECRET);
    console.log("ENV JWT_REFRESH_SECRET:", !!JWT_REFRESH_SECRET);

    const { email, password } = req.body;
    console.log("Login attempt:", email);

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatch);

    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token for future verification
    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`✅ User login: ${email}`);

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });

  } catch (err) {
    logger.error('❌ Login failed', err);
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// === LOGOUT ===
export const logout = async (req, res) => {
  try {
    const userId = req.user?.id; // if you have verifyToken middleware
    if (userId) {
      await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
      logger.info(`User ${userId} logged out — refresh token removed from DB`);
    }
    res.status(200).json({ message: 'Logout successful. Refresh token removed.' });
  } catch (err) {
    logger.error('Logout error', err);
    res.status(500).json({ message: 'Server error during logout.' });
  }
};

// === REFRESH TOKEN ===
export const refreshToken = async (req, res) => {
  const token = req.body.token;
  if (!token) return res.status(401).json({ message: 'Refresh token required' });

  try {
    console.log("Incoming refresh token:", token);
    const user = await User.findOne({ refreshToken: token });
    console.log("User found:", !!user);

    if (!user) return res.status(403).json({ message: 'Invalid refresh token' });

    jwt.verify(token, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err || decoded.id !== user._id.toString()) {
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
      user.refreshToken = newRefreshToken;
      await user.save(); // ✅ Ensure DB is updated before returning

      res.json({ accessToken, refreshToken: newRefreshToken });
    });
  } catch (err) {
    console.error('REFRESH ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// === DEV REGISTER ===
export const devRegister = async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ email: 'sabbbas.a30@gmail.com' });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    const admin = new User({
      fullName: 'Sabbas Ahmad',
      email: 'sabbbas.a30@gmail.com',
      password: hashedPassword,
      role: 'admin',
      permissions: PERMISSIONS,
      addedBy: null,
    });

    await admin.save();
    res.status(201).json({ message: 'Initial admin created', email: admin.email });
  } catch (err) {
    console.error("DEV REGISTER ERROR:", err);
    res.status(500).json({ message: 'Failed to create admin', error: err.message });
  }
};
