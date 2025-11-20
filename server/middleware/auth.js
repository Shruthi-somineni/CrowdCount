const jwt = require('jsonwebtoken');
const db = require('../db');
const { ObjectId } = require('mongodb');

function getSecret() {
  return process.env.JWT_SECRET || 'dev-secret-change-me';
}

// Helper to check user/admin status (MongoDB version)
async function checkAccountStatus(id, isAdmin) {
  try {
    const collection = isAdmin ? 'admins' : 'users';
    const database = await db.db.connect();
    
    const result = await database.collection(collection).findOne({
      _id: new ObjectId(id)
    });
    
    if (!result) {
      throw new Error('Account not found');
    }
    
    if (result.status === 'locked') {
      throw new Error('Account is locked');
    }
    
    if (result.status === 'inactive') {
      throw new Error('Account is inactive');
    }
    
    return result;
  } catch (err) {
    throw new Error(err.message || 'Error checking account status');
  }
}

// Express middleware to authenticate Bearer token in Authorization header
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, getSecret());
    
    // Check if account is still active
    await checkAccountStatus(payload.sub, payload.role === 'admin');
    
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (err.message === 'Account is locked' || err.message === 'Account is inactive') {
      return res.status(403).json({ error: err.message });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  authenticateToken,
};
