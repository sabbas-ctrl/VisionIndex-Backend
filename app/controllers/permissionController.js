import { Permission } from '../models/Permission.js';

export const createPermission = async (req, res) => {
  try {
    const { permissionName, description } = req.body;
    const permission = await Permission.create({ permissionName, description });
    res.status(201).json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listPermissions = async (req, res) => {
  try {
    const permissions = await Permission.findAll();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.findById(id);
    if (!permission) return res.status(404).json({ error: 'Permission not found' });
    res.json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    await Permission.delete(id);
    res.json({ message: 'Permission deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionName, description } = req.body;

    if (!permissionName && !description) {
      return res.status(400).json({ error: 'permissionName or description required' });
    }

    const updated = await Permission.update(id, { permissionName, description });
    if (!updated) return res.status(404).json({ error: 'Permission not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};