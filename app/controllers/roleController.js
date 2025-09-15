import { Role } from '../models/Role.js';
import { RolePermission } from '../models/RolePermission.js';

// Get all roles
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get role by ID
export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const { roleName, description } = req.body;
    const role = await Role.create({ roleName, description });
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update role
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params; // roleId from URL
    const { roleName, description } = req.body;

    // Ensure at least one field is provided
    if (!roleName && !description) {
      return res.status(400).json({ error: 'Role name or description required' });
    }

    const updatedRole = await Role.update(id, { roleName, description });
    if (!updatedRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(updatedRole);
  } catch (err) {
    console.error('Error updating role:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Delete role
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Role.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Role not found' });
    res.json({ message: 'Role deleted successfully' });
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
