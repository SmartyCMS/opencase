const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// Steam OpenID authentication (simplified)
router.post('/steam', async (req, res) => {
  try {
    const { steamId, username, avatar } = req.body;
    
    // Check if user exists
    const [existingUser] = await db.execute(
      'SELECT * FROM users WHERE steam_id = ?',
      [steamId]
    );
    
    let user;
    if (existingUser.length > 0) {
      // Update existing user
      await db.execute(
        'UPDATE users SET username = ?, avatar = ?, updated_at = NOW() WHERE steam_id = ?',
        [username, avatar, steamId]
      );
      user = existingUser[0];
    } else {
      // Create new user
      const [result] = await db.execute(
        'INSERT INTO users (steam_id, username, avatar) VALUES (?, ?, ?)',
        [steamId, username, avatar]
      );
      
      const [newUser] = await db.execute(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );
      user = newUser[0];
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, steamId: user.steam_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        balance: user.balance,
        level: user.level,
        experience: user.experience
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [user] = await db.execute(
      'SELECT id, steam_id, username, avatar, balance, level, experience, trade_url FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user: user[0] });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

// Update trade URL
router.post('/trade-url', authenticateToken, async (req, res) => {
  try {
    const { tradeUrl } = req.body;
    
    // Basic trade URL validation
    if (!tradeUrl || !tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
      return res.status(400).json({ success: false, message: 'Invalid trade URL' });
    }
    
    await db.execute(
      'UPDATE users SET trade_url = ? WHERE id = ?',
      [tradeUrl, req.user.userId]
    );
    
    res.json({ success: true, message: 'Trade URL updated successfully' });
  } catch (error) {
    console.error('Trade URL error:', error);
    res.status(500).json({ success: false, message: 'Failed to update trade URL' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;