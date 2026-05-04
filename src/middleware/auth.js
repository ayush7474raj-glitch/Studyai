const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'studynovaai_super_secret_key_2024');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
