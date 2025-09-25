import { pool } from '../config/postgresql.js';

export class User {
  static async create({ username, email, passwordhash, roleId }) {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role_id, status)
       VALUES ($1, $2, $3, $4, 'inactive')
       RETURNING user_id, username, email, role_id, status`,
      [username, email, passwordhash, roleId]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.status,
        u.role_id,
        r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      ORDER BY u.user_id
    `);
    return result.rows;
  }

  static async findById(userId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  // Update login timestamp
  static async updateLogin(userId) {
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  }

  static async update(userId, { username, email, roleId, isActive }) {
    const result = await pool.query(
      `UPDATE users
       SET username = $1, email = $2, role_id = $3, status = $4
       WHERE user_id = $5
       RETURNING *`,
      [username, email, roleId, isActive ? 'active' : 'inactive', userId]
    );
    return result.rows[0];
  }

    // Assign role
    static async updateRole(userId, roleId) {
      await pool.query(
        `UPDATE users SET role_id = $1 WHERE user_id = $2`,
        [roleId, userId]
      );
    }

  static async delete(userId) {
    const result = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING *',
      [userId]
    );
  
    return result.rows[0]; // will be undefined if no user found
  }

  // Get user permissions from role_permissions table only
  static async getPermissions(userId) {
    const result = await pool.query(
      `SELECT p.permission_name
       FROM users u
       JOIN role_permissions rp ON u.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE u.user_id = $1`,
      [userId]
    );
    return result.rows.map(row => row.permission_name);
  }
}