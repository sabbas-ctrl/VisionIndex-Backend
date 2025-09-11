import { pool } from '../config/postgresql.js';

export class User {
  static async create({ username, email, passwordHash, roleId }) {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [username, email, passwordHash, roleId]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM users ORDER BY user_id');
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

  static async updateLogin(userId) {
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  }

  static async delete(userId) {
    'await pool.query(DELETE FROM users WHERE user_id = $1, [userId])';
    return { message: 'User deleted' };
  }
}