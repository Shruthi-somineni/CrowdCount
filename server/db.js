const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

// MongoDB URI - Replace with your connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shruthisomineni_db_user:kwanjiah%401434@cluster0.3l7l1eg.mongodb.net/?retryWrites=true&w=majority';
const DB_NAME = process.env.DB_NAME || 'crowd_counting_db';

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.connected = false;
  }

  async connect() {
    try {
      if (this.connected && this.db) {
        return this.db;
      }

      this.client = new MongoClient(MONGO_URI);

      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.connected = true;

      console.log('✅ MongoDB connected:', DB_NAME);
      return this.db;
    } catch (err) {
      console.error('❌ MongoDB connection error:', err.message);
      throw err;
    }
  }

  async init() {
    try {
      const db = await this.connect();

      // Create collections if they don't exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);

      // Users collection
      if (!collectionNames.includes('users')) {
        await db.createCollection('users');
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        console.log('✅ Created users collection');
      }

      // Admins collection
      if (!collectionNames.includes('admins')) {
        await db.createCollection('admins');
        await db.collection('admins').createIndex({ username: 1 }, { unique: true });
        console.log('✅ Created admins collection');
      }

      // Refresh tokens collection
      if (!collectionNames.includes('refresh_tokens')) {
        await db.createCollection('refresh_tokens');
        await db.collection('refresh_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        console.log('✅ Created refresh_tokens collection');
      }

      // Seed default user if it doesn't exist
      const defaultUser = await db.collection('users').findOne({ username: 'testuser' });
      if (!defaultUser) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await db.collection('users').insertOne({
          username: 'testuser',
          email: 'testuser@example.com',
          password: hashedPassword,
          name: 'Test User',
          status: 'active',
          login_attempts: 0,
          created_at: new Date(),
        });
        console.log('✅ Seeded default test user (testuser / password123)');
      }

      // Seed default admin if it doesn't exist
      const defaultAdmin = await db.collection('admins').findOne({ username: 'admin' });
      if (!defaultAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.collection('admins').insertOne({
          username: 'admin',
          email: 'admin@example.com',
          password: hashedPassword,
          name: 'Admin User',
          status: 'active',
          login_attempts: 0,
          created_at: new Date(),
        });
        console.log('✅ Seeded default admin (admin / admin123)');
      }

      return true;
    } catch (err) {
      console.error('❌ Initialization error:', err);
      throw err;
    }
  }

  async getUserByUsernameOrEmail(usernameOrEmail) {
    try {
      const db = await this.connect();
      const user = await db.collection('users').findOne({
        $or: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ]
      });
      return user;
    } catch (err) {
      throw new DatabaseError('Error fetching user', 'DB_ERROR');
    }
  }

  async getAdminByUsername(username) {
    try {
      const db = await this.connect();
      const admin = await db.collection('admins').findOne({ username });
      return admin;
    } catch (err) {
      throw new DatabaseError('Error fetching admin', 'DB_ERROR');
    }
  }

  async createUser(userData) {
    try {
      const db = await this.connect();
      const { username, email, password, name } = userData;

      // Check if user exists (case-insensitive)
      const existing = await db.collection('users').findOne({
        $or: [
          { username: { $regex: new RegExp(`^${username}$`, 'i') } },
          { email: { $regex: new RegExp(`^${email}$`, 'i') } }
        ]
      });

      if (existing) {
        if (existing.username.toLowerCase() === username.toLowerCase()) {
          throw new DatabaseError('Username already exists', 'USER_EXISTS');
        }
        if (existing.email.toLowerCase() === email.toLowerCase()) {
          throw new DatabaseError('Email already registered', 'EMAIL_EXISTS');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      const result = await db.collection('users').insertOne({
        username,
        email,
        password: hashedPassword,
        name: name || username,
        status: 'active',
        login_attempts: 0,
        created_at: new Date(),
      });

      console.log('✅ MongoDB insert result:', { insertedId: result.insertedId });

      return {
        id: result.insertedId,
        username,
        email,
        name: name || username,
        status: 'active'
      };
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      // Handle MongoDB duplicate key errors
      if (err.code === 11000) {
        throw new DatabaseError('Username or email already exists', 'DUPLICATE_KEY');
      }
      throw new DatabaseError('Error creating user: ' + err.message, 'DB_ERROR');
    }
  }

  async createRefreshToken(userId, adminId, expiresAt) {
    try {
      const db = await this.connect();
      const token = require('crypto').randomBytes(32).toString('hex');

      await db.collection('refresh_tokens').insertOne({
        token,
        user_id: userId ? new ObjectId(userId) : null,
        admin_id: adminId ? new ObjectId(adminId) : null,
        expiresAt: new Date(expiresAt),
        created_at: new Date(),
      });

      return token;
    } catch (err) {
      throw new DatabaseError('Error creating refresh token', 'DB_ERROR');
    }
  }

  async validateRefreshToken(token) {
    try {
      const db = await this.connect();
      const tokenDoc = await db.collection('refresh_tokens').findOne({ token });

      if (!tokenDoc) {
        throw new DatabaseError('Invalid refresh token', 'INVALID_TOKEN');
      }

      // Check expiry
      if (new Date() > tokenDoc.expiresAt) {
        throw new DatabaseError('Refresh token expired', 'TOKEN_EXPIRED');
      }

      // Get user or admin details
      if (tokenDoc.user_id) {
        const user = await db.collection('users').findOne({ _id: tokenDoc.user_id });
        return {
          user_id: tokenDoc.user_id,
          user_username: user?.username,
          user_email: user?.email,
        };
      } else if (tokenDoc.admin_id) {
        const admin = await db.collection('admins').findOne({ _id: tokenDoc.admin_id });
        return {
          admin_id: tokenDoc.admin_id,
          admin_username: admin?.username,
          admin_email: admin?.email,
        };
      }

      throw new DatabaseError('Invalid token owner', 'INVALID_TOKEN');
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError('Error validating refresh token', 'DB_ERROR');
    }
  }

  async deleteRefreshToken(token) {
    try {
      const db = await this.connect();
      const result = await db.collection('refresh_tokens').deleteOne({ token });
      return result.deletedCount > 0;
    } catch (err) {
      throw new DatabaseError('Error deleting refresh token', 'DB_ERROR');
    }
  }

  async cleanupExpiredTokens() {
    try {
      const db = await this.connect();
      await db.collection('refresh_tokens').deleteMany({
        expiresAt: { $lt: new Date() }
      });
      console.log('✅ Cleaned up expired tokens');
    } catch (err) {
      console.error('❌ Error cleaning up tokens:', err);
    }
  }

  async updateLoginAttempt(collection, userId, success) {
    try {
      const db = await this.connect();

      if (success) {
        // Reset login attempts on successful login
        await db.collection(collection).updateOne(
          { _id: new ObjectId(userId) },
          { $set: { login_attempts: 0 } }
        );
      } else {
        // Increment login attempts on failure
        const user = await db.collection(collection).findOne({ _id: new ObjectId(userId) });
        const attempts = (user?.login_attempts || 0) + 1;

        if (attempts >= 5) {
          // Lock account after 5 failed attempts
          await db.collection(collection).updateOne(
            { _id: new ObjectId(userId) },
            { $set: { login_attempts: attempts, status: 'locked' } }
          );
          throw new DatabaseError('Account locked after too many failed login attempts', 'ACCOUNT_LOCKED');
        } else {
          await db.collection(collection).updateOne(
            { _id: new ObjectId(userId) },
            { $set: { login_attempts: attempts } }
          );
        }
      }
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError('Error updating login attempts', 'DB_ERROR');
    }
  }

  async getAllUsers() {
    try {
      const db = await this.connect();
      const users = await db.collection('users').find({}, {
        projection: { password: 0 } // Exclude password field
      }).toArray();
      
      // Convert ObjectId to string for JSON serialization
      return users.map(user => ({
        ...user,
        _id: user._id.toString()
      }));
    } catch (err) {
      throw new DatabaseError('Error fetching users', 'DB_ERROR');
    }
  }

  async deleteUser(userId) {
    try {
      const db = await this.connect();
      const result = await db.collection('users').deleteOne({ 
        _id: new ObjectId(userId) 
      });
      return result.deletedCount > 0;
    } catch (err) {
      throw new DatabaseError('Error deleting user', 'DB_ERROR');
    }
  }

  async close() {
    try {
      if (this.client) {
        await this.client.close();
        this.connected = false;
        console.log('✅ MongoDB connection closed');
      }
    } catch (err) {
      console.error('❌ Error closing MongoDB connection:', err);
    }
  }
}

class DatabaseError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Create singleton instance
const database = new Database();

module.exports = {
  db: database,
  init: () => database.init(),
  getUserByUsernameOrEmail: (usernameOrEmail) => database.getUserByUsernameOrEmail(usernameOrEmail),
  getAdminByUsername: (username) => database.getAdminByUsername(username),
  createUser: (userData) => database.createUser(userData),
  createRefreshToken: (userId, adminId, expiresAt) => database.createRefreshToken(userId, adminId, expiresAt),
  validateRefreshToken: (token) => database.validateRefreshToken(token),
  deleteRefreshToken: (token) => database.deleteRefreshToken(token),
  cleanupExpiredTokens: () => database.cleanupExpiredTokens(),
  updateLoginAttempt: (collection, userId, success) => database.updateLoginAttempt(collection, userId, success),
  getAllUsers: () => database.getAllUsers(),
  deleteUser: (userId) => database.deleteUser(userId),
  DatabaseError,
  close: () => database.close(),
};
