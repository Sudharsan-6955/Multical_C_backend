const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Try to get token from cookie first (more secure), then fallback to Authorization header
  const token = req.cookies.authToken || 
                (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
