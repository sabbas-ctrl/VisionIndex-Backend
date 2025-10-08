import { Role } from '../models/Role.js';
import { RolePermission } from '../models/RolePermission.js';
import { Permission } from '../models/Permission.js';

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
    
    // Get role info before deletion for audit logging
    const roleToDelete = await Role.findById(id);
    if (!roleToDelete) return res.status(404).json({ error: 'Role not found' });
    
    const deleted = await Role.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Role not found' });
    if (deleted.blocked && deleted.reason === 'ROLE_HAS_ASSIGNED_USERS') {
      return res.status(409).json({ error: 'Role has users assigned and cannot be deleted', assignedUsers: deleted.assignedUsers });
    }
    
    // Return role info for audit logging
    res.json({ 
      message: 'Role deleted successfully',
      role_name: roleToDelete.role_name,
      role_id: roleToDelete.role_id,
      description: roleToDelete.description
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const assignPermissionToRole = async (req, res) => {
  try {
    const { roleId, permissionId } = req.body;
    await RolePermission.add(roleId, permissionId);
    
    // Get role and permission names for audit logging
    const role = await Role.findById(roleId);
    const permission = await Permission.findById(permissionId);
    
    res.json({ 
      message: 'Permission assigned to role',
      role_name: role?.role_name,
      role_id: roleId,
      permission_name: permission?.permission_name,
      permission_id: permissionId
    });
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

// Remove a specific permission from a role (does not delete the permission itself)
export const removePermissionFromRole = async (req, res) => {
  try {
    const { roleId, permissionId } = req.params;
    
    // Get role and permission names before removal for audit logging
    const role = await Role.findById(roleId);
    const permission = await Permission.findById(permissionId);
    
    await RolePermission.remove(roleId, permissionId);
    
    res.json({ 
      message: 'Permission removed from role',
      role_name: role?.role_name,
      role_id: roleId,
      permission_name: permission?.permission_name,
      permission_id: permissionId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};