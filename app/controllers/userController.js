import { User } from '../models/User.js';
import { UserPermission } from '../models/UserPermission.js';
import bcrypt from 'bcrypt';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { sendMail } from '../config/mailer.js';


// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    const { username, email, password, roleId } = req.body;

    // Basic email validation and blocklist check
    try {
      const { validateEmailOrThrow } = await import('../utils/emailValidator.js');
      validateEmailOrThrow(email);
    } catch (e) {
      const status = e?.statusCode || 400;
      return res.status(status).json({ error: e?.message || 'Invalid email' });
    }

    // Validate password length
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Hash password here
    const hashedPassword = await bcrypt.hash(password, 10);

    // Ensure is_verified column exists for new users
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
    } catch (_) {}

    const user = await User.create({
      username,
      email,
      passwordhash: hashedPassword, // ✅ store hashed
      roleId
    });

    // Send email verification to the newly created user
    try {
      const rawToken = EmailVerificationToken.generateToken();
      await EmailVerificationToken.createForUser(user.user_id, rawToken, 24);

      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
      const verifyUrl = `${frontendBase}/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;
      const subject = 'Verify your VisionIndex account';
      const html = `
        <p>Hello ${username || ''},</p>
        <p>Your account was created by an administrator. Please verify your email to activate your account.</p>
        <p><a href="${verifyUrl}">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
      `;
      const text = `Verify your email: ${verifyUrl}`;

      const smtpConfigured = !!(process.env.SMTP_HOST);
      if (smtpConfigured) {
        await sendMail({ to: email, subject, html, text });
      } else {
        console.warn('SMTP not configured. Skipping verification email for created user.');
        console.info('DEV VERIFY LINK (created user):', verifyUrl);
      }
    } catch (mailErr) {
      console.warn('Email verification send failed for created user:', mailErr?.message || mailErr);
    }

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, roleId, isActive, password } = req.body;
    
    // Validate password length if provided
    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Prepare update data
    const updateData = { username, email, roleId, isActive };
    
    // Hash password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.passwordhash = hashedPassword;
    }

    const user = await User.update(id, updateData);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user info before deletion for audit logging
    const userToDelete = await User.findById(id);
    if (!userToDelete) return res.status(404).json({ error: 'User not found' });
    
    const deleted = await User.delete(id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    
    // Return user info for audit logging
    res.json({ 
      message: 'User deleted successfully',
      username: userToDelete.username,
      email: userToDelete.email,
      user_id: userToDelete.user_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { userId } = req.user; // from authMiddleware
    const user = await User.findById(userId);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const assignRole = async (req, res) => {
  try {
    const { id } = req.params; // userId
    const { roleId } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.updateRole(id, roleId);
    res.json({ message: 'Role assigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addUserPermission = async (req, res) => {
  try {
    const { id } = req.params; // userId
    const { permissionId, isGranted } = req.body;
    const up = await UserPermission.add(id, permissionId, isGranted);
    res.status(201).json(up);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
