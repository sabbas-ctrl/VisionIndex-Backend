import { pool } from '../config/postgresql.js';

export class Role {
  static async create({ roleName, description }) {
    const result = await pool.query(
      `INSERT INTO roles (role_name, description)
       VALUES ($1, $2) RETURNING *`,
      [roleName, description]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM roles ORDER BY role_id');
    return result.rows;
  }

  static async findById(roleId) {
    const result = await pool.query(
      'SELECT * FROM roles WHERE role_id = $1',
      [roleId]
    );
    return result.rows[0];
  }

  static async delete(roleId) {
    await pool.query('DELETE FROM roles WHERE role_id = $1', [roleId]);
    return { message: 'Role deleted' };
  }
}