const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get upgrade options for an item
router.get('/options/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Get the source item
    const [sourceItem] = await db.execute(
      'SELECT * FROM items WHERE id = ?',
      [itemId]
    );
    
    if (sourceItem.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    const source = sourceItem[0];
    
    // Get potential upgrade targets (items worth more than source)
    const [upgradeTargets] = await db.execute(`
      SELECT *, 
             ROUND((? / price) * 100, 2) as success_chance
      FROM items 
      WHERE price > ? AND price <= ? * 10 AND is_active = TRUE
      ORDER BY price ASC
    `, [source.price, source.price, source.price]);
    
    res.json({
      success: true,
      sourceItem: source,
      upgradeTargets
    });
  } catch (error) {
    console.error('Upgrade options error:', error);
    res.status(500).json({ success: false, message: 'Failed to get upgrade options' });
  }
});

// Perform upgrade
router.post('/perform', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { inventoryItemId, targetItemId } = req.body;
    const userId = req.user.userId;
    
    // Get source item from inventory
    const [inventoryItem] = await connection.execute(`
      SELECT ui.*, i.price as source_price, i.name as source_name
      FROM user_inventory ui
      JOIN items i ON ui.item_id = i.id
      WHERE ui.id = ? AND ui.user_id = ?
    `, [inventoryItemId, userId]);
    
    if (inventoryItem.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Source item not found' });
    }
    
    // Get target item
    const [targetItem] = await connection.execute(
      'SELECT * FROM items WHERE id = ?',
      [targetItemId]
    );
    
    if (targetItem.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Target item not found' });
    }
    
    const source = inventoryItem[0];
    const target = targetItem[0];
    
    // Calculate success chance
    const successChance = Math.min((source.source_price / target.price) * 100, 95);
    
    // Validate upgrade
    if (target.price <= source.source_price) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Target item must be more valuable' });
    }
    
    if (target.price > source.source_price * 10) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Target item too expensive for upgrade' });
    }
    
    // Determine if upgrade succeeds
    const random = Math.random() * 100;
    const success = random <= successChance;
    
    // Remove source item from inventory
    await connection.execute(
      'DELETE FROM user_inventory WHERE id = ?',
      [inventoryItemId]
    );
    
    let resultItem = null;
    let profitLoss = -source.source_price;
    
    if (success) {
      // Add target item to inventory
      await connection.execute(
        'INSERT INTO user_inventory (user_id, item_id, float_value, acquired_from) VALUES (?, ?, ?, ?)',
        [userId, targetItemId, generateFloat(target.float_min, target.float_max), 'upgrade']
      );
      
      resultItem = target;
      profitLoss = target.price - source.source_price;
      
      // Add to live feed for successful upgrades
      await connection.execute(
        'INSERT INTO live_feed (user_id, action_type, item_id, value) VALUES (?, ?, ?, ?)',
        [userId, 'upgrade_success', targetItemId, target.price]
      );
    } else {
      // Add to live feed for failed upgrades
      await connection.execute(
        'INSERT INTO live_feed (user_id, action_type, value) VALUES (?, ?, ?)',
        [userId, 'upgrade_fail', source.source_price]
      );
    }
    
    // Record upgrade attempt
    await connection.execute(
      'INSERT INTO upgrades (user_id, from_item_id, to_item_id, success, chance, profit_loss) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, source.item_id, targetItemId, success, successChance, profitLoss]
    );
    
    await connection.commit();
    
    // Emit to live feed
    const io = req.app.get('io');
    const [userInfo] = await connection.execute(
      'SELECT username, avatar FROM users WHERE id = ?',
      [userId]
    );
    
    io.emit('live-feed', {
      type: success ? 'upgrade_success' : 'upgrade_fail',
      user: userInfo[0],
      sourceItem: { name: source.source_name, price: source.source_price },
      targetItem: success ? target : null,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      upgradeSuccess: success,
      resultItem,
      successChance,
      profitLoss
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Upgrade error:', error);
    res.status(500).json({ success: false, message: 'Failed to perform upgrade' });
  } finally {
    connection.release();
  }
});

// Get upgrade history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const [history] = await db.execute(`
      SELECT u.*, 
             fi.name as from_item_name, fi.price as from_item_price, fi.icon_url as from_item_icon,
             ti.name as to_item_name, ti.price as to_item_price, ti.icon_url as to_item_icon
      FROM upgrades u
      JOIN items fi ON u.from_item_id = fi.id
      JOIN items ti ON u.to_item_id = ti.id
      WHERE u.user_id = ?
      ORDER BY u.created_at DESC
      LIMIT 50
    `, [req.user.userId]);
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('Upgrade history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get upgrade history' });
  }
});

// Helper function to generate random float value
function generateFloat(min = 0.0, max = 1.0) {
  return Math.random() * (max - min) + min;
}

module.exports = router;