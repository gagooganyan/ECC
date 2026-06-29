(function () {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) { window.location.href = '/'; return; }
  document.getElementById('user-name').textContent = user.name;

  let currentStatus = 'offline';

  function logout() { localStorage.clear(); window.location.href = '/'; }
  window.logout = logout;

  function showSection(name) {
    ['available', 'my-orders', 'profile'].forEach(s => {
      document.getElementById(`section-${s}`).classList.toggle('hidden', s !== name);
    });
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    if (name === 'available') loadAvailable();
    if (name === 'my-orders') loadMyOrders();
    if (name === 'profile') loadProfile();
  }
  window.showSection = showSection;

  function showAlert(msg, type = 'error') {
    const el = document.getElementById('alert-global');
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function renderStatusButtons(status) {
    currentStatus = status;
    ['offline', 'available', 'busy'].forEach(s => {
      const btn = document.getElementById(`btn-${s}`);
      btn.className = status === s ? `active-${s}` : '';
    });
  }

  async function setStatus(status) {
    try {
      await api.setCourierStatus(status);
      renderStatusButtons(status);
      showAlert(`Статус: ${status}`, 'success');
    } catch (e) { showAlert(e.message); }
  }
  window.setStatus = setStatus;

  const statusLabels = { pending: 'Ожидает', accepted: 'Принят', picked_up: 'Забран', delivered: 'Доставлен', cancelled: 'Отменён' };

  async function loadAvailable() {
    const container = document.getElementById('available-list');
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    try {
      const orders = await api.availableOrders();
      if (!orders.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>Нет доступных заказов</p></div>';
        return;
      }
      container.innerHTML = orders.map(o => `
        <div class="card order-card pending">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <strong>${o.description}</strong>
              <div class="order-meta">
                <span>📍 ${o.pickup_address}</span>
                <span>🏁 ${o.delivery_address}</span>
                <span>💰 <strong>${o.price} ₽</strong></span>
                ${o.weight_kg ? `<span>⚖️ ${o.weight_kg} кг</span>` : ''}
                <span>${new Date(o.created_at).toLocaleString('ru')}</span>
              </div>
            </div>
            <span class="badge badge-pending">Ожидает</span>
          </div>
          <div class="order-actions">
            <button class="btn btn-success btn-sm" onclick="acceptOrder('${o.id}')">✓ Принять заказ</button>
          </div>
        </div>
      `).join('');
    } catch (e) { showAlert(e.message); }
  }
  window.loadAvailable = loadAvailable;

  async function acceptOrder(id) {
    try {
      await api.acceptOrder(id);
      showAlert('Заказ принят! Перейдите во вкладку "Мои заказы"', 'success');
      loadAvailable();
    } catch (e) { showAlert(e.message); }
  }
  window.acceptOrder = acceptOrder;

  const nextStatus = { accepted: 'picked_up', picked_up: 'delivered' };
  const nextLabel  = { accepted: '📦 Забрал груз', picked_up: '✅ Доставил' };

  async function loadMyOrders() {
    const container = document.getElementById('my-orders-list');
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    try {
      const orders = await api.myOrders();
      if (!orders.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Заказов нет</p></div>';
        return;
      }
      container.innerHTML = orders.map(o => `
        <div class="card order-card ${o.status}">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <strong>${o.description}</strong>
              <div class="order-meta">
                <span>📍 ${o.pickup_address} → ${o.delivery_address}</span>
                <span>💰 ${o.price} ₽</span>
                <span>${new Date(o.created_at).toLocaleString('ru')}</span>
              </div>
            </div>
            <span class="badge badge-${o.status}">${statusLabels[o.status]}</span>
          </div>
          ${nextStatus[o.status] ? `
          <div class="order-actions">
            <button class="btn btn-primary btn-sm" onclick="advanceOrder('${o.id}','${nextStatus[o.status]}')">
              ${nextLabel[o.status]}
            </button>
          </div>` : ''}
        </div>
      `).join('');
    } catch (e) { showAlert(e.message); }
  }
  window.loadMyOrders = loadMyOrders;

  async function advanceOrder(id, status) {
    try {
      await api.updateOrderStatus(id, status);
      loadMyOrders();
      if (status === 'delivered') showAlert('Заказ доставлен! 🎉', 'success');
    } catch (e) { showAlert(e.message); }
  }
  window.advanceOrder = advanceOrder;

  async function loadProfile() {
    try {
      const me = await api.me();
      const vehicleEmoji = { foot: '🚶', bike: '🚴', moto: '🛵', car: '🚗' };
      document.getElementById('profile-info').innerHTML = `
        <div style="font-size:1.1rem;font-weight:600">${me.name}</div>
        <div class="order-meta" style="margin-top:.4rem">
          <span>📧 ${me.email}</span>
          ${me.phone ? `<span>📞 ${me.phone}</span>` : ''}
        </div>
      `;
    } catch {}
  }

  async function updateVehicle() {}
  window.updateVehicle = updateVehicle;

  async function sendManualLocation() {
    const lat = parseFloat(document.getElementById('manual-lat').value);
    const lng = parseFloat(document.getElementById('manual-lng').value);
    if (isNaN(lat) || isNaN(lng)) { showAlert('Введите корректные координаты'); return; }
    try { await api.updateLocation(lat, lng); showAlert('Позиция обновлена', 'success'); } catch (e) { showAlert(e.message); }
  }
  window.sendManualLocation = sendManualLocation;

  function useGPS() {
    if (!navigator.geolocation) { showAlert('GPS недоступен в браузере'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      document.getElementById('manual-lat').value = lat.toFixed(6);
      document.getElementById('manual-lng').value = lng.toFixed(6);
      try { await api.updateLocation(lat, lng); showAlert('Позиция обновлена по GPS', 'success'); } catch (e) { showAlert(e.message); }
    }, () => showAlert('Не удалось получить GPS-позицию'));
  }
  window.useGPS = useGPS;

  loadAvailable();
})();
