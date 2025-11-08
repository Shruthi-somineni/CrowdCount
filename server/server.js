require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { DatabaseError } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'; // prefer env
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh-secret-change-me'; // prefer env
const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d'; // Long-lived refresh token

const bcrypt = require('bcryptjs');
const { authenticateToken } = require('./middleware/auth');

// Use SQLite DB instead of in-memory arrays
const db = require('./db');

// Initialize DB before starting server (creates tables and seeds admin)
// Initialize DB then start server
db.init().then(() => {
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set. Using default insecure secret. Set JWT_SECRET in .env for production.');
  }
  app.listen(PORT, () => console.log(`Auth server running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('DB initialization failed', err);
  process.exit(1);
});

// Helper for input validation
const validateEmail = (email) => {
  return email && email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  try {
    const user = await db.getUserByUsernameOrEmail(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Check account status
    if (user.status === 'locked') {
      return res.status(403).json({ error: 'Account locked. Please contact support.' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account inactive. Please verify your email.' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await db.updateLoginAttempt('users', user.id, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Reset login attempts on successful login
    await db.updateLoginAttempt('users', user.id, true);

    // Generate access token
    const accessToken = jwt.sign(
      { sub: user.id, name: user.name, username: user.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days from now
    const refreshToken = await db.createRefreshToken(user.id, null, refreshTokenExpiry);

    res.json({ 
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error('Login error', err);
    if (err instanceof DatabaseError) {
      if (err.code === 'ACCOUNT_LOCKED') {
        return res.status(403).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Register endpoint (dev only - in-memory users)
app.post('/api/register', async (req, res) => {
  const { username, password, name, email } = req.body;
  try {
    // Validate required fields
    if (!username || !password || !name || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username or email already exists
    const existingUser = await db.getUserByUsernameOrEmail(username);
    if (existingUser && (existingUser.username.toLowerCase() === username.toLowerCase() || existingUser.email.toLowerCase() === email.toLowerCase())) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ error: 'Username already exists' });
      } else {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    const newUser = await db.createUser({ username, password, name, email });

    // Generate token
    const token = jwt.sign({ 
      sub: newUser.id, 
      name: newUser.name, 
      username: newUser.username,
      email: newUser.email 
    }, JWT_SECRET, { expiresIn: '2h' });
    
    res.json({ token });
  } catch (err) {
    console.error('Register error', err);
    // Handle unique constraint errors
    if (err && err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ ok: true, payload });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Protected route example: use Authorization: Bearer <token>
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Admin login endpoint
app.post('/api/admin-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  try {
    const admin = await db.getAdminByUsername(username);
    if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });
    
    // Check account status
    if (admin.status === 'locked') {
      return res.status(403).json({ error: 'Account locked. Please contact support.' });
    }
    if (admin.status === 'inactive') {
      return res.status(403).json({ error: 'Account inactive' });
    }
    
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      await db.updateLoginAttempt('admins', admin.id, false);
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    // Reset login attempts on successful login
    await db.updateLoginAttempt('admins', admin.id, true);

    // Generate access token
    const accessToken = jwt.sign(
      { 
        sub: admin.id, 
        name: admin.name, 
        username: admin.username,
        role: 'admin'
      }, 
      JWT_SECRET, 
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days from now
    const refreshToken = await db.createRefreshToken(null, admin.id, refreshTokenExpiry);

    res.json({ 
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error('Admin login error', err);
    if (err instanceof DatabaseError) {
      if (err.code === 'ACCOUNT_LOCKED') {
        return res.status(403).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify admin token
app.post('/api/verify-admin', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Not an admin token' });
    }
    res.json({ ok: true, payload });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Refresh token endpoint
app.post('/api/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    const tokenInfo = await db.validateRefreshToken(refreshToken);
    if (!tokenInfo) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const tokenPayload = {
      sub: tokenInfo.user_id || tokenInfo.admin_id,
      username: tokenInfo.user_username || tokenInfo.admin_username
    };

    if (tokenInfo.admin_id) {
      tokenPayload.role = 'admin';
    }

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    res.json({
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error('Refresh token error', err);
    if (err instanceof DatabaseError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    await db.deleteRefreshToken(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error', err);
    if (err instanceof DatabaseError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Cleanup expired tokens periodically (every hour)
setInterval(async () => {
  try {
    await db.cleanupExpiredTokens();
  } catch (err) {
    console.error('Token cleanup error:', err);
  }
}, 60 * 60 * 1000);

// (server started after DB init above)
