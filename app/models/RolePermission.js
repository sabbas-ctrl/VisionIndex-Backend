import { pool } from '../config/postgresql.js';

export class RolePermission {
  static async add(roleId, permissionId) {
    const result = await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
      [roleId, permissionId]
    );
    return result.rows[0];
  }

  static async remove(roleId, permissionId) {
    await pool.query(
      'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
      [roleId, permissionId]
    );
    return { message: 'Role permission removed' };
  }

  static async findByRole(roleId) {
    const result = await pool.query(
      `SELECT p.* 
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    return result.rows;
  }
}