import { pool } from '../config/postgresql.js';

export class UserPermission {
  static async add(userId, permissionId, isGranted) {
    const result = await pool.query(
      `INSERT INTO user_permissions (user_id, permission_id, is_granted)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = $3
       RETURNING *`,
      [userId, permissionId, isGranted]
    );
    return result.rows[0];
  }

  static async remove(userId, permissionId) {
    await pool.query(
      'DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
      [userId, permissionId]
    );
    return { message: 'User permission removed' };
  }

  static async findByUser(userId) {
    const result = await pool.query(
      `SELECT p.permission_name, up.is_granted
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.permission_id
       WHERE up.user_id = $1`,
      [userId]
    );
    return result.rows;
  }
}