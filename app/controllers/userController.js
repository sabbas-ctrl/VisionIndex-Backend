import { User } from '../models/User.js';
import { UserPermission } from '../models/UserPermission.js';

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
