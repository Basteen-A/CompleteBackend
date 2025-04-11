const express = require('express');
const router = express.Router();
// Assuming MQTT for IoT communication
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://YOUR_MQTT_BROKER'); // Replace with your MQTT broker URL

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('iot/signal', (err) => {
    if (err) console.error('Subscription error:', err);
  });
});

// Handle IoT signal requests
router.post('/signal', (req, res) => {
  const { billId, action } = req.body;

  if (!billId || !action) {
    return res.status(400).json({ message: 'Bill ID and action are required' });
  }

  const message = JSON.stringify({ billId, action });
  client.publish('iot/signal', message, (err) => {
    if (err) {
      console.error('Error publishing MQTT message:', err);
      return res.status(500).json({ message: 'Failed to send IoT signal' });
    }
    console.log(`IoT Signal - Bill ID: ${billId}, Action: ${action}`);
    res.json({ success: true });
  });
});

// Handle count increments from ESP32
client.on('message', (topic, message) => {
  if (topic === 'count/increment') {
    const { billId } = JSON.parse(message.toString());
    // Update count in database or notify frontend via WebSocket (if implemented)
    console.log(`Count increment received for Bill ID: ${billId}`);
  }
});

module.exports = router;