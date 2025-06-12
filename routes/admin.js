const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Middleware to check admin privileges
async function requireAdmin(req, res, next) {
  try {
    const [user] = await db.execute(
      'SELECT is_admin FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (user.length === 0 || !user[0].is_admin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Authorization check failed' });
  }
}

// Get admin dashboard stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get various statistics
    const [userStats] = await db.execute('SELECT COUNT(*) as total_users FROM users');
    const [caseStats] = await db.execute('SELECT COUNT(*) as total_cases, SUM(total_opened) as total_opened FROM cases');
    const [revenueStats] = await db.execute(`
      SELECT 
        SUM(CASE WHEN type = 'case_opening' THEN ABS(amount) ELSE 0 END) as total_case_revenue,
        SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
        SUM(CASE WHEN type = 'withdrawal' THEN ABS(amount) ELSE 0 END) as total_withdrawals
      FROM transactions
    `);
    
    const [bankStats] = await db.execute('SELECT SUM(bank_balance) as total_bank FROM cases');
    
    res.json({
      success: true,
      stats: {
        totalUsers: userStats[0].total_users,
        totalCases: caseStats[0].total_cases,
        totalOpened: caseStats[0].total_opened || 0,
        totalCaseRevenue: revenueStats[0].total_case_revenue || 0,
        totalDeposits: revenueStats[0].total_deposits || 0,
        totalWithdrawals: revenueStats[0].total_withdrawals || 0,
        totalBank: bankStats[0].total_bank || 0
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
});

// Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const [users] = await db.execute(`
      SELECT id, steam_id, username, avatar, balance, level, experience, 
             is_admin, is_banned, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const [totalCount] = await db.execute('SELECT COUNT(*) as count FROM users');
    
    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
});

// Update user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { balance, is_admin, is_banned } = req.body;
    
    await db.execute(
      'UPDATE users SET balance = ?, is_admin = ?, is_banned = ? WHERE id = ?',
      [balance, is_admin, is_banned, id]
    );
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Get all cases for admin
router.get('/cases', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [cases] = await db.execute(`
      SELECT c.*, COUNT(co.id) as total_opened, SUM(co.profit_loss) as total_profit_loss
      FROM cases c
      LEFT JOIN case_openings co ON c.id = co.case_id
      GROUP BY c.id
      ORDER BY c.sort_order, c.id
    `);
    
    res.json({ success: true, cases });
  } catch (error) {
    console.error('Admin cases error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cases' });
  }
});

// Create new case
router.post('/cases', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, image } = req.body;
    
    const [result] = await db.execute(
      'INSERT INTO cases (name, description, price, image) VALUES (?, ?, ?, ?)',
      [name, description, price, image]
    );
    
    res.json({ success: true, caseId: result.insertId });
  } catch (error) {
    console.error('Admin create case error:', error);
    res.status(500).json({ success: false, message: 'Failed to create case' });
  }
});

// Update case
router.put('/cases/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, image, is_active, bank_balance } = req.body;
    
    await db.execute(
      'UPDATE cases SET name = ?, description = ?, price = ?, image = ?, is_active = ?, bank_balance = ? WHERE id = ?',
      [name, description, price, image, is_active, bank_balance, id]
    );
    
    res.json({ success: true, message: 'Case updated successfully' });
  } catch (error) {
    console.error('Admin update case error:', error);
    res.status(500).json({ success: false, message: 'Failed to update case' });
  }
});

// Get all items
router.get('/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [items] = await db.execute(`
      SELECT i.*, COUNT(ui.id) as owned_count
      FROM items i
      LEFT JOIN user_inventory ui ON i.id = ui.item_id
      GROUP BY i.id
      ORDER BY i.price DESC
    `);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Admin items error:', error);
    res.status(500).json({ success: false, message: 'Failed to get items' });
  }
});

// Create new item
router.post('/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, market_name, icon_url, rarity, quality, price, float_min, float_max } = req.body;
    
    const [result] = await db.execute(
      'INSERT INTO items (name, market_name, icon_url, rarity, quality, price, float_min, float_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, market_name, icon_url, rarity, quality, price, float_min || 0, float_max || 1]
    );
    
    res.json({ success: true, itemId: result.insertId });
  } catch (error) {
    console.error('Admin create item error:', error);
    res.status(500).json({ success: false, message: 'Failed to create item' });
  }
});

// Update item
router.put('/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, market_name, icon_url, rarity, quality, price, float_min, float_max, is_active } = req.body;
    
    await db.execute(
      'UPDATE items SET name = ?, market_name = ?, icon_url = ?, rarity = ?, quality = ?, price = ?, float_min = ?, float_max = ?, is_active = ? WHERE id = ?',
      [name, market_name, icon_url, rarity, quality, price, float_min, float_max, is_active, id]
    );
    
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Admin update item error:', error);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
});

// Get recent transactions
router.get('/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [transactions] = await db.execute(`
      SELECT t.*, u.username
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 100
    `);
    
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get transactions' });
  }
});

module.exports = router;