const { getDb } = require('../db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const BCRYPT_COST = 12;

function create({ name, email, password, phone, role = 'client' }) {
  const db = getDb();
  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, BCRYPT_COST);
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, phone, role) VALUES (?,?,?,?,?,?)'
  ).run(id, name, email, password_hash, phone || null, role);
  return findById(id);
}

function findByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findById(id) {
  return getDb().prepare('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?').get(id);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

module.exports = { create, findByEmail, findById, verifyPassword };
