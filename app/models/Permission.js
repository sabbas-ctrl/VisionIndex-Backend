import { pool } from '../config/postgresql.js';

export class Permission {
  static async create({ permissionName, description }) {
    const result = await pool.query(
      `INSERT INTO permissions (permission_name, description)
       VALUES ($1, $2) RETURNING *`,
      [permissionName, description]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM permissions ORDER BY permission_id');
    return result.rows;
  }

  static async findById(permissionId) {
    const result = await pool.query(
      'SELECT * FROM permissions WHERE permission_id = $1',
      [permissionId]
    );
    return result.rows[0];
  }

  static async delete(permissionId) {
    await pool.query('DELETE FROM permissions WHERE permission_id = $1', [permissionId]);
    return { message: 'Permission deleted' };
  }

  static async update(permissionId, { permissionName, description }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (permissionName !== undefined) {
      fields.push(`permission_name = $${idx++}`);
      values.push(permissionName);
    }

    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(permissionId);

    const result = await pool.query(
      `UPDATE permissions SET ${fields.join(', ')} WHERE permission_id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async isAssignedToAnyRole(permissionId) {
    const result = await pool.query(
      'SELECT 1 FROM role_permissions WHERE permission_id = $1 LIMIT 1',
      [permissionId]
    );
    return result.rowCount > 0;
  }
}