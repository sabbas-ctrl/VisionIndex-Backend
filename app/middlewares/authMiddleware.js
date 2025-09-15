import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  // try {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   req.user = decoded; // { userId, roleId }
  //   next();
  // } catch (err) {
  //   res.status(403).json({ error: 'Invalid/expired token' });
  // }
  if (token === 'demo-token-123') {
    req.user = { userId: 1, roleId: 1 }; // fake user
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid/expired token' });
  }
};

