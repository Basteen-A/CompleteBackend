const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all fields
router.get('/', (req, res) => {
  db.query('SELECT * FROM tractor_fields', (err, result) => {
    if (err) {
      console.error('Error fetching fields:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(result);
  });
});

// Add a new field
router.post('/', (req, res) => {
  const { name, cost_per_hour } = req.body;

  // Validate input: name is required, cost_per_hour is optional
  if (!name) {
    return res.status(400).json({ message: 'Field name is required' });
  }

  // Default cost_per_hour to 0 if not provided; validate if provided
  const finalCostPerHour = cost_per_hour !== undefined ? parseFloat(cost_per_hour) : 0;
  if (cost_per_hour !== undefined && (isNaN(finalCostPerHour) || finalCostPerHour < 0)) {
    return res.status(400).json({ message: 'Cost per hour must be a valid non-negative number' });
  }

  // Check if field name already exists (since name is UNIQUE in schema)
  db.query('SELECT * FROM tractor_fields WHERE name = ?', [name], (err, result) => {
    if (err) {
      console.error('Error checking field existence:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.length > 0) {
      return res.status(400).json({ message: 'Field name already exists' });
    }

    // Insert new field
    db.query(
      'INSERT INTO tractor_fields (name, cost_per_hour) VALUES (?, ?)',
      [name, finalCostPerHour],
      (err, result) => {
        if (err) {
          console.error('Error adding field:', err);
          return res.status(500).json({ message: 'Failed to add field' });
        }
        res.json({ success: true, fieldId: result.insertId });
      }
    );
  });
});

// Delete a field
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM tractor_fields WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting field:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Field not found' });
    }
    res.json({ success: true });
  });
});

module.exports = router;