(function () {
  const CATEGORY_LABELS = {
    construction: '🔨 Строительство',
    cleaning: '🧹 Уборка',
    moving: '📦 Переезд',
    garden: '🌱 Дача/огород',
    driving: '🚗 Водитель',
    errands: '📋 Поручения',
    assembly: '🪛 Сборка',
    animals: '🐾 Животные',
    shopping: '🛒 Шоппинг',
    other: '💬 Другое'
  };

  const STATUS_LABELS = {
    open: 'Открыто',
    assigned: 'Исполнитель найден',
    in_progress: 'Выполняется',
    done: 'Выполнено',
    cancelled: 'Отменено'
  };

  function showAlert(msg, type = 'error') {
    const el = document.getElementById('alert-global');
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  // Показать/скрыть поле длительности
  window.toggleDuration = function () {
    const type = document.getElementById('task-price-type').value;
    document.getElementById('duration-group').classList.toggle('hidden', type !== 'hourly');
  };

  async function createTask(e) {
    e.preventDefault();
    const priceType = document.getElementById('task-price-type').value;
    const duration = parseFloat(document.getElementById('task-duration').value);
    const scheduled = document.getElementById('task-scheduled').value;
    try {
      await api.createTask({
        category: document.getElementById('task-category').value,
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        address: document.getElementById('task-address').value,
        price_type: priceType,
        price: parseFloat(document.getElementById('task-price').value),
        duration_h: priceType === 'hourly' && duration ? duration : undefined,
        scheduled_at: scheduled ? new Date(scheduled).toISOString() : undefined,
        payment_method: document.getElementById('task-payment').value
      });
      showAlert('Задание размещено! Ждите откликов.', 'success');
      document.getElementById('form-task').reset();
      window.showSection('tasks');
    } catch (e) { showAlert(e.message); }
  }
  window.createTask = createTask;

  async function loadTasks() {
    const container = document.getElementById('tasks-list');
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    try {
      const tasks = await api.myTasks();
      if (!tasks.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Заданий нет. Разместите первое!</p></div>';
        return;
      }
      container.innerHTML = tasks.map(t => `
        <div class="card order-card ${t.status}">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div style="flex:1">
              <div style="font-size:.75rem;color:var(--muted);margin-bottom:.2rem">${CATEGORY_LABELS[t.category] || t.category}</div>
              <strong>${t.title}</strong>
              <div class="order-meta">
                <span>📍 ${t.address}</span>
                <span>💰 ${t.price} ₽ ${t.price_type === 'hourly' ? '/ч' : ''}</span>
                <span>${new Date(t.created_at).toLocaleString('ru')}</span>
              </div>
            </div>
            <span class="badge badge-${t.status}">${STATUS_LABELS[t.status]}</span>
          </div>
          <div class="order-actions">
            ${t.status === 'open' ? `<button class="btn btn-outline btn-sm" onclick="openResponses('${t.id}')">👥 Отклики</button>` : ''}
            ${t.status === 'open' ? `<button class="btn btn-danger btn-sm" onclick="cancelTask('${t.id}')">Отменить</button>` : ''}
            ${t.status === 'done' ? `<button class="btn btn-outline btn-sm" onclick="openRateTask('${t.id}')">⭐ Оценить</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) { showAlert(e.message); }
  }
  window.loadTasks = loadTasks;

  async function cancelTask(id) {
    if (!confirm('Отменить задание?')) return;
    try {
      await api.updateTaskStatus(id, 'cancelled');
      loadTasks();
    } catch (e) { showAlert(e.message); }
  }
  window.cancelTask = cancelTask;

  async function openResponses(taskId) {
    document.getElementById('resp-task-id').value = taskId;
    document.getElementById('responses-modal').classList.remove('hidden');
    const container = document.getElementById('responses-list');
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const resp = await api.taskResponses(taskId);
      if (!resp.length) {
        container.innerHTML = '<div class="empty-state" style="padding:1rem"><p>Откликов пока нет</p></div>';
        return;
      }
      container.innerHTML = resp.map(r => `
        <div class="card" style="margin-bottom:.75rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${r.worker_name}</strong>
              ${r.phone ? `<span style="color:var(--muted);font-size:.83rem;margin-left:.5rem">📞 ${r.worker_phone}</span>` : ''}
              ${r.price ? `<span style="color:var(--primary);margin-left:.5rem;font-size:.9rem">💰 ${r.price} ₽</span>` : ''}
              ${r.message ? `<div style="margin-top:.35rem;font-size:.85rem;color:var(--muted)">${r.message}</div>` : ''}
            </div>
            <button class="btn btn-success btn-sm" onclick="assignWorker('${r.worker_id}')">Выбрать</button>
          </div>
        </div>
      `).join('');
    } catch (e) { container.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  }
  window.openResponses = openResponses;

  async function assignWorker(workerId) {
    const taskId = document.getElementById('resp-task-id').value;
    try {
      await api.assignWorker(taskId, workerId);
      closeResponses();
      loadTasks();
      showAlert('Исполнитель выбран!', 'success');
    } catch (e) { showAlert(e.message); }
  }
  window.assignWorker = assignWorker;

  function closeResponses() {
    document.getElementById('responses-modal').classList.add('hidden');
  }
  window.closeResponses = closeResponses;

  // Оценка по заданиям (переиспользует rate-modal)
  window.openRateTask = function (taskId) {
    document.getElementById('rate-order-id').value = 'task:' + taskId;
    document.getElementById('rate-modal').classList.remove('hidden');
  };

  // Перехватываем submitRate из client.js для заданий
  const origSubmitRate = window.submitRate;
  window.submitRate = async function () {
    const raw = document.getElementById('rate-order-id').value;
    if (raw.startsWith('task:')) {
      const taskId = raw.slice(5);
      const score = parseInt(document.getElementById('rate-score').value);
      const comment = document.getElementById('rate-comment').value;
      try {
        await api.rateTask(taskId, score, comment);
        window.closeRate();
        showAlert('Спасибо за оценку!', 'success');
      } catch (e) { showAlert(e.message); }
    } else {
      origSubmitRate();
    }
  };

  // Расширяем showSection для новых секций
  const origShowSection = window.showSection;
  window.showSection = function (name) {
    ['orders', 'new-order', 'businesses', 'tasks', 'new-task'].forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.classList.toggle('hidden', s !== name);
    });
    if (name === 'tasks') loadTasks();
    if (name === 'orders') window.loadOrders();
    if (name === 'businesses') origShowSection && origShowSection('businesses');
  };
})();
