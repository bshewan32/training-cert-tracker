require('dotenv').config();
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;
console.log('Auth Middleware - Secret key loaded:', !!process.env.JWT_SECRET);
console.log('Auth Middleware - Secret key value:', SECRET_KEY); // Add this line

const authenticateToken = (req, res, next) => {
  console.log('Auth Header:', req.headers.authorization);
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.log('Verification Error:', err);
      console.log('Verification Secret:', SECRET_KEY); // Add this line
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, SECRET_KEY };
