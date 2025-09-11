import { Role } from '../models/Role.js';
import { RolePermission } from '../models/RolePermission.js';

export const createRole = async (req, res) => {
  try {
    const { roleName, description } = req.body;
    const role = await Role.create({ roleName, description });
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const assignPermissionToRole = async (req, res) => {
  try {
    const { roleId, permissionId } = req.body;
    await RolePermission.add(roleId, permissionId);
    res.json({ message: 'Permission assigned to role' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRolePermissions = async (req, res) => {
  try {
    const { id } = req.params; // roleId
    const permissions = await RolePermission.findByRole(id);
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
