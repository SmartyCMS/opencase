const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Open a case
router.post('/open-case', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { caseId } = req.body;
    const userId = req.user.userId;
    
    // Get case info
    const [caseInfo] = await connection.execute(
      'SELECT * FROM cases WHERE id = ? AND is_active = TRUE',
      [caseId]
    );
    
    if (caseInfo.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    
    const caseData = caseInfo[0];
    
    // Check user balance
    const [userInfo] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );
    
    if (userInfo[0].balance < caseData.price) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
    // Get case items with drop chances
    const [items] = await connection.execute(`
      SELECT i.*, ci.drop_chance
      FROM items i
      JOIN case_items ci ON i.id = ci.item_id
      WHERE ci.case_id = ? AND i.is_active = TRUE
    `, [caseId]);
    
    // Calculate which item to drop based on chances and case bank
    const droppedItem = calculateDrop(items, caseData.bank_balance, caseData.price);
    
    // Calculate profit/loss
    const profitLoss = droppedItem.price - caseData.price;
    
    // Update user balance
    await connection.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [caseData.price, userId]
    );
    
    // Update case bank and total opened
    await connection.execute(
      'UPDATE cases SET bank_balance = bank_balance + ?, total_opened = total_opened + 1 WHERE id = ?',
      [caseData.price - droppedItem.price, caseId]
    );
    
    // Add item to user inventory
    await connection.execute(
      'INSERT INTO user_inventory (user_id, item_id, float_value, acquired_from) VALUES (?, ?, ?, ?)',
      [userId, droppedItem.id, generateFloat(droppedItem.float_min, droppedItem.float_max), 'case_opening']
    );
    
    // Record case opening
    await connection.execute(
      'INSERT INTO case_openings (user_id, case_id, item_id, item_value, profit_loss) VALUES (?, ?, ?, ?, ?)',
      [userId, caseId, droppedItem.id, droppedItem.price, profitLoss]
    );
    
    // Add to live feed
    await connection.execute(
      'INSERT INTO live_feed (user_id, action_type, item_id, case_id, value) VALUES (?, ?, ?, ?, ?)',
      [userId, 'case_opening', droppedItem.id, caseId, droppedItem.price]
    );
    
    // Record transaction
    await connection.execute(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'case_opening', -caseData.price, `Opened ${caseData.name}`]
    );
    
    await connection.commit();
    
    // Get updated user balance
    const [updatedUser] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );
    
    // Emit to live feed
    const io = req.app.get('io');
    const [userInfo2] = await connection.execute(
      'SELECT username, avatar FROM users WHERE id = ?',
      [userId]
    );
    
    io.emit('live-feed', {
      type: 'case_opening',
      user: userInfo2[0],
      item: droppedItem,
      case: caseData,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      item: droppedItem,
      balance: updatedUser[0].balance,
      profitLoss
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Case opening error:', error);
    res.status(500).json({ success: false, message: 'Failed to open case' });
  } finally {
    connection.release();
  }
});

// Get user inventory
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const [inventory] = await db.execute(`
      SELECT ui.*, i.name, i.market_name, i.icon_url, i.rarity, i.price, i.quality
      FROM user_inventory ui
      JOIN items i ON ui.item_id = i.id
      WHERE ui.user_id = ?
      ORDER BY ui.acquired_at DESC
    `, [req.user.userId]);
    
    res.json({ success: true, inventory });
  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({ success: false, message: 'Failed to get inventory' });
  }
});

// Sell item from inventory
router.post('/sell-item', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { inventoryItemId } = req.body;
    const userId = req.user.userId;
    
    // Get inventory item
    const [inventoryItem] = await connection.execute(`
      SELECT ui.*, i.price
      FROM user_inventory ui
      JOIN items i ON ui.item_id = i.id
      WHERE ui.id = ? AND ui.user_id = ?
    `, [inventoryItemId, userId]);
    
    if (inventoryItem.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    const item = inventoryItem[0];
    const sellPrice = item.price * 0.9; // 10% house edge on selling
    
    // Remove item from inventory
    await connection.execute(
      'DELETE FROM user_inventory WHERE id = ?',
      [inventoryItemId]
    );
    
    // Add money to user balance
    await connection.execute(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [sellPrice, userId]
    );
    
    // Record transaction
    await connection.execute(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'sell_item', sellPrice, `Sold item for $${sellPrice}`]
    );
    
    await connection.commit();
    
    // Get updated balance
    const [updatedUser] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      soldPrice: sellPrice,
      balance: updatedUser[0].balance
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Sell item error:', error);
    res.status(500).json({ success: false, message: 'Failed to sell item' });
  } finally {
    connection.release();
  }
});

// Get live feed
router.get('/live-feed', async (req, res) => {
  try {
    const [liveFeed] = await db.execute(`
      SELECT lf.*, u.username, u.avatar, i.name as item_name, i.rarity, i.icon_url, c.name as case_name
      FROM live_feed lf
      JOIN users u ON lf.user_id = u.id
      LEFT JOIN items i ON lf.item_id = i.id
      LEFT JOIN cases c ON lf.case_id = c.id
      ORDER BY lf.created_at DESC
      LIMIT 50
    `);
    
    res.json({ success: true, liveFeed });
  } catch (error) {
    console.error('Live feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to get live feed' });
  }
});

// Helper function to calculate item drop based on chances and bank balance
function calculateDrop(items, bankBalance, casePrice) {
  // If bank is negative (house is losing), increase chance for cheaper items
  // If bank is positive (house is winning), allow more expensive drops
  
  const totalChance = items.reduce((sum, item) => sum + item.drop_chance, 0);
  let adjustedItems = items.map(item => {
    let adjustedChance = item.drop_chance;
    
    // Bank balance adjustment logic
    if (bankBalance < 0) {
      // House is losing, favor cheaper items
      if (item.price < casePrice) {
        adjustedChance *= 1.5; // Increase chance for cheaper items
      } else {
        adjustedChance *= 0.5; // Decrease chance for expensive items
      }
    } else if (bankBalance > casePrice * 10) {
      // House has good profit, can afford to give better items
      if (item.price > casePrice) {
        adjustedChance *= 1.2; // Slightly increase chance for expensive items
      }
    }
    
    return { ...item, adjustedChance };
  });
  
  // Normalize chances
  const totalAdjustedChance = adjustedItems.reduce((sum, item) => sum + item.adjustedChance, 0);
  adjustedItems = adjustedItems.map(item => ({
    ...item,
    normalizedChance: (item.adjustedChance / totalAdjustedChance) * 100
  }));
  
  // Generate random number and select item
  const random = Math.random() * 100;
  let currentChance = 0;
  
  for (const item of adjustedItems) {
    currentChance += item.normalizedChance;
    if (random <= currentChance) {
      return item;
    }
  }
  
  // Fallback to last item
  return adjustedItems[adjustedItems.length - 1];
}

// Helper function to generate random float value
function generateFloat(min = 0.0, max = 1.0) {
  return Math.random() * (max - min) + min;
}

module.exports = router;