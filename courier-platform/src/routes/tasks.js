const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = ['construction','cleaning','moving','garden','driving','errands','assembly','animals','shopping','other'];
const SKILLS = CATEGORIES;

// Создать задание
router.post('/', requireAuth, [
  body('category').isIn(CATEGORIES),
  body('title').trim().notEmpty().isLength({ max: 120 }),
  body('description').trim().notEmpty(),
  body('address').trim().notEmpty(),
  body('price').isFloat({ min: 50 }),
  body('price_type').optional().isIn(['fixed', 'hourly']),
  body('duration_h').optional().isFloat({ min: 0.5, max: 24 }),
  body('lat').optional().isFloat(),
  body('lng').optional().isFloat(),
  body('payment_method').optional().isIn(['cash', 'card', 'wallet']),
  body('scheduled_at').optional().isISO8601()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = Task.create({ ...req.body, client_id: req.user.id });

  const io = req.app.get('io');
  if (io) io.emit('task:new', task);

  res.status(201).json(task);
});

// Список открытых заданий (для исполнителей)
router.get('/open', requireAuth, [
  query('category').optional().isIn(CATEGORIES)
], (req, res) => {
  res.json(Task.listOpen(req.query.category));
});

// Мои задания (клиент)
router.get('/my', requireAuth, (req, res) => {
  res.json(Task.listByClient(req.user.id));
});

// Мои задания как исполнителя
router.get('/my-work', requireAuth, (req, res) => {
  res.json(Task.listByWorker(req.user.id));
});

// Детали задания
router.get('/:id', requireAuth, (req, res) => {
  const task = Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const isParty = task.client_id === req.user.id ||
    task.worker_id === req.user.id ||
    req.user.role === 'admin';
  if (!isParty && task.status !== 'open') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(task);
});

// Откликнуться на задание (любой авторизованный)
router.post('/:id/respond', requireAuth, [
  body('message').optional().trim().isLength({ max: 500 }),
  body('price').optional().isFloat({ min: 0 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  if (task.status !== 'open') return res.status(409).json({ error: 'Задание уже недоступно' });
  if (task.client_id === req.user.id) return res.status(400).json({ error: 'Нельзя откликнуться на своё задание' });

  const responses = Task.respond(req.params.id, req.user.id, req.body.message, req.body.price);

  const io = req.app.get('io');
  if (io) io.to(`user:${task.client_id}`).emit('task:response', { task_id: task.id, worker_id: req.user.id });

  res.status(201).json(responses);
});

// Список откликов на задание (только клиент-владелец)
router.get('/:id/responses', requireAuth, (req, res) => {
  const task = Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Не найдено' });
  if (task.client_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(Task.listResponses(req.params.id));
});

// Выбрать исполнителя
router.post('/:id/assign/:worker_id', requireAuth, (req, res) => {
  const task = Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Не найдено' });
  if (task.client_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  const ok = Task.assign(req.params.id, req.user.id, req.params.worker_id);
  if (!ok) return res.status(409).json({ error: 'Не удалось назначить исполнителя' });

  const updated = Task.findById(req.params.id);
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${req.params.worker_id}`).emit('task:assigned', updated);
  }
  res.json(updated);
});

// Обновить статус
router.put('/:id/status', requireAuth, [
  body('status').isIn(['in_progress', 'done', 'cancelled'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const ok = Task.updateStatus(req.params.id, req.body.status, req.user.id, req.user.role);
  if (!ok) return res.status(403).json({ error: 'Невозможно изменить статус' });

  const task = Task.findById(req.params.id);
  const io = req.app.get('io');
  if (io) io.emit('task:status_changed', { task_id: task.id, status: task.status });

  res.json(task);
});

// Оценить исполнителя после выполнения
router.post('/:id/rate', requireAuth, [
  body('score').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Не найдено' });
  if (task.client_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
  if (task.status !== 'done') return res.status(400).json({ error: 'Задание ещё не выполнено' });
  if (!task.worker_id) return res.status(400).json({ error: 'Нет исполнителя' });

  Task.addRating(task.id, req.user.id, task.worker_id, req.body.score, req.body.comment);
  res.json({ success: true });
});

// Навыки исполнителя
router.put('/skills', requireAuth, [
  body('skills').isArray({ min: 1 }),
  body('skills.*').isIn(SKILLS)
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  Task.setSkills(req.user.id, req.body.skills);
  res.json({ skills: req.body.skills });
});

router.get('/skills/my', requireAuth, (req, res) => {
  res.json(Task.getSkills(req.user.id));
});

module.exports = router;
