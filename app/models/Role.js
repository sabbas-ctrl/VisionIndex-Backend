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
    const result = await pool.query(`
      SELECT r.role_id, r.role_name, r.description,
             COUNT(u.user_id) AS role_users
      FROM roles r
      LEFT JOIN users u ON r.role_id = u.role_id
      GROUP BY r.role_id, r.role_name, r.description
      ORDER BY r.role_id
    `);
    return result.rows;
  }

  static async findById(roleId) {
    const result = await pool.query(
      'SELECT * FROM roles WHERE role_id = $1',
      [roleId]
    );
    return result.rows[0];
  }

  static async update(roleId, { roleName, description }) {
    const result = await pool.query(
      `UPDATE roles
       SET role_name = $1, description = $2
       WHERE role_id = $3
       RETURNING *`,
      [roleName, description, roleId]
    );
    return result.rows[0];
  }

  static async delete(roleId) {
    // Check if any users are assigned to this role
    const usersCountResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM users WHERE role_id = $1',
      [roleId]
    );
    const assignedUsers = usersCountResult.rows[0]?.count || 0;
    if (assignedUsers > 0) {
      return { blocked: true, reason: 'ROLE_HAS_ASSIGNED_USERS', assignedUsers };
    }

    await pool.query('DELETE FROM roles WHERE role_id = $1', [roleId]);
    return { message: 'Role deleted' };
  }

  // static async update(roleId, { roleName, description }) {
  //   const result = await pool.query(
  //     `UPDATE roles SET role_name = $1, description = $2 WHERE role_id = $3 RETURNING *`,
  //     [roleName, description, roleId]
  //   );
  //   return result.rows[0];
  // }
}