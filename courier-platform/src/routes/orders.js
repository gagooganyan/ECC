const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Courier = require('../models/Courier');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create order (any authenticated user)
router.post('/', requireAuth, [
  body('pickup_address').trim().notEmpty(),
  body('delivery_address').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('pickup_lat').optional().isFloat(),
  body('pickup_lng').optional().isFloat(),
  body('delivery_lat').optional().isFloat(),
  body('delivery_lng').optional().isFloat(),
  body('weight_kg').optional().isFloat({ min: 0 }),
  body('payment_method').optional().isIn(['cash', 'card', 'wallet']),
  body('scheduled_at').optional().isISO8601()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const order = Order.create({ ...req.body, client_id: req.user.id });

  const io = req.app.get('io');
  if (io) io.emit('order:new', order);

  res.status(201).json(order);
});

// List orders (role-aware)
router.get('/', requireAuth, (req, res) => {
  if (req.user.role === 'courier') {
    const profile = Courier.findByUserId(req.user.id);
    return res.json(profile ? Order.listByCourier(profile.id) : []);
  }
  res.json(Order.listByClient(req.user.id));
});

// Available orders for couriers
router.get('/available', requireAuth, requireRole('courier', 'admin'), (req, res) => {
  res.json(Order.listAvailable());
});

// Order details
router.get('/:id', requireAuth, (req, res) => {
  const order = Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Only client, assigned courier, or admin can view
  const profile = req.user.role === 'courier' ? Courier.findByUserId(req.user.id) : null;
  const isMine = order.client_id === req.user.id ||
    (profile && order.courier_id === profile.id) ||
    req.user.role === 'admin';
  if (!isMine) return res.status(403).json({ error: 'Access denied' });

  res.json(order);
});

// Accept order (courier only)
router.post('/:id/accept', requireAuth, requireRole('courier'), (req, res) => {
  const profile = Courier.findByUserId(req.user.id);
  if (!profile) return res.status(400).json({ error: 'Courier profile not found' });

  const accepted = Order.accept(req.params.id, profile.id);
  if (!accepted) return res.status(409).json({ error: 'Order no longer available' });

  Courier.updateStatus(req.user.id, 'busy');

  const order = Order.findById(req.params.id);
  const io = req.app.get('io');
  if (io) io.emit('order:accepted', { order_id: order.id, courier: profile });

  res.json(order);
});

// Update status
router.put('/:id/status', requireAuth, [
  body('status').isIn(['picked_up', 'delivered', 'cancelled'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { status } = req.body;
  const profile = req.user.role === 'courier' ? Courier.findByUserId(req.user.id) : null;
  const courierId = profile ? profile.id : null;

  const updated = Order.updateStatus(req.params.id, status, courierId);
  if (!updated) return res.status(403).json({ error: 'Cannot update this order' });

  if (status === 'delivered' && profile) {
    Courier.updateStatus(req.user.id, 'available');
  }

  const order = Order.findById(req.params.id);
  const io = req.app.get('io');
  if (io) io.emit('order:status_changed', { order_id: order.id, status });

  res.json(order);
});

// Rate courier after delivery
router.post('/:id/rate', requireAuth, requireRole('client'), [
  body('score').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const order = Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  if (order.status !== 'delivered') return res.status(400).json({ error: 'Order not yet delivered' });
  if (!order.courier_id) return res.status(400).json({ error: 'No courier on this order' });

  Order.addRating(order.id, req.user.id, order.courier_id, req.body.score, req.body.comment);
  Courier.updateRating(order.courier_id);

  res.json({ success: true });
});

// Cancel order (client, pending only)
router.delete('/:id', requireAuth, requireRole('client'), (req, res) => {
  const cancelled = Order.cancel(req.params.id, req.user.id);
  if (!cancelled) return res.status(409).json({ error: 'Cannot cancel this order' });

  const io = req.app.get('io');
  if (io) io.emit('order:status_changed', { order_id: req.params.id, status: 'cancelled' });

  res.json({ success: true });
});

module.exports = router;
