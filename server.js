require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Fix Mongoose deprecation warnings
mongoose.set('strictQuery', false);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Check if MONGODB_URI is defined
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI environment variable is not defined');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    console.log('Database Name:', mongoose.connection.name);
    console.log('Connection State:', mongoose.connection.readyState);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.error('Connection String (masked):', mongoUri.replace(/\/\/.*@/, '//***:***@'));
  });

// MongoDB connection event listeners
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔒 MongoDB connection closed through app termination');
  process.exit(0);
});

// USER COLLECTION SCHEMA DEFINITION
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// THIS LINE DEFINES THE USER MODEL - COLLECTION WILL BE NAMED 'users'
const User = mongoose.model('User', userSchema);

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
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
    
    res.json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.json({ success: false, message: 'Error creating user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
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
    
    // Create JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ success: true, message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Error logging in' });
  }
});

// Root route - this will handle https://multical-c-backend.onrender.com/
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'MultiCalc Backend Server is Running! 🚀',
    status: 'Active',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      signup: '/api/auth/signup',
      login: '/api/auth/login'
    },
    timestamp: new Date().toISOString()
  });
});

// API Health check route
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  res.status(200).json({
    status: 'OK',
    message: 'MultiCalc Backend API is healthy',
    database: {
      status: dbStatus[dbState] || 'Unknown',
      state: dbState,
      name: mongoose.connection.name || 'Not connected',
      host: mongoose.connection.host || 'Not connected'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this server`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/signup',
      'POST /api/auth/login'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on the server'
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
