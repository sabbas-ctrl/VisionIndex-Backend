import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { ROLES, PERMISSIONS } from '../models/User.js';
import winston from 'winston';

// === Logger Setup ===
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/auth.log' }),
  ],
});

// === Secrets from Environment ===
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

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
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      permissions: validPermissions,
      addedBy,
    });

    await newUser.save();
    logger.info(`User registered: ${email} by ${addedBy}`);

    res.status(201).json({ message: 'User registered successfully.' });

  } catch (err) {
    logger.error('Registration failed', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// === LOGIN ===
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const { accessToken, refreshToken } = generateTokens(user);

    logger.info(`User login: ${email}`);

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
    logger.error('Login failed', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// === LOGOUT ===
export const logout = async (req, res) => {
  try {
    logger.info(`User logout attempt`);
    res.status(200).json({ message: 'Logout handled on client side. Token deleted.' });
  } catch (err) {
    logger.error('Logout error', err);
    res.status(500).json({ message: 'Server error during logout.' });
  }
};
