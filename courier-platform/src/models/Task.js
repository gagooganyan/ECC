const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

const COMMISSION = 0.12;

function create(data) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks
      (id, client_id, category, title, description, address, lat, lng,
       price_type, price, duration_h, scheduled_at, payment_method)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.client_id, data.category, data.title, data.description,
    data.address, data.lat || null, data.lng || null,
    data.price_type || 'fixed', data.price,
    data.duration_h || null, data.scheduled_at || null,
    data.payment_method || 'cash'
  );
  return findById(id);
}

function findById(id) {
  return getDb().prepare(`
    SELECT t.*, u.name AS client_name, u.phone AS client_phone
    FROM tasks t JOIN users u ON u.id = t.client_id
    WHERE t.id = ?
  `).get(id);
}

function listOpen(category) {
  const db = getDb();
  if (category) {
    return db.prepare(
      "SELECT * FROM tasks WHERE status = 'open' AND category = ? ORDER BY created_at DESC"
    ).all(category);
  }
  return db.prepare(
    "SELECT * FROM tasks WHERE status = 'open' ORDER BY created_at DESC"
  ).all();
}

function listByClient(client_id) {
  return getDb().prepare(
    'SELECT * FROM tasks WHERE client_id = ? ORDER BY created_at DESC'
  ).all(client_id);
}

function listByWorker(worker_id) {
  return getDb().prepare(
    'SELECT * FROM tasks WHERE worker_id = ? ORDER BY created_at DESC'
  ).all(worker_id);
}

// Исполнитель откликается на задание
function respond(task_id, worker_id, message, price) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT OR IGNORE INTO task_responses (id, task_id, worker_id, message, price) VALUES (?,?,?,?,?)'
  ).run(id, task_id, worker_id, message || null, price || null);
  return listResponses(task_id);
}

function listResponses(task_id) {
  return getDb().prepare(`
    SELECT tr.*, u.name AS worker_name, u.phone AS worker_phone
    FROM task_responses tr JOIN users u ON u.id = tr.worker_id
    WHERE tr.task_id = ?
    ORDER BY tr.created_at ASC
  `).all(task_id);
}

// Клиент выбирает исполнителя
function assign(task_id, client_id, worker_id) {
  const db = getDb();
  const info = db.prepare(`
    UPDATE tasks SET worker_id = ?, status = 'assigned', updated_at = datetime('now')
    WHERE id = ? AND client_id = ? AND status = 'open'
  `).run(worker_id, task_id, client_id);
  return info.changes > 0;
}

function updateStatus(task_id, status, actor_id, role) {
  const db = getDb();
  let info;
  if (role === 'admin') {
    info = db.prepare(
      "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, task_id);
  } else if (status === 'in_progress' || status === 'done') {
    // только назначенный исполнитель
    info = db.prepare(
      "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ? AND worker_id = ?"
    ).run(status, task_id, actor_id);
  } else if (status === 'cancelled') {
    // клиент отменяет если open/assigned
    info = db.prepare(`
      UPDATE tasks SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ? AND client_id = ? AND status IN ('open','assigned')
    `).run(task_id, actor_id);
  }
  return info && info.changes > 0;
}

function addRating(task_id, from_user, to_worker, score, comment) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO task_ratings (id, task_id, from_user, to_worker, score, comment) VALUES (?,?,?,?,?,?)'
  ).run(id, task_id, from_user, to_worker, score, comment || null);
}

function commission(price) {
  return Math.round(price * COMMISSION * 100) / 100;
}

// Навыки исполнителя
function setSkills(user_id, skills) {
  const db = getDb();
  db.prepare('DELETE FROM worker_skills WHERE user_id = ?').run(user_id);
  const ins = db.prepare('INSERT OR IGNORE INTO worker_skills (user_id, skill) VALUES (?,?)');
  skills.forEach(s => ins.run(user_id, s));
}

function getSkills(user_id) {
  return getDb().prepare(
    'SELECT skill FROM worker_skills WHERE user_id = ?'
  ).all(user_id).map(r => r.skill);
}

module.exports = {
  create, findById, listOpen, listByClient, listByWorker,
  respond, listResponses, assign, updateStatus, addRating,
  commission, setSkills, getSkills
};
