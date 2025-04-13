const express = require('express');
const router = express.Router();
const mqtt = require('mqtt');

// MQTT client connection
const client = mqtt.connect('mqtts://ace77fd7972643408254260884cc22e4.s1.eu.hivemq.cloud:8883', {
  username: 'hivemq.webclient.1744534432607',
  password: 'Ob,!F2XhlVv8B*Wm3&7u'
});

client.on('connect', () => {
  console.log('[MQTT] Connected to broker');
  client.subscribe('iot/signal', (err) => {
    if (err) console.error('[MQTT] Subscription error:', err);
    else console.log('[MQTT] Subscribed to topic: iot/signal');
  });
});

client.on('error', (err) => {
  console.error('[MQTT] Connection error:', err.message);
});

// Listen for messages on subscribed topics
client.on('message', (topic, message) => {
  if (topic === 'iot/signal') {
    try {
      const { billId, action } = JSON.parse(message.toString());
      console.log(`[MQTT] Received - Bill ID: ${billId}, Action: ${action}`);
      // Optional: Add DB logic or notifications here
    } catch (e) {
      console.error('[MQTT] Message parse error:', e.message);
    }
  }
});

// API endpoint to send IoT signal via MQTT
router.post('/signal', (req, res) => {
  const { billId, action } = req.body;

  if (!billId || !action) {
    return res.status(400).json({ message: 'Bill ID and action are required' });
  }

  const validActions = ['start', 'stop'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: 'Invalid action. Use "start" or "stop"' });
  }

  const message = JSON.stringify({ billId, action });

  client.publish('iot/signal', message, (err) => {
    if (err) {
      console.error('[MQTT] Publish error:', err.message);
      return res.status(500).json({ message: 'Failed to send IoT signal' });
    }

    console.log(`[MQTT] Published - Bill ID: ${billId}, Action: ${action}`);
    return res.json({ success: true, billId, action });
  });
});

module.exports = router;
