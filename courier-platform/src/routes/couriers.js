const express = require('express');
const { body, validationResult } = require('express-validator');
const Courier = require('../models/Courier');
const Order = require('../models/Order');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Register as courier
router.post('/register', requireAuth, [
  body('vehicle_type').optional().isIn(['foot', 'bike', 'moto', 'car'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (Courier.findByUserId(req.user.id)) {
    return res.status(409).json({ error: 'Already registered as courier' });
  }
  const profile = Courier.create({ user_id: req.user.id, vehicle_type: req.body.vehicle_type });
  res.status(201).json(profile);
});

// List available couriers
router.get('/available', requireAuth, (req, res) => {
  res.json(Courier.listAvailable());
});

// Update courier status
router.put('/status', requireAuth, requireRole('courier', 'admin'), [
  body('status').isIn(['offline', 'available', 'busy'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  Courier.updateStatus(req.user.id, req.body.status);

  const io = req.app.get('io');
  if (io) io.emit('courier:status', { user_id: req.user.id, status: req.body.status });

  res.json({ success: true });
});

// Update GPS location
router.put('/location', requireAuth, requireRole('courier', 'admin'), [
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { lat, lng } = req.body;
  Courier.updateLocation(req.user.id, lat, lng);

  const io = req.app.get('io');
  if (io) io.emit('courier:location', { user_id: req.user.id, lat, lng });

  res.json({ success: true });
});

// Courier's own order history
router.get('/my-orders', requireAuth, requireRole('courier', 'admin'), (req, res) => {
  const profile = Courier.findByUserId(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Courier profile not found' });
  res.json(Order.listByCourier(profile.id));
});

module.exports = router;
