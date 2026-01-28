require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./middleware/auth');

// Fix Mongoose deprecation warnings
mongoose.set('strictQuery', false);

const app = express();

// CORS configuration
app.use(cors({
  origin: ['https://multical-c.vercel.app', 'http://localhost:5173'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'MultiCalc Backend Server is running successfully! 🚀',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    database: mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is healthy',
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Check if MONGODB_URI is defined
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI environment variable is not defined');
  console.log('Please set MONGODB_URI in your environment variables');
} else {
  console.log('✅ MONGODB_URI found, attempting connection...');

  // Connect to MongoDB with better error handling
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  })
    .then(() => {
      console.log('✅ Connected to MongoDB successfully');
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      console.log('⚠️  Server will continue running without database connection');
      console.log('💡 Please check your MONGODB_URI environment variable');
    });

  // Handle MongoDB connection events
  mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
}

// USER COLLECTION SCHEMA DEFINITION
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, {
  timestamps: true
});

// THIS LINE DEFINES THE USER MODEL - COLLECTION WILL BE NAMED 'users'
const User = mongoose.model('User', userSchema);

// Middleware to check database connection
const checkDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({
      success: false,
      message: 'Database connection unavailable. Please try again later.'
    });
  }
  next();
};

// Auth Routes
app.post('/api/auth/signup', checkDbConnection, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.json({ success: false, message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user - THIS CREATES THE 'users' COLLECTION IN MONGODB
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    console.log(`✅ New user created: ${username}`);
    res.json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.json({ success: false, message: 'Error creating user' });
  }
});

app.post('/api/auth/login', checkDbConnection, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.json({ success: false, message: 'Username and password are required' });
    }

    // Find user in the 'users' collection
    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    // Create JWT token (expires in 2 hours)
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '2h' }
    );

    // Set httpOnly cookie (more secure than localStorage)
    res.cookie('authToken', token, {
      httpOnly: true,  // Cannot be accessed by JavaScript (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    console.log(`✅ User logged in: ${username}`);
    res.json({ success: true, message: 'Login successful', token }); // Also send token for backwards compatibility
  } catch (error) {
    console.error('❌ Login error:', error);
    res.json({ success: false, message: 'Error logging in' });
  }
});

// Token verification endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Token is valid',
    user: {
      userId: req.user.userId,
      username: req.user.username
    }
  });
});

// Logout endpoint to clear cookie
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Catch all for undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/signup',
      'POST /api/auth/login',
      'GET /api/auth/verify'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: https://multical-c.vercel.app`);
  console.log(`🔗 Server URL: https://multical-c-backend.onrender.com`);

  if (!mongoUri) {
    console.log('⚠️  Warning: Running without database connection');
    console.log('💡 Set MONGODB_URI environment variable to enable database features');
  }
});