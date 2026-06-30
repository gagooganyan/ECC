PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client','courier','admin')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courier_profiles (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL DEFAULT 'foot' CHECK(vehicle_type IN ('foot','bike','moto','car')),
  status       TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('offline','available','busy')),
  lat          REAL,
  lng          REAL,
  rating       REAL NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
  id       TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'company' CHECK(category IN ('restaurant','shop','company','personal')),
  address  TEXT NOT NULL,
  lat      REAL,
  lng      REAL,
  phone    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES users(id),
  courier_id       TEXT REFERENCES courier_profiles(id),
  business_id      TEXT REFERENCES businesses(id),
  pickup_address   TEXT NOT NULL,
  pickup_lat       REAL,
  pickup_lng       REAL,
  delivery_address TEXT NOT NULL,
  delivery_lat     REAL,
  delivery_lng     REAL,
  description      TEXT NOT NULL,
  weight_kg        REAL,
  price            REAL NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','picked_up','delivered','cancelled')),
  payment_method   TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','wallet')),
  scheduled_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratings (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL UNIQUE REFERENCES orders(id),
  from_user   TEXT NOT NULL REFERENCES users(id),
  to_courier  TEXT NOT NULL REFERENCES courier_profiles(id),
  score       INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_client   ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier  ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON courier_profiles(status);

-- исполнители: расширяем профиль курьера навыками для заданий
CREATE TABLE IF NOT EXISTS worker_skills (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill    TEXT NOT NULL CHECK(skill IN (
    'construction','cleaning','moving','garden','driving',
    'errands','assembly','animals','shopping','other'
  )),
  PRIMARY KEY (user_id, skill)
);

-- задания (TaskRabbit-блок)
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES users(id),
  worker_id     TEXT REFERENCES users(id),
  category      TEXT NOT NULL CHECK(category IN (
    'construction','cleaning','moving','garden','driving',
    'errands','assembly','animals','shopping','other'
  )),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  address       TEXT NOT NULL,
  lat           REAL,
  lng           REAL,
  price_type    TEXT NOT NULL DEFAULT 'fixed' CHECK(price_type IN ('fixed','hourly')),
  price         REAL NOT NULL,
  duration_h    REAL,
  scheduled_at  TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','assigned','in_progress','done','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','wallet')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- отклики исполнителей на задание
CREATE TABLE IF NOT EXISTS task_responses (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id  TEXT NOT NULL REFERENCES users(id),
  message    TEXT,
  price      REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, worker_id)
);

-- рейтинги для заданий
CREATE TABLE IF NOT EXISTS task_ratings (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL UNIQUE REFERENCES tasks(id),
  from_user  TEXT NOT NULL REFERENCES users(id),
  to_worker  TEXT NOT NULL REFERENCES users(id),
  score      INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_client   ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_worker   ON tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
