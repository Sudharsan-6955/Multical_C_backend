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

// CORS configuration
app.use(cors({
  origin: ['https://multical-c.vercel.app', 'http://localhost:5173'],
  credentials: true
}));

app.use(bodyParser.json());

// Global database status
let dbStatus = 'Disconnected ❌';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MultiCalc Backend Server is running successfully! 🚀',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is healthy',
    uptime: process.uptime(),
    database: dbStatus
  });
});

// Check if MONGODB_URI is defined and properly formatted
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI environment variable is not defined');
  console.log('💡 Please set MONGODB_URI in your Render environment variables');
  console.log('📝 Format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
} else if (!mongoUri.includes('mongodb')) {
  console.error('❌ Invalid MONGODB_URI format detected');
  console.log('📝 Expected format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
} else {
  console.log('✅ MONGODB_URI found, attempting connection...');
  
  // MongoDB connection function with retry logic
  const connectToMongoDB = async (retryCount = 0) => {
    try {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4, skip trying IPv6
        maxPoolSize: 10,
        bufferMaxEntries: 0
      });
      
      console.log('✅ Connected to MongoDB successfully');
      dbStatus = 'Connected ✅';
      
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${retryCount + 1} failed:`, err.message);
      dbStatus = 'Disconnected ❌';
      
      // Retry connection up to 3 times
      if (retryCount < 3) {
        console.log(`🔄 Retrying connection in ${(retryCount + 1) * 5} seconds...`);
        setTimeout(() => connectToMongoDB(retryCount + 1), (retryCount + 1) * 5000);
      } else {
        console.log('⚠️  Max retry attempts reached. Server will continue without database.');
        console.log('💡 Please check your MongoDB connection string and network connectivity');
        console.log('🔗 MongoDB Atlas: https://cloud.mongodb.com/');
      }
    }
  };

  // Initial connection attempt
  connectToMongoDB();

  // Handle MongoDB connection events
  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected');
    dbStatus = 'Connected ✅';
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB disconnected');
    dbStatus = 'Disconnected ❌';
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
    dbStatus = 'Error ⚠️';
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
    dbStatus = 'Connected ✅';
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
      message: 'Database connection unavailable. Please check your MongoDB connection and try again later.',
      hint: 'The server is running but database is not connected. Contact administrator.'
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
    
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '24h' }
    );
    
    console.log(`✅ User logged in: ${username}`);
    res.json({ success: true, message: 'Login successful', token });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.json({ success: false, message: 'Error logging in' });
  }
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
      'POST /api/auth/login'
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
  console.log(`💾 Database Status: ${dbStatus}`);
  
  if (!mongoUri) {
    console.log('⚠️  Warning: Running without database connection');
    console.log('💡 Set MONGODB_URI environment variable to enable database features');
    console.log('🔧 Go to Render Dashboard > Environment > Add MONGODB_URI');
  }
});
