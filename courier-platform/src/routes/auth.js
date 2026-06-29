const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sign, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('phone').optional().isMobilePhone()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, phone } = req.body;
  if (User.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' });

  const user = User.create({ name, email, password, phone });
  const token = sign({ id: user.id, role: user.role });
  res.status(201).json({ user, token });
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const userRow = User.findByEmail(email);
  if (!userRow || !User.verifyPassword(password, userRow.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = User.findById(userRow.id);
  const token = sign({ id: user.id, role: user.role });
  res.json({ user, token });
});

router.get('/me', requireAuth, (req, res) => {
  const user = User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
