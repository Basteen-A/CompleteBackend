const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all bills for a specific user with filtering
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { field_name, month } = req.query;

  let query = `
    SELECT b.id, b.user_id, b.field_name, b.time, b.cost, b.status, b.payment_method, b.created_at, b.start_time, b.stop_time, b.count, b.price_per_count
    FROM bills b WHERE user_id = ?`;
  const params = [userId === 'all' ? '%' : userId];

  if (field_name) {
    query += ' AND field_name = ?';
    params.push(field_name);
  }
  if (month) {
    query += ' AND DATE_FORMAT(created_at, "%Y-%m") = ?';
    params.push(month);
  }
  query += ' ORDER BY created_at DESC';

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Error fetching bills:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(result);
  });
});

// Start a new bill (timer or count)
router.post('/start', (req, res) => {
  const { user_id, field_name, price_per_count } = req.body;

  if (!user_id || !field_name) {
    return res.status(400).json({ message: 'User ID and field name are required' });
  }

  console.log('Starting bill with:', { user_id, field_name, price_per_count });

  db.query(
    'SELECT cost_per_hour FROM tractor_fields WHERE name = ?',
    [field_name],
    (err, fieldResult) => {
      if (err) {
        console.error('Error checking field:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      if (fieldResult.length === 0) {
        console.log(`Field "${field_name}" not found in tractor_fields`);
        return res.status(400).json({ message: 'Field does not exist' });
      }

      const isCountField = fieldResult[0].cost_per_hour === 0;
      const startTime = new Date();

      let query = 'INSERT INTO bills (user_id, field_name, start_time, status';
      let values = [user_id, field_name, startTime, 'running'];
      if (isCountField && price_per_count !== undefined) {
        query += ', price_per_count';
        values.push(parseFloat(price_per_count));
      }
      query += ') VALUES (?, ?, ?, ?' + (isCountField && price_per_count !== undefined ? ', ?' : '') + ')';

      console.log('Executing query:', query, 'with values:', values);

      db.query(query, values, (err, result) => {
        if (err) {
          console.error('Error starting bill:', err);
          return res.status(500).json({ message: 'Failed to start' });
        }
        res.json({
          success: true,
          billId: result.insertId,
          start_time: startTime.toISOString(),
          isCountField,
          price_per_count: isCountField ? parseFloat(price_per_count) || null : null,
        });
      });
    }
  );
});

// Stop a bill (timer or count) and calculate time/cost
router.post('/stop', (req, res) => {
  const { billId, count, cost } = req.body;

  if (!billId) {
    return res.status(400).json({ message: 'Bill ID is required' });
  }

  db.query(
    `
    SELECT b.start_time, b.price_per_count, tf.cost_per_hour 
    FROM bills b 
    JOIN tractor_fields tf ON b.field_name = tf.name 
    WHERE b.id = ? AND b.stop_time IS NULL AND b.status = "running"`,
    [billId],
    (err, result) => {
      if (err) {
        console.error('Error fetching bill for stop:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      if (result.length === 0) {
        return res.status(400).json({ message: 'Bill not found, already stopped, or not running' });
      }

      const { start_time, price_per_count, cost_per_hour } = result[0];
      const isCountField = cost_per_hour === 0;
      const stopTime = new Date();

      if (isCountField) {
        if (count === undefined) {
          return res.status(400).json({ message: 'Count is required for count fields' });
        }
        const finalCost = cost !== undefined ? parseFloat(cost) : (price_per_count ? count * price_per_count : 0);
        if (finalCost === 0) {
          return res.status(400).json({ message: 'Price per count must be set to calculate cost' });
        }

        db.query(
          'UPDATE bills SET stop_time = ?, count = ?, cost = ?, status = "pending" WHERE id = ?',
          [stopTime, count, finalCost, billId],
          (err, updateResult) => {
            if (err) {
              console.error('Error updating count bill:', err);
              return res.status(500).json({ message: 'Failed to update bill' });
            }
            res.json({ success: true, count, cost: finalCost });
          }
        );
      } else {
        const startTime = new Date(start_time);
        const diffMs = stopTime - startTime;
        const diffSec = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSec / 3600);
        const minutes = Math.floor((diffSec % 3600) / 60);
        const seconds = diffSec % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const timeInHours = diffMs / (1000 * 60 * 60);
        const calculatedCost = Number((timeInHours * cost_per_hour).toFixed(2));

        db.query(
          'UPDATE bills SET stop_time = ?, time = ?, cost = ?, status = "pending" WHERE id = ?',
          [stopTime, timeString, calculatedCost, billId],
          (err, updateResult) => {
            if (err) {
              console.error('Error updating timer bill:', err);
              return res.status(500).json({ message: 'Failed to update bill' });
            }
            res.json({ success: true, time: timeString, cost: calculatedCost });
          }
        );
      }
    }
  );
});

// Edit a bill (admin only)
router.post('/edit', (req, res) => {
  const { billId, time, cost, count, price_per_count } = req.body;

  if (!billId || (time === undefined && cost === undefined && count === undefined && price_per_count === undefined)) {
    return res.status(400).json({ message: 'Bill ID and at least one field to edit are required' });
  }

  let query = 'UPDATE bills SET';
  const params = [];
  if (time !== undefined) {
    query += ' time = ?,';
    params.push(time);
  }
  if (cost !== undefined) {
    query += ' cost = ?,';
    params.push(cost);
  }
  if (count !== undefined) {
    query += ' count = ?,';
    params.push(count);
  }
  if (price_per_count !== undefined) {
    query += ' price_per_count = ?,';
    params.push(parseFloat(price_per_count));
  }
  query = query.slice(0, -1); // Remove trailing comma
  query += ' WHERE id = ?';
  params.push(billId);

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Error editing bill:', err);
      return res.status(500).json({ message: 'Failed to edit bill' });
    }
    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Bill not found' });
    }
    res.json({ success: true });
  });
});

// Delete bills for a user
router.delete('/user/:userId', (req, res) => {
  const { userId } = req.params;
  db.query('DELETE FROM bills WHERE user_id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error deleting bills:', err);
      return res.status(500).json({ message: 'Failed to delete bills' });
    }
    res.json({ success: true });
  });
});

// Mark a bill as paid
router.post('/pay', (req, res) => {
  const { billId, payment_method } = req.body;

  if (!billId || !payment_method) {
    return res.status(400).json({ message: 'Bill ID and payment method are required' });
  }

  db.query(
    'UPDATE bills SET status = "completed", payment_method = ? WHERE id = ? AND status = "pending"',
    [payment_method, billId],
    (err, result) => {
      if (err) {
        console.error('Error marking bill as paid:', err);
        return res.status(500).json({ message: 'Failed to mark bill as paid' });
      }
      if (result.affectedRows === 0) {
        return res.status(400).json({ message: 'Bill not found or already paid' });
      }
      res.json({ success: true });
    }
  );
});


router.post('/update-cost', (req, res) => {
  const { billId, cost } = req.body;
  if (!billId || cost === undefined || isNaN(cost) || cost < 0) {
    return res.status(400).json({ message: 'Invalid bill ID or cost' });
  }
  db.query(
    'UPDATE tractor_bills SET cost = ? WHERE id = ? AND status = "pending"',
    [parseFloat(cost), billId],
    (err, result) => {
      if (err) {
        console.error('Error updating bill cost:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Bill not found or not pending' });
      }
      res.json({ success: true });
    }
  );
});

module.exports = router;