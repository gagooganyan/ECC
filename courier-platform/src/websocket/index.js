const jwt = require('jsonwebtoken');
const Courier = require('../models/Courier');

const SECRET = process.env.JWT_SECRET || 'courier-platform-secret-change-in-prod';

function init(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    socket.join(`user:${userId}`);

    if (role === 'courier') {
      socket.join('couriers');
    }

    // Courier sends live location updates via WebSocket
    socket.on('location:update', ({ lat, lng }) => {
      if (role !== 'courier') return;
      Courier.updateLocation(userId, lat, lng);
      io.emit('courier:location', { user_id: userId, lat, lng });
    });

    socket.on('disconnect', () => {
      if (role === 'courier') {
        Courier.updateStatus(userId, 'offline');
        io.emit('courier:status', { user_id: userId, status: 'offline' });
      }
    });
  });
}

module.exports = { init };
