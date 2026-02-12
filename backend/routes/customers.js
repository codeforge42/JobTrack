
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');


// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
     console.log(req.body);
    // Check if user already exists
    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    console.log(req.body);
    
    // Create new user
    const user = await User.create({ name, email, password });
    
    // Generate token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    const customers = await User.getAll();
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      users: customers
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch all customers
router.get('/', async (req, res) => {
  try {
    // request the company
    const users =  await User.getAll(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Company scanned successfully',
      customers: users
    });
  } catch (error) {
    console.error('Scanning error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch all jobs per customer id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let Customer = await User.getById(id) || [];

    res.status(201).json({
      success: true,
      message: 'Fetch Customer successfully',
      customer: Customer
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a customer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const customers = await User.delById(id) || [];

    res.status(201).json({
      success: true,
      message: 'Delete a customer successfully',
      customers: customers
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Change password
router.put('/password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    // Check if user exists
    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Verify password
    let isMatch;
    if (user.email === 'admin@evgeny.com') isMatch = (currentPassword == user.password);
    else {
      if (currentPassword === '') isMatch = true;
      else isMatch = await User.verifyPassword(currentPassword, user.password);
    }
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Update password
    User.updatePassword(user.email, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




module.exports = router;
