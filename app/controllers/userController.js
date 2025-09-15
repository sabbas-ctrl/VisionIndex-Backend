import { User } from '../models/User.js';
import { UserPermission } from '../models/UserPermission.js';
import bcrypt from 'bcrypt';


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

    // Hash password here
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      passwordhash: hashedPassword, // ✅ store hashed
      roleId
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, roleId, isActive } = req.body;
    const user = await User.update(id, { username, email, roleId, isActive });
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
    const deleted = await User.delete(id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
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
