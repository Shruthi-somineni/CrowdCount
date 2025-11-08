const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret-change-me', { 
    expiresIn: '15m'  // Short lived access token
  });
}

function getTokenExpiration(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

module.exports = {
  generateRefreshToken,
  generateAccessToken,
  getTokenExpiration
};