import User from '../models/User.js';

// ✅ Check if user has a specific permission
export const hasPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(401).json({ message: 'User not found' });

      if (!user.permissions.includes(requiredPermission)) {
        return res.status(403).json({ message: 'Insufficient permission' });
      }

      next();
    } catch (err) {
      console.error('Permission verification error:', err);
      return res.status(500).json({ message: 'Server error during permission check' });
    }
  };
};

// 🔁 Optional: Check if user has any of the provided permissions
export const hasAnyPermission = (permissionsArray) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(401).json({ message: 'User not found' });

      const hasAny = permissionsArray.some(p => user.permissions.includes(p));
      if (!hasAny) {
        return res.status(403).json({ message: 'None of the required permissions granted' });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({ message: 'Server error during permission check' });
    }
  };
};
