const App = (() => {
  const STORAGE_KEY = 'lubelog_config';
  let state = {
    serverUrl: '',
    apiKey: '',
    defaultVehicleId: null,
    activeVehicleId: null,
    vehicles: [],
    currentTab: 'fuel'
  };

  // --- Storage ---
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) Object.assign(state, saved);
    } catch (_) {}
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      serverUrl: state.serverUrl,
      apiKey: state.apiKey,
      defaultVehicleId: state.defaultVehicleId,
      activeVehicleId: state.activeVehicleId,
      vehicles: state.vehicles,
      currentTab: state.currentTab
    }));
  }

  // --- API ---
  async function api(method, path, body) {
    const url = new URL(path, state.serverUrl);
    const opts = {
      method,
      headers: { 'x-api-key': state.apiKey }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url.toString(), opts);
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    try { return JSON.parse(text); } catch (_) { return text; }
  }

  async function apiGet(path, params) {
    const url = new URL(path, state.serverUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      });
    }
    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': state.apiKey }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    try { return JSON.parse(text); } catch (_) { return text; }
  }

  // --- Setup ---
  async function testConnection() {
    const url = document.getElementById('setup-url').value.trim().replace(/\/+$/, '');
    const key = document.getElementById('setup-apikey').value.trim();
    const statusEl = document.getElementById('setup-connection-status');
    const btn = document.getElementById('setup-connect-btn');

    if (!url || !key) {
      statusEl.className = 'status-msg error';
      statusEl.textContent = 'Please enter both URL and API key.';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Connecting...';
    statusEl.className = 'status-msg loading';
    statusEl.textContent = 'Testing connection...';

    state.serverUrl = url;
    state.apiKey = key;

    try {
      const vehicles = await apiGet('/api/vehicles');
      if (!Array.isArray(vehicles)) throw new Error('Unexpected response');

      state.vehicles = vehicles;
      saveState();

      statusEl.className = 'status-msg success';
      statusEl.textContent = `Connected! Found ${vehicles.length} vehicle(s).`;

      setTimeout(() => {
        document.getElementById('setup-step-connection').classList.add('hidden');
        const vehicleStep = document.getElementById('setup-step-vehicle');
        vehicleStep.classList.remove('hidden');
        renderVehicleList('setup-vehicle-list', vehicles, null, id => setDefaultVehicle(id));
      }, 600);
    } catch (err) {
      statusEl.className = 'status-msg error';
      statusEl.textContent = `Connection failed: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Test Connection';
    }
  }

  function setDefaultVehicle(vehicleId) {
    state.defaultVehicleId = vehicleId;
    state.activeVehicleId = vehicleId || (state.vehicles.length > 0 ? state.vehicles[0].id : null);
    saveState();
    showApp();
  }

  // --- Vehicle rendering ---
  function vehicleDisplayName(v) {
    return `${v.year} ${v.make} ${v.model}`;
  }

  function vehicleIcon(v) {
    const type = (v.fuelType || '').toLowerCase();
    if (type.includes('electric')) return '⚡';
    if (type.includes('diesel')) return '⛽';
    return '🚗';
  }

  function renderVehicleList(containerId, vehicles, selectedId, onClick) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    vehicles.forEach(v => {
      const card = document.createElement('div');
      card.className = 'vehicle-card' + (v.id === selectedId ? ' selected' : '');
      const isDefault = v.id === state.defaultVehicleId;
      card.innerHTML = `
        <div class="vehicle-icon">${vehicleIcon(v)}</div>
        <div class="vehicle-info">
          <div class="vehicle-name">${vehicleDisplayName(v)}</div>
          <div class="vehicle-detail">${v.licensePlate || v.identifier || ''}</div>
        </div>
        ${isDefault ? '<span class="default-badge">Default</span>' : ''}
      `;
      card.addEventListener('click', () => onClick(v.id));
      container.appendChild(card);
    });
  }

  // --- Main App ---
  function showApp() {
    document.getElementById('view-setup').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    updateHeader();
    navigate(state.currentTab || 'fuel');
    setTodayDates();
    loadServerInfo();
  }

  function updateHeader() {
    const v = state.vehicles.find(v => v.id === state.activeVehicleId);
    document.getElementById('header-vehicle-name').textContent =
      v ? vehicleDisplayName(v) : 'Select Vehicle';
  }

  function setTodayDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fuel-date').value = today;
    document.getElementById('service-date').value = today;
  }

  // --- Navigation ---
  function navigate(tab) {
    state.currentTab = tab;
    saveState();

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById('tab-' + tab);
    if (panel) panel.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'history') loadHistory('fuel');
    if (tab === 'settings') populateSettings();
  }

  // --- Vehicle Switcher ---
  function showVehicleSwitcher() {
    renderVehicleList('switcher-vehicle-list', state.vehicles, state.activeVehicleId, id => {
      state.activeVehicleId = id;
      saveState();
      updateHeader();
      hideVehicleSwitcher();
      if (state.currentTab === 'history') loadHistory('fuel');
    });
    document.getElementById('vehicle-switcher').classList.remove('hidden');
  }

  function hideVehicleSwitcher(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('vehicle-switcher').classList.add('hidden');
  }

  // --- Toast ---
  function toast(message, type) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast ' + type;
    setTimeout(() => el.classList.add('hidden'), 2500);
  }

  // --- Submit Fuel ---
  async function submitFuel(event) {
    event.preventDefault();
    if (!state.activeVehicleId) {
      toast('Please select a vehicle first', 'error');
      return;
    }

    const btn = document.getElementById('fuel-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    const body = {
      date: document.getElementById('fuel-date').value,
      odometer: parseFloat(document.getElementById('fuel-odometer').value),
      fuelConsumed: parseFloat(document.getElementById('fuel-gallons').value),
      cost: parseFloat(document.getElementById('fuel-cost').value),
      isFillToFull: document.getElementById('fuel-filltofull').checked,
      missedFuelUp: document.getElementById('fuel-missed').checked,
      notes: document.getElementById('fuel-notes').value.trim(),
      tags: document.getElementById('fuel-tags').value.trim()
    };

    try {
      await api('POST', `/api/vehicle/gasrecords/add?vehicleId=${state.activeVehicleId}`, body);
      toast('Fuel record saved!', 'success');
      document.getElementById('fuel-form').reset();
      setTodayDates();
      document.getElementById('fuel-filltofull').checked = true;
    } catch (err) {
      toast('Failed to save: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Save Fuel Record';
    }
  }

  // --- Submit Service ---
  async function submitService(event) {
    event.preventDefault();
    if (!state.activeVehicleId) {
      toast('Please select a vehicle first', 'error');
      return;
    }

    const btn = document.getElementById('service-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    const body = {
      date: document.getElementById('service-date').value,
      odometer: parseFloat(document.getElementById('service-odometer').value),
      description: document.getElementById('service-desc').value.trim(),
      cost: parseFloat(document.getElementById('service-cost').value),
      notes: document.getElementById('service-notes').value.trim(),
      tags: document.getElementById('service-tags').value.trim()
    };

    try {
      await api('POST', `/api/vehicle/servicerecords/add?vehicleId=${state.activeVehicleId}`, body);
      toast('Service record saved!', 'success');
      document.getElementById('service-form').reset();
      setTodayDates();
    } catch (err) {
      toast('Failed to save: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Save Service Record';
    }
  }

  // --- History ---
  async function loadHistory(type) {
    document.querySelectorAll('.history-tab').forEach(t => {
      t.classList.toggle('active', t.textContent.toLowerCase() === type);
    });

    const container = document.getElementById('history-list');
    if (!state.activeVehicleId) {
      container.innerHTML = '<p class="empty-state">Select a vehicle to view history</p>';
      return;
    }

    container.innerHTML = '<p class="empty-state">Loading...</p>';

    try {
      let records;
      if (type === 'fuel') {
        records = await apiGet('/api/vehicle/gasrecords', { vehicleId: state.activeVehicleId });
      } else {
        records = await apiGet('/api/vehicle/servicerecords', { vehicleId: state.activeVehicleId });
      }

      if (!Array.isArray(records) || records.length === 0) {
        container.innerHTML = '<p class="empty-state">No records found</p>';
        return;
      }

      records.sort((a, b) => new Date(b.date) - new Date(a.date));
      const recent = records.slice(0, 20);

      container.innerHTML = recent.map(r => {
        const dateStr = formatDate(r.date);
        const cost = formatCurrency(r.cost);

        if (type === 'fuel') {
          return `
            <div class="history-item">
              <div class="history-item-header">
                <span class="history-item-date">${dateStr}</span>
                <span class="history-item-cost">${cost}</span>
              </div>
              <div class="history-item-details">
                <span>${r.odometer?.toLocaleString() || '---'} mi</span>
                <span>${r.fuelConsumed || '---'} gal</span>
                ${r.isFillToFull ? '<span>Full</span>' : ''}
              </div>
              ${r.notes ? `<div class="history-item-details" style="margin-top:4px"><span>${escapeHtml(r.notes)}</span></div>` : ''}
            </div>
          `;
        } else {
          return `
            <div class="history-item">
              <div class="history-item-header">
                <span class="history-item-date">${dateStr}</span>
                <span class="history-item-cost">${cost}</span>
              </div>
              <div class="history-item-desc">${escapeHtml(r.description || '')}</div>
              <div class="history-item-details">
                <span>${r.odometer?.toLocaleString() || '---'} mi</span>
              </div>
              ${r.notes ? `<div class="history-item-details" style="margin-top:4px"><span>${escapeHtml(r.notes)}</span></div>` : ''}
            </div>
          `;
        }
      }).join('');
    } catch (err) {
      container.innerHTML = `<p class="empty-state">Error loading records: ${escapeHtml(err.message)}</p>`;
    }
  }

  // --- Settings ---
  function populateSettings() {
    document.getElementById('settings-url').value = state.serverUrl;
    document.getElementById('settings-apikey').value = state.apiKey;
    renderVehicleList('settings-vehicle-list', state.vehicles, state.defaultVehicleId, id => {
      updateDefaultVehicle(id);
    });
  }

  async function saveSettings() {
    const url = document.getElementById('settings-url').value.trim().replace(/\/+$/, '');
    const key = document.getElementById('settings-apikey').value.trim();

    if (!url || !key) {
      toast('URL and API key are required', 'error');
      return;
    }

    state.serverUrl = url;
    state.apiKey = key;

    try {
      const vehicles = await apiGet('/api/vehicles');
      state.vehicles = vehicles;
      saveState();
      toast('Connection updated!', 'success');
      populateSettings();
      updateHeader();
    } catch (err) {
      toast('Connection failed: ' + err.message, 'error');
    }
  }

  function updateDefaultVehicle(id) {
    state.defaultVehicleId = id;
    if (id) state.activeVehicleId = id;
    saveState();
    toast(id ? 'Default vehicle updated' : 'Default cleared', 'success');
    populateSettings();
    updateHeader();
  }

  function resetApp() {
    if (confirm('This will clear all saved settings. Continue?')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  }

  // --- Server Info ---
  async function loadServerInfo() {
    try {
      const info = await apiGet('/api/version');
      const el = document.getElementById('settings-server-info');
      if (typeof info === 'string') {
        el.textContent = `LubeLogger ${info}`;
      } else if (info && info.version) {
        el.textContent = `LubeLogger ${info.version}`;
      }
    } catch (_) {}
  }

  // --- Helpers ---
  function formatDate(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '---';
    return '$' + Number(amount).toFixed(2);
  }

  function escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // --- Init ---
  function init() {
    loadState();

    if (state.serverUrl && state.apiKey && state.vehicles.length > 0) {
      showApp();
      refreshVehicles();
    } else {
      document.getElementById('view-setup').classList.remove('hidden');
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  async function refreshVehicles() {
    try {
      const vehicles = await apiGet('/api/vehicles');
      if (Array.isArray(vehicles)) {
        state.vehicles = vehicles;
        saveState();
      }
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    testConnection,
    setDefaultVehicle,
    navigate,
    showVehicleSwitcher,
    hideVehicleSwitcher,
    submitFuel,
    submitService,
    loadHistory,
    saveSettings,
    updateDefaultVehicle,
    resetApp
  };
})();
