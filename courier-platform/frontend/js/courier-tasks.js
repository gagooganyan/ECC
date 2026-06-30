(function () {
  const CATEGORY_LABELS = {
    construction: '🔨 Строительство', cleaning: '🧹 Уборка',
    moving: '📦 Переезд', garden: '🌱 Дача/огород',
    driving: '🚗 Водитель', errands: '📋 Поручения',
    assembly: '🪛 Сборка', animals: '🐾 Животные',
    shopping: '🛒 Шоппинг', other: '💬 Другое'
  };
  const STATUS_LABELS = {
    open: 'Открыто', assigned: 'Назначен', in_progress: 'Выполняется',
    done: 'Выполнено', cancelled: 'Отменено'
  };

  function showAlert(msg, type = 'error') {
    const el = document.getElementById('alert-global');
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  async function loadOpenTasks() {
    const category = document.getElementById('task-filter').value;
    const container = document.getElementById('open-tasks-list');
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    try {
      const tasks = await api.openTasks(category || null);
      if (!tasks.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Нет доступных заданий</p></div>';
        return;
      }
      container.innerHTML = tasks.map(t => `
        <div class="card order-card pending">
          <div style="font-size:.75rem;color:var(--muted);margin-bottom:.2rem">${CATEGORY_LABELS[t.category]}</div>
          <strong>${t.title}</strong>
          <div class="order-meta">
            <span>📍 ${t.address}</span>
            <span>💰 <strong>${t.price} ₽${t.price_type === 'hourly' ? '/ч' : ''}</strong></span>
            ${t.duration_h ? `<span>⏱ ${t.duration_h} ч</span>` : ''}
            ${t.scheduled_at ? `<span>📅 ${new Date(t.scheduled_at).toLocaleString('ru')}</span>` : '<span>Время: сразу</span>'}
          </div>
          <div style="margin-top:.5rem;font-size:.85rem;color:var(--text)">${t.description}</div>
          <div class="order-actions">
            <button class="btn btn-primary btn-sm" onclick="openRespondModal('${t.id}', ${t.price})">
              ✋ Откликнуться
            </button>
          </div>
        </div>
      `).join('');
    } catch (e) { showAlert(e.message); }
  }
  window.loadOpenTasks = loadOpenTasks;

  async function loadMyTasks() {
    const container = document.getElementById('my-tasks-list');
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    try {
      const tasks = await api.myWork();
      if (!tasks.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>Заданий нет</p></div>';
        return;
      }
      container.innerHTML = tasks.map(t => `
        <div class="card order-card ${t.status}">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <div style="font-size:.75rem;color:var(--muted)">${CATEGORY_LABELS[t.category]}</div>
              <strong>${t.title}</strong>
              <div class="order-meta">
                <span>📍 ${t.address}</span>
                <span>💰 ${t.price} ₽${t.price_type === 'hourly' ? '/ч' : ''}</span>
              </div>
            </div>
            <span class="badge badge-${t.status}">${STATUS_LABELS[t.status]}</span>
          </div>
          <div class="order-actions">
            ${t.status === 'assigned' ? `<button class="btn btn-primary btn-sm" onclick="startTask('${t.id}')">▶ Начать</button>` : ''}
            ${t.status === 'in_progress' ? `<button class="btn btn-success btn-sm" onclick="finishTask('${t.id}')">✅ Выполнено</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) { showAlert(e.message); }
  }
  window.loadMyTasks = loadMyTasks;

  async function startTask(id) {
    try { await api.updateTaskStatus(id, 'in_progress'); loadMyTasks(); } catch (e) { showAlert(e.message); }
  }
  window.startTask = startTask;

  async function finishTask(id) {
    try {
      await api.updateTaskStatus(id, 'done');
      loadMyTasks();
      showAlert('Задание выполнено! 🎉', 'success');
    } catch (e) { showAlert(e.message); }
  }
  window.finishTask = finishTask;

  // Модал отклика
  let _respondTaskId = null;

  window.openRespondModal = function (taskId, suggestedPrice) {
    _respondTaskId = taskId;
    const msg = prompt('Ваш комментарий (необязательно):');
    const priceStr = prompt(`Ваша цена (₽), или Enter чтобы принять ${suggestedPrice} ₽:`);
    const price = priceStr ? parseFloat(priceStr) : suggestedPrice;
    respondToTask(taskId, msg, price);
  };

  async function respondToTask(taskId, message, price) {
    try {
      await api.respondTask(taskId, { message: message || undefined, price });
      showAlert('Отклик отправлен! Ждите выбора клиента.', 'success');
      loadOpenTasks();
    } catch (e) { showAlert(e.message); }
  }

  // Расширяем showSection курьера
  const origShowSection = window.showSection;
  window.showSection = function (name) {
    ['available', 'my-orders', 'profile', 'open-tasks', 'my-tasks'].forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.classList.toggle('hidden', s !== name);
    });
    if (name === 'available' && typeof window.loadAvailable === 'function') window.loadAvailable();
    if (name === 'my-orders' && typeof window.loadMyOrders === 'function') window.loadMyOrders();
    if (name === 'profile' && typeof window.loadProfile === 'function') window.loadProfile();
    if (name === 'open-tasks') loadOpenTasks();
    if (name === 'my-tasks') loadMyTasks();
  };
})();
