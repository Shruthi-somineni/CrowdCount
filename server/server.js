require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const { DatabaseError } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ============================
// Serve Static Files
// ============================
// Serve all static files (HTML, CSS, JS, images) from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Serve login.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Serve dashboard at /dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

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

// ============================
// Health Check Endpoint
// ============================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Auth server is running',
    timestamp: new Date().toISOString()
  });
});

// ============================
// Authentication Endpoints
// ============================

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  try {
    const user = await db.getUserByUsernameOrEmail(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    console.log('✅ User found:', { id: user._id, username: user.username, email: user.email });
    
    // Check account status
    if (user.status === 'locked') {
      return res.status(403).json({ error: 'Account locked. Please contact support.' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account inactive. Please verify your email.' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await db.updateLoginAttempt('users', user._id, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Reset login attempts on successful login
    await db.updateLoginAttempt('users', user._id, true);

    // Generate access token (use _id for MongoDB)
    const accessToken = jwt.sign(
      { sub: user._id.toString(), name: user.name, username: user.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days from now
    const refreshToken = await db.createRefreshToken(user._id, null, refreshTokenExpiry);

    console.log('✅ Login successful for:', user.username);

    res.json({ 
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    if (err instanceof DatabaseError) {
      if (err.code === 'ACCOUNT_LOCKED') {
        return res.status(403).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Signup endpoint (alias for register - frontend uses this name)
app.post('/api/signup', async (req, res) => {
  const { username, password, name, email } = req.body;
  try {
    // Validate required fields
    if (!username || !password || !email) {
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
    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    // Create new user
    const newUser = await db.createUser({ 
      username, 
      password, 
      name: name || username, 
      email 
    });

    console.log('✅ User created successfully:', { 
      id: newUser.id, 
      username: newUser.username, 
      email: newUser.email 
    });

    // Generate access token (same as login)
    const accessToken = jwt.sign(
      { 
        sub: newUser.id.toString(), 
        name: newUser.name, 
        username: newUser.username,
        email: newUser.email 
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token (same as login)
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days from now
    const refreshToken = await db.createRefreshToken(newUser.id, null, refreshTokenExpiry);

    console.log('✅ Tokens generated for new user:', { 
      accessToken: '✓', 
      refreshToken: '✓',
      expiresIn: ACCESS_TOKEN_EXPIRY 
    });

    res.json({ 
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      message: 'Signup successful'
    });
  } catch (err) {
    console.error('❌ Register error:', err);
    // Handle MongoDB duplicate key errors
    if (err.code === 11000 || (err.message && err.message.includes('duplicate'))) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    if (err instanceof DatabaseError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Register endpoint (alias for signup - for backward compatibility)
app.post('/api/register', (req, res) => {
  // Forward to signup endpoint
  req.app._router.stack.find(r => r.route && r.route.path === '/api/signup').route.stack[0].handle(req, res);
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
    
    console.log('✅ Admin found:', { id: admin._id, username: admin.username });
    
    // Check account status
    if (admin.status === 'locked') {
      return res.status(403).json({ error: 'Account locked. Please contact support.' });
    }
    if (admin.status === 'inactive') {
      return res.status(403).json({ error: 'Account inactive' });
    }
    
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      await db.updateLoginAttempt('admins', admin._id, false);
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    // Reset login attempts on successful login
    await db.updateLoginAttempt('admins', admin._id, true);

    // Generate access token (use _id for MongoDB)
    const accessToken = jwt.sign(
      { 
        sub: admin._id.toString(), 
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
    const refreshToken = await db.createRefreshToken(null, admin._id, refreshTokenExpiry);

    console.log('✅ Admin login successful for:', admin.username);

    res.json({ 
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error('❌ Admin login error:', err);
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

// Admin middleware to verify admin role
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin endpoint: Get all users
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    console.log(`✅ Admin fetched ${users.length} users`);
    res.json({ users, total: users.length });
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin endpoint: Delete user
app.delete('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.deleteUser(userId);
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`✅ Admin deleted user: ${userId}`);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
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
