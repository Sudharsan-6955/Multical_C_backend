const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Authentication service is running',
    timestamp: new Date().toISOString()
  });
});

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = new User({ username, password });
    await user.save();
    res.status(201).json({ 
      message: 'User created successfully',
      username: user.username 
    });
  } catch (err) {
    res.status(400).json({ error: 'Error creating user', details: err.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ 
      token,
      message: 'Login successful',
      username: user.username
    });
  } catch (err) {
    res.status(400).json({ error: 'Error logging in', details: err.message });
  }
});

module.exports = router;
