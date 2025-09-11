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
