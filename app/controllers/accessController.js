import { pool } from '../config/postgresql.js';

export const getEffectivePermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Role permissions
    const rolePerms = await pool.query(
      `SELECT p.permission_name
       FROM users u
       JOIN role_permissions rp ON u.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE u.user_id = $1`,
      [userId]
    );

    // User overrides
    const userPerms = await pool.query(
      `SELECT p.permission_name, up.is_granted
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.permission_id
       WHERE up.user_id = $1`,
      [userId]
    );

    let perms = new Set(rolePerms.rows.map(r => r.permission_name));
    userPerms.rows.forEach(up => {
      if (up.is_granted) perms.add(up.permission_name);
      else perms.delete(up.permission_name);
    });

    res.json({ userId, effectivePermissions: [...perms] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
