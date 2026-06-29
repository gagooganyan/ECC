const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

function create({ user_id, vehicle_type = 'foot' }) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO courier_profiles (id, user_id, vehicle_type) VALUES (?,?,?)'
  ).run(id, user_id, vehicle_type);
  // upgrade user role
  db.prepare("UPDATE users SET role = 'courier' WHERE id = ?").run(user_id);
  return findByUserId(user_id);
}

function findByUserId(user_id) {
  return getDb().prepare('SELECT * FROM courier_profiles WHERE user_id = ?').get(user_id);
}

function findById(id) {
  return getDb().prepare('SELECT * FROM courier_profiles WHERE id = ?').get(id);
}

function updateStatus(user_id, status) {
  getDb().prepare('UPDATE courier_profiles SET status = ? WHERE user_id = ?').run(status, user_id);
}

function updateLocation(user_id, lat, lng) {
  getDb().prepare(
    'UPDATE courier_profiles SET lat = ?, lng = ? WHERE user_id = ?'
  ).run(lat, lng, user_id);
}

function listAvailable() {
  return getDb().prepare(`
    SELECT cp.*, u.name, u.phone
    FROM courier_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.status = 'available'
  `).all();
}

function updateRating(courier_id) {
  const db = getDb();
  const row = db.prepare(
    'SELECT AVG(score) as avg, COUNT(*) as cnt FROM ratings WHERE to_courier = ?'
  ).get(courier_id);
  db.prepare(
    'UPDATE courier_profiles SET rating = ?, total_orders = ? WHERE id = ?'
  ).run(row.avg || 0, row.cnt, courier_id);
}

module.exports = { create, findByUserId, findById, updateStatus, updateLocation, listAvailable, updateRating };
