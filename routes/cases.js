const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get all active cases
router.get('/', async (req, res) => {
  try {
    const [cases] = await db.execute(`
      SELECT c.*, 
             COUNT(co.id) as total_opened,
             AVG(co.item_value) as avg_value
      FROM cases c
      LEFT JOIN case_openings co ON c.id = co.case_id
      WHERE c.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.sort_order, c.id
    `);
    
    res.json({ success: true, cases });
  } catch (error) {
    console.error('Cases error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cases' });
  }
});

// Get case details with items
router.get('/:id', async (req, res) => {
  try {
    const caseId = req.params.id;
    
    // Get case info
    const [caseInfo] = await db.execute(
      'SELECT * FROM cases WHERE id = ? AND is_active = TRUE',
      [caseId]
    );
    
    if (caseInfo.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    
    // Get case items with drop chances
    const [items] = await db.execute(`
      SELECT i.*, ci.drop_chance
      FROM items i
      JOIN case_items ci ON i.id = ci.item_id
      WHERE ci.case_id = ? AND i.is_active = TRUE
      ORDER BY ci.drop_chance ASC
    `, [caseId]);
    
    // Get recent openings for this case
    const [recentOpenings] = await db.execute(`
      SELECT co.*, u.username, u.avatar, i.name as item_name, i.rarity, i.icon_url
      FROM case_openings co
      JOIN users u ON co.user_id = u.id
      JOIN items i ON co.item_id = i.id
      WHERE co.case_id = ?
      ORDER BY co.opened_at DESC
      LIMIT 20
    `, [caseId]);
    
    res.json({
      success: true,
      case: caseInfo[0],
      items,
      recentOpenings
    });
  } catch (error) {
    console.error('Case details error:', error);
    res.status(500).json({ success: false, message: 'Failed to get case details' });
  }
});

module.exports = router;