const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data.errors));
  return data;
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),

  // auth
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),

  // orders
  createOrder: (data) => api.post('/orders', data),
  listOrders: () => api.get('/orders'),
  availableOrders: () => api.get('/orders/available'),
  acceptOrder: (id) => api.post(`/orders/${id}/accept`),
  updateOrderStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  rateOrder: (id, score, comment) => api.post(`/orders/${id}/rate`, { score, comment }),
  cancelOrder: (id) => api.delete(`/orders/${id}`),

  // couriers
  registerCourier: (data) => api.post('/couriers/register', data),
  setCourierStatus: (status) => api.put('/couriers/status', { status }),
  updateLocation: (lat, lng) => api.put('/couriers/location', { lat, lng }),
  myOrders: () => api.get('/couriers/my-orders'),

  // businesses
  listBusinesses: () => api.get('/businesses'),
  createBusiness: (data) => api.post('/businesses', data)
};

window.api = api;
