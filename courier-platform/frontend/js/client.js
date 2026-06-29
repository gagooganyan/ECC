(function () {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) { window.location.href = '/'; return; }
  document.getElementById('user-name').textContent = user.name;

  function logout() { localStorage.clear(); window.location.href = '/'; }
  window.logout = logout;

  function showSection(name) {
    ['orders', 'new-order', 'businesses'].forEach(s => {
      document.getElementById(`section-${s}`).classList.toggle('hidden', s !== name);
    });
    if (name === 'orders') loadOrders();
    if (name === 'businesses') loadBusinesses();
    if (name === 'new-order') loadBusinessesForSelect();
  }
  window.showSection = showSection;

  function showAlert(msg, type = 'error') {
    const el = document.getElementById('alert-global');
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  const statusLabels = { pending: 'Ожидает', accepted: 'Принят', picked_up: 'Забран', delivered: 'Доставлен', cancelled: 'Отменён' };

  async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    try {
      const orders = await api.listOrders();
      if (!orders.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>Заказов нет. Создайте первый!</p></div>';
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
          <div class="order-actions">
            ${o.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">Отменить</button>` : ''}
            ${o.status === 'delivered' ? `<button class="btn btn-outline btn-sm" onclick="openRate('${o.id}')">⭐ Оценить</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) { showAlert(e.message); }
  }
  window.loadOrders = loadOrders;

  async function loadBusinessesForSelect() {
    try {
      const list = await api.listBusinesses();
      const sel = document.getElementById('order-business');
      sel.innerHTML = '<option value="">— частный заказ —</option>' +
        list.map(b => `<option value="${b.id}">${b.name} (${b.address})</option>`).join('');
    } catch {}
  }

  // Price preview
  let priceTimer;
  ['order-pickup-lat','order-pickup-lng','order-delivery-lat','order-delivery-lng'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(priceTimer);
      priceTimer = setTimeout(updatePricePreview, 400);
    });
  });

  function updatePricePreview() {
    const lat1 = parseFloat(document.getElementById('order-pickup-lat').value);
    const lng1 = parseFloat(document.getElementById('order-pickup-lng').value);
    const lat2 = parseFloat(document.getElementById('order-delivery-lat').value);
    const lng2 = parseFloat(document.getElementById('order-delivery-lng').value);
    if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
      const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const price = Math.round((50 + 20 * dist) * 100) / 100;
      document.getElementById('price-val').textContent = `${price} ₽ (~${dist.toFixed(1)} км)`;
      document.getElementById('price-preview').style.display = 'block';
    }
  }

  async function createOrder(e) {
    e.preventDefault();
    try {
      const order = await api.createOrder({
        business_id: document.getElementById('order-business').value || undefined,
        pickup_address: document.getElementById('order-pickup').value,
        pickup_lat: parseFloat(document.getElementById('order-pickup-lat').value) || undefined,
        pickup_lng: parseFloat(document.getElementById('order-pickup-lng').value) || undefined,
        delivery_address: document.getElementById('order-delivery').value,
        delivery_lat: parseFloat(document.getElementById('order-delivery-lat').value) || undefined,
        delivery_lng: parseFloat(document.getElementById('order-delivery-lng').value) || undefined,
        description: document.getElementById('order-desc').value,
        weight_kg: parseFloat(document.getElementById('order-weight').value) || undefined,
        payment_method: document.getElementById('order-payment').value
      });
      showAlert(`Заказ #${order.id.slice(0,8)} создан! Ищем курьера…`, 'success');
      document.getElementById('form-order').reset();
      document.getElementById('price-preview').style.display = 'none';
      showSection('orders');
    } catch (e) { showAlert(e.message); }
  }
  window.createOrder = createOrder;

  async function cancelOrder(id) {
    if (!confirm('Отменить заказ?')) return;
    try { await api.cancelOrder(id); loadOrders(); } catch (e) { showAlert(e.message); }
  }
  window.cancelOrder = cancelOrder;

  function openRate(orderId) {
    document.getElementById('rate-order-id').value = orderId;
    document.getElementById('rate-modal').classList.remove('hidden');
  }
  function closeRate() { document.getElementById('rate-modal').classList.add('hidden'); }
  window.openRate = openRate;
  window.closeRate = closeRate;

  async function submitRate() {
    const orderId = document.getElementById('rate-order-id').value;
    const score = parseInt(document.getElementById('rate-score').value);
    const comment = document.getElementById('rate-comment').value;
    try {
      await api.rateOrder(orderId, score, comment);
      closeRate();
      showAlert('Спасибо за оценку!', 'success');
    } catch (e) { showAlert(e.message); }
  }
  window.submitRate = submitRate;

  async function loadBusinesses() {
    try {
      const list = await api.listBusinesses();
      const container = document.getElementById('biz-list');
      if (!list.length) { container.innerHTML = '<div class="empty-state"><div class="icon">🏪</div><p>Заведений нет</p></div>'; return; }
      container.innerHTML = list.map(b => `
        <div class="card">
          <strong>${b.name}</strong>
          <div class="order-meta">
            <span>${b.category}</span>
            <span>📍 ${b.address}</span>
            ${b.phone ? `<span>📞 ${b.phone}</span>` : ''}
          </div>
        </div>
      `).join('');
    } catch {}
  }

  window.showAddBiz = async function() {
    const name = prompt('Название заведения:');
    if (!name) return;
    const address = prompt('Адрес:');
    if (!address) return;
    try {
      await api.createBusiness({ name, address });
      loadBusinesses();
    } catch (e) { showAlert(e.message); }
  };

  loadOrders();
})();
