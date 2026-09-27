import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access Denied: Missing Authentication Token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'MILITARY_DEFENSE_TOP_SECRET_JWT_KEY_2026', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Forbidden: Role '${req.user?.role}' does not have permission to execute this operation.` 
      });
    }
    next();
  };
};

export const scopeToBase = (req, res, next) => {
  if (req.user.role === 'ADMIN') return next();

  const targetBaseId = req.body.baseId || req.query.baseId || req.body.originBaseId;
  
  if (targetBaseId && targetBaseId !== req.user.baseId) {
    return res.status(403).json({ 
      message: 'Access Denied: You cannot manipulate or inspect resources outside your designated base command.' 
    });
  }
  
  next();
};
