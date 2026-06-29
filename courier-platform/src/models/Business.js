const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

function create({ owner_id, name, category, address, lat, lng, phone }) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO businesses (id, owner_id, name, category, address, lat, lng, phone) VALUES (?,?,?,?,?,?,?,?)'
  ).run(id, owner_id, name, category || 'company', address, lat || null, lng || null, phone || null);
  return findById(id);
}

function findById(id) {
  return getDb().prepare('SELECT * FROM businesses WHERE id = ?').get(id);
}

function list() {
  return getDb().prepare('SELECT * FROM businesses ORDER BY name').all();
}

module.exports = { create, findById, list };
