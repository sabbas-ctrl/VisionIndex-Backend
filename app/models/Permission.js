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
    await pool.query('DELETE FROM permissions WHERE permission_id = $1, [permissionId]');
    return { message: 'Permission deleted' };
  }
}