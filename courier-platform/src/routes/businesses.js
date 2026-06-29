const express = require('express');
const { body, validationResult } = require('express-validator');
const Business = require('../models/Business');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, [
  body('name').trim().notEmpty(),
  body('category').optional().isIn(['restaurant', 'shop', 'company', 'personal']),
  body('address').trim().notEmpty(),
  body('lat').optional().isFloat(),
  body('lng').optional().isFloat(),
  body('phone').optional().isMobilePhone()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const biz = Business.create({ ...req.body, owner_id: req.user.id });
  res.status(201).json(biz);
});

router.get('/', requireAuth, (req, res) => {
  res.json(Business.list());
});

router.get('/:id', requireAuth, (req, res) => {
  const biz = Business.findById(req.params.id);
  if (!biz) return res.status(404).json({ error: 'Not found' });
  res.json(biz);
});

module.exports = router;
