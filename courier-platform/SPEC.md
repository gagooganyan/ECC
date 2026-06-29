# Courier Delivery Platform — Technical Specification

## 1. Overview

A real-time courier delivery platform where clients (individuals, restaurants, companies)
post delivery orders and registered couriers accept and fulfil them.

---

## 2. Roles

| Role      | Description                                                      |
|-----------|------------------------------------------------------------------|
| **Client**  | Any user or business that creates a delivery order             |
| **Courier** | Registered delivery person who accepts and completes orders    |
| **Admin**   | Platform operator with full access                             |

---

## 3. Core Entities

### User
| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| name            | string   |                              |
| email           | string   | Unique                       |
| password_hash   | string   | bcrypt                       |
| phone           | string   |                              |
| role            | enum     | client / courier / admin     |
| created_at      | datetime |                              |

### Courier Profile
| Field          | Type    | Notes                              |
|----------------|---------|------------------------------------|
| id             | UUID    |                                    |
| user_id        | UUID    | FK → users                         |
| vehicle_type   | enum    | foot / bike / moto / car           |
| status         | enum    | offline / available / busy         |
| lat, lng       | float   | Current GPS position               |
| rating         | float   | Average rating 1–5                 |
| total_orders   | int     |                                    |

### Business
| Field        | Type   | Notes                                  |
|--------------|--------|----------------------------------------|
| id           | UUID   |                                        |
| owner_id     | UUID   | FK → users                             |
| name         | string |                                        |
| category     | enum   | restaurant / shop / company / personal |
| address      | string |                                        |
| lat, lng     | float  |                                        |
| phone        | string |                                        |

### Order
| Field             | Type     | Notes                                             |
|-------------------|----------|---------------------------------------------------|
| id                | UUID     |                                                   |
| client_id         | UUID     | FK → users                                        |
| courier_id        | UUID     | FK → courier_profiles, nullable                   |
| business_id       | UUID     | FK → businesses, nullable (for personal orders)   |
| pickup_address    | string   |                                                   |
| pickup_lat/lng    | float    |                                                   |
| delivery_address  | string   |                                                   |
| delivery_lat/lng  | float    |                                                   |
| description       | string   | What is being delivered                           |
| weight_kg         | float    | Optional                                          |
| price             | decimal  | Delivery fee                                      |
| status            | enum     | pending → accepted → picked_up → delivered / cancelled |
| payment_method    | enum     | cash / card / wallet                              |
| scheduled_at      | datetime | Optional, null = ASAP                             |
| created_at        | datetime |                                                   |
| updated_at        | datetime |                                                   |

### Rating
| Field      | Type  | Notes                         |
|------------|-------|-------------------------------|
| order_id   | UUID  |                               |
| from_user  | UUID  |                               |
| to_courier | UUID  |                               |
| score      | int   | 1–5                           |
| comment    | text  |                               |

---

## 4. Order Status Machine

```
pending → accepted → picked_up → delivered
    ↘               ↘           ↘
     cancelled    cancelled   cancelled (by admin)
```

---

## 5. REST API

### Auth
| Method | Path                   | Description          |
|--------|------------------------|----------------------|
| POST   | /api/auth/register     | Register new user    |
| POST   | /api/auth/login        | Login, returns JWT   |
| GET    | /api/auth/me           | Current user info    |

### Couriers
| Method | Path                         | Description                   |
|--------|------------------------------|-------------------------------|
| POST   | /api/couriers/register       | Upgrade account to courier    |
| GET    | /api/couriers/available      | List available couriers nearby |
| PUT    | /api/couriers/status         | Set online/offline/busy       |
| PUT    | /api/couriers/location       | Update GPS position           |
| GET    | /api/couriers/my-orders      | Courier's order history       |

### Orders
| Method | Path                         | Description                       |
|--------|------------------------------|-----------------------------------|
| POST   | /api/orders                  | Create new order (client)         |
| GET    | /api/orders                  | List own orders (role-aware)      |
| GET    | /api/orders/available        | Available orders for couriers     |
| GET    | /api/orders/:id              | Order details                     |
| POST   | /api/orders/:id/accept       | Courier accepts order             |
| PUT    | /api/orders/:id/status       | Update status                     |
| POST   | /api/orders/:id/rate         | Rate courier after delivery       |
| DELETE | /api/orders/:id              | Cancel order (if still pending)   |

### Businesses
| Method | Path                    | Description               |
|--------|-------------------------|---------------------------|
| POST   | /api/businesses         | Register a business       |
| GET    | /api/businesses         | List businesses           |
| GET    | /api/businesses/:id     | Business details          |

---

## 6. Real-Time Events (WebSocket)

| Event                  | Direction      | Payload                         |
|------------------------|----------------|---------------------------------|
| `order:new`            | Server → Courier | Order summary + coords         |
| `order:accepted`       | Server → Client  | Courier info                   |
| `order:location`       | Courier → Server → Client | { lat, lng }         |
| `order:status_changed` | Server → Both    | { status }                     |
| `courier:nearby`       | Server → Client  | List of couriers with positions|

---

## 7. Tech Stack

| Layer       | Technology                                   |
|-------------|----------------------------------------------|
| Runtime     | Node.js 18+                                  |
| Framework   | Express 4                                    |
| Database    | SQLite 3 (via `better-sqlite3`) — zero-config |
| Auth        | JWT (jsonwebtoken) + bcrypt                  |
| Real-time   | Socket.io 4                                  |
| Validation  | express-validator                            |
| Frontend    | Vanilla HTML/CSS/JS (no build step)          |
| Tests       | Node.js built-in test runner                 |

---

## 8. Project Structure

```
courier-platform/
├── SPEC.md
├── package.json
├── src/
│   ├── server.js           # Entry point
│   ├── db/
│   │   ├── index.js        # DB singleton
│   │   └── schema.sql      # DDL
│   ├── models/
│   │   ├── User.js
│   │   ├── Courier.js
│   │   ├── Order.js
│   │   └── Business.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── couriers.js
│   │   ├── orders.js
│   │   └── businesses.js
│   ├── middleware/
│   │   ├── auth.js         # JWT verification
│   │   └── requireRole.js
│   └── websocket/
│       └── index.js        # Socket.io handlers
├── frontend/
│   ├── index.html          # Login / register
│   ├── client.html         # Client dashboard
│   ├── courier.html        # Courier dashboard
│   ├── css/
│   │   └── app.css
│   └── js/
│       ├── api.js          # fetch wrapper
│       ├── client.js
│       └── courier.js
└── tests/
    ├── auth.test.js
    ├── orders.test.js
    └── couriers.test.js
```

---

## 9. Security

- Passwords hashed with bcrypt (cost 12)
- JWT with 24h expiry; refresh not stored server-side
- Role checks on every protected route
- Courier can only update their own location/status
- Client can only cancel their own orders (if still `pending`)
- All inputs validated and sanitized via express-validator
- No raw SQL string concatenation — parameterised queries throughout

---

## 10. Delivery Price Formula

```
base_price = 50          # flat fee (in local currency)
per_km     = 20          # per kilometer
distance   = haversine(pickup, delivery)
price      = base_price + per_km * distance
```
