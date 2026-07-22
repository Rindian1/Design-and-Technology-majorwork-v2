(function() {
  'use strict';

  const PLUGS_API = '/api/plugs';
  let plugsState = [];
  let credentialsOk = false;
  let emailKnown = false;

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('plug-grid')) return;

    fetchPlugs();
    document.getElementById('add-plug-btn').addEventListener('click', openAddModal);
    document.getElementById('add-plug-close').addEventListener('click', closeAddModal);
    document.getElementById('add-plug-cancel').addEventListener('click', closeAddModal);
    document.getElementById('add-plug-submit').addEventListener('click', submitAddPlug);
    document.getElementById('tapo-password-toggle').addEventListener('click', togglePasswordVisibility);
    document.querySelectorAll('.preset-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.getElementById('plug-name').value = tag.dataset.name;
      });
    });
    document.getElementById('add-plug-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeAddModal();
    });

    document.getElementById('schedule-close').addEventListener('click', closeSchedule);
    document.getElementById('schedule-cancel').addEventListener('click', closeSchedule);
    document.getElementById('schedule-save').addEventListener('click', saveSchedule);
    document.getElementById('schedule-fill-btn').addEventListener('click', fillRecommended);
    document.getElementById('schedule-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeSchedule();
    });

    document.getElementById('password-close').addEventListener('click', closePasswordModal);
    document.getElementById('password-cancel').addEventListener('click', closePasswordModal);
    document.getElementById('password-submit').addEventListener('click', submitPasswordOnly);
    document.getElementById('password-only-toggle').addEventListener('click', () => {
      const input = document.getElementById('password-only-pass');
      const btn = document.getElementById('password-only-toggle');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? '🙈' : '👁';
    });
    document.getElementById('password-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closePasswordModal();
    });

    document.getElementById('edit-plug-close').addEventListener('click', closeEditModal);
    document.getElementById('edit-plug-cancel').addEventListener('click', closeEditModal);
    document.getElementById('edit-plug-submit').addEventListener('click', submitEditPlug);
    document.getElementById('edit-plug-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeEditModal();
    });

    window.addEventListener('tabChanged', (e) => {
      if (e.detail.tab === 'plugs') fetchPlugs();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.plug-menu-wrap')) closeAllMenus();
    });
  });

  function togglePasswordVisibility() {
    const input = document.getElementById('tapo-password');
    const btn = document.getElementById('tapo-password-toggle');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.textContent = isPassword ? '🙈' : '👁';
  }

  async function fetchPlugs() {
    try {
      const res = await fetch(PLUGS_API);
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error('Failed to fetch plugs');
      }
      const data = await res.json();
      plugsState = data.plugs || [];
      credentialsOk = data.credentials_ok;
      emailKnown = data.email_known;
      renderPlugs();
    } catch (err) {
      console.error('Error fetching plugs:', err);
    }
  }

  function renderPlugs() {
    const grid = document.getElementById('plug-grid');
    const empty = document.getElementById('plug-empty');

    if (!plugsState.length) {
      empty.style.display = 'block';
      grid.querySelectorAll('.plug-card').forEach(el => el.remove());
      removeCredentialBanner();
      return;
    }

    empty.style.display = 'none';
    updateCredentialBanner();

    const existing = new Set();
    grid.querySelectorAll('.plug-card').forEach(el => existing.add(el.dataset.name));

    const currentNames = new Set(plugsState.map(p => p.name));

    grid.querySelectorAll('.plug-card').forEach(el => {
      if (!currentNames.has(el.dataset.name)) el.remove();
    });

    plugsState.forEach(plug => {
      if (existing.has(plug.name)) {
        updateCard(plug);
        return;
      }
      const card = createCard(plug);
      grid.appendChild(card);
    });
  }

  function updateCredentialBanner() {
    const existing = document.querySelector('.creds-banner');
    if (credentialsOk) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const banner = document.createElement('div');
    banner.className = 'creds-banner';
    if (emailKnown) {
      banner.innerHTML = `
        <span class="creds-banner-text">TAPO password required to control plugs.</span>
        <button class="btn btn-primary creds-banner-btn" id="creds-reenter-btn">Enter Password</button>
      `;
    } else {
      banner.innerHTML = `
        <span class="creds-banner-text">TAPO account login required to control plugs.</span>
        <button class="btn btn-primary creds-banner-btn" id="creds-reenter-btn">Enter Credentials</button>
      `;
    }
    const grid = document.getElementById('plug-grid');
    grid.parentNode.insertBefore(banner, grid);

    document.getElementById('creds-reenter-btn').addEventListener('click', () => {
      if (emailKnown) {
        openPasswordOnlyModal();
      } else {
        openAddModal();
      }
    });
  }

  function removeCredentialBanner() {
    const existing = document.querySelector('.creds-banner');
    if (existing) existing.remove();
  }

  function createCard(plug) {
    const card = document.createElement('div');
    card.className = 'plug-card';
    card.dataset.name = plug.name;

    const isOn = plug.status === true;
    const isOff = plug.status === false;
    const isUnknown = plug.status === null || plug.status === undefined;
    const hasStat = plug.cost_per_hour !== null && plug.cost_per_hour !== undefined;
    const statText = hasStat ? `$${plug.cost_per_hour.toFixed(2)}/hr` : '--/hr';
    const hasWatts = plug.current_power_mw !== null && plug.current_power_mw !== undefined;
    const wattsText = hasWatts ? `${(plug.current_power_mw / 1000).toFixed(0)} W` : '-- W';
    const wattsHtml = hasWatts ? `${(plug.current_power_mw / 1000).toFixed(0)} W${INFO.icon('w')}` : '-- W';

    card.innerHTML = `
      <div class="plug-card-left">
        <svg class="plug-icon" width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="14" y="4" width="20" height="28" rx="3"/>
          <rect x="18" y="32" width="4" height="6" rx="1"/>
          <rect x="26" y="32" width="4" height="6" rx="1"/>
          <rect x="14" y="40" width="20" height="4" rx="1"/>
          <line x1="17" y1="12" x2="17" y2="20"/>
          <line x1="31" y1="12" x2="31" y2="20"/>
          <line x1="20" y1="14" x2="28" y2="14"/>
          <line x1="20" y1="18" x2="28" y2="18"/>
        </svg>
      </div>
      <div class="plug-card-body">
        <div class="plug-name">${escapeHtml(plug.name)}</div>
        <div class="plug-controls">
          <label class="plug-toggle ${isOn ? 'on' : ''} ${isOff ? 'off' : ''}">
            <input type="checkbox" ${isOn ? 'checked' : ''} ${isUnknown ? 'disabled' : ''} data-name="${escapeHtml(plug.name)}">
            <span class="toggle-slider"></span>
            <span class="toggle-label">${isOn ? 'On' : isOff ? 'Off' : 'Offline'}</span>
          </label>
          <button class="plug-schedule-btn" data-name="${escapeHtml(plug.name)}" title="Schedule" aria-label="Schedule">⏰</button>
          <div class="plug-menu-wrap">
            <button class="plug-menu-btn" title="Options" aria-label="Options">⋮</button>
            <div class="plug-menu-dropdown hidden">
              <button class="plug-menu-edit" data-name="${escapeHtml(plug.name)}">Edit</button>
              <button class="plug-menu-remove" data-name="${escapeHtml(plug.name)}">Remove</button>
            </div>
          </div>
        </div>
      </div>
      <div class="plug-stats">
        <div class="plug-stat ${hasStat ? '' : 'dim'}">${statText}</div>
        <div class="plug-stat-sub ${hasWatts ? '' : 'dim'}">${wattsHtml}</div>
      </div>
    `;

    const toggleInput = card.querySelector('input[type="checkbox"]');
    toggleInput.addEventListener('change', () => togglePlug(toggleInput.dataset.name, toggleInput));

    const scheduleBtn = card.querySelector('.plug-schedule-btn');
    scheduleBtn.addEventListener('click', () => openSchedule(plug.name));

    const menuBtn = card.querySelector('.plug-menu-btn');
    const menuDropdown = card.querySelector('.plug-menu-dropdown');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menuDropdown.classList.contains('hidden');
      closeAllMenus();
      if (!isOpen) menuDropdown.classList.remove('hidden');
    });
    const removeBtn = card.querySelector('.plug-menu-remove');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.classList.add('hidden');
      removePlug(plug.name);
    });

    const editBtn = card.querySelector('.plug-menu-edit');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.classList.add('hidden');
      openEditModal(plug);
    });

    return card;
  }

  function closeAllMenus() {
    document.querySelectorAll('.plug-menu-dropdown').forEach(d => d.classList.add('hidden'));
  }

  function updateCard(plug) {
    const card = document.querySelector(`.plug-card[data-name="${CSS.escape(plug.name)}"]`);
    if (!card) return;

    const isOn = plug.status === true;
    const isOff = plug.status === false;
    const isUnknown = plug.status === null || plug.status === undefined;

    const toggle = card.querySelector('.plug-toggle');
    toggle.className = `plug-toggle ${isOn ? 'on' : ''} ${isOff ? 'off' : ''}`;

    const input = card.querySelector('input[type="checkbox"]');
    input.checked = isOn;
    input.disabled = isUnknown;

    const label = card.querySelector('.toggle-label');
    label.textContent = isOn ? 'On' : isOff ? 'Off' : 'Offline';

    const scheduleBtn = card.querySelector('.plug-schedule-btn');
    scheduleBtn.dataset.name = plug.name;

    const stats = card.querySelector('.plug-stats');
    const hasStat = plug.cost_per_hour !== null && plug.cost_per_hour !== undefined;
    const hasWatts = plug.current_power_mw !== null && plug.current_power_mw !== undefined;
    const statEl = stats.querySelector('.plug-stat');
    statEl.textContent = hasStat ? `$${plug.cost_per_hour.toFixed(2)}/hr` : '--/hr';
    statEl.className = `plug-stat ${hasStat ? '' : 'dim'}`;
    const subEl = stats.querySelector('.plug-stat-sub');
    subEl.textContent = hasWatts ? `${(plug.current_power_mw / 1000).toFixed(0)} W` : '-- W';
    subEl.innerHTML = hasWatts ? `${(plug.current_power_mw / 1000).toFixed(0)} W${INFO.icon('w')}` : '-- W';
    subEl.className = `plug-stat-sub ${hasWatts ? '' : 'dim'}`;

    const menuRemove = card.querySelector('.plug-menu-remove');
    menuRemove.dataset.name = plug.name;
  }

  async function togglePlug(name, input) {
    const card = document.querySelector(`.plug-card[data-name="${CSS.escape(name)}"]`);
    const toggle = card.querySelector('.plug-toggle');
    toggle.className = 'plug-toggle';
    const label = card.querySelector('.toggle-label');
    label.textContent = '...';
    input.disabled = true;

    try {
      const res = await fetch(`${PLUGS_API}/${encodeURIComponent(name)}/toggle`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Toggle failed');
      }
      const data = await res.json();
      const plug = plugsState.find(p => p.name === name);
      if (plug) plug.status = data.status;
      updateCard(plug || { name, status: data.status });
      if (input.checked !== data.status) input.checked = data.status;
    } catch (err) {
      console.error('Toggle error:', err);
      input.checked = !input.checked;
      input.disabled = false;
      const plug = plugsState.find(p => p.name === name);
      if (plug) updateCard(plug);
      else {
        toggle.className = 'plug-toggle off';
        label.textContent = 'Offline';
      }
    }
  }

  function openSchedule(plugName) {
    document.getElementById('schedule-plug-name').textContent = plugName;
    populateTimeSelects();
    loadSchedule(plugName);
    document.getElementById('schedule-modal').classList.remove('hidden');
  }

  function closeSchedule() {
    document.getElementById('schedule-modal').classList.add('hidden');
  }

  function populateTimeSelects() {
    const hours = ['12','1','2','3','4','5','6','7','8','9','10','11'];
    const mins = ['00','15','30','45'];
    ['on','off'].forEach(prefix => {
      const hSel = document.getElementById(`schedule-${prefix}-hour`);
      const mSel = document.getElementById(`schedule-${prefix}-min`);
      const aSel = document.getElementById(`schedule-${prefix}-ampm`);
      if (!hSel.options.length) {
        hours.forEach(h => { const o = new Option(h, h); hSel.add(o); });
        mins.forEach(m => { const o = new Option(m, m); mSel.add(o); });
        aSel.add(new Option('AM', 'AM'));
        aSel.add(new Option('PM', 'PM'));
      }
    });
  }

  function setSelects(prefix, hh24) {
    if (!hh24) return;
    const [hh, mm] = hh24.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    document.getElementById(`schedule-${prefix}-hour`).value = String(h12);
    document.getElementById(`schedule-${prefix}-min`).value = String(mm).padStart(2, '0');
    document.getElementById(`schedule-${prefix}-ampm`).value = ampm;
  }

  function getSelects(prefix) {
    const h = parseInt(document.getElementById(`schedule-${prefix}-hour`).value, 10);
    const m = document.getElementById(`schedule-${prefix}-min`).value;
    const ampm = document.getElementById(`schedule-${prefix}-ampm`).value;
    let hh = h;
    if (ampm === 'AM' && h === 12) hh = 0;
    else if (ampm === 'PM' && h !== 12) hh = h + 12;
    return `${String(hh).padStart(2, '0')}:${m}`;
  }

  async function loadSchedule(plugName) {
    try {
      const res = await fetch(`/api/plugs/${encodeURIComponent(plugName)}/schedule`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.time_on) setSelects('on', data.time_on);
      if (data.time_off) setSelects('off', data.time_off);
      document.getElementById('schedule-rec-on').textContent = data.suggested_on || '--:--';
      document.getElementById('schedule-rec-off').textContent = data.suggested_off || '--:--';
    } catch (err) {
      console.error('Error loading schedule:', err);
    }
  }

  async function saveSchedule() {
    const name = document.getElementById('schedule-plug-name').textContent;
    const time_on = getSelects('on');
    const time_off = getSelects('off');

    try {
      const res = await fetch(`/api/plugs/${encodeURIComponent(name)}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_on, time_off }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to save schedule');
        return;
      }
      closeSchedule();
    } catch (err) {
      alert('Failed to save schedule: ' + err.message);
    }
  }

  async function removePlug(name) {
    if (!confirm(`Remove "${name}"?`)) return;
    try {
      const res = await fetch(`${PLUGS_API}/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to remove plug');
        return;
      }
      await fetchPlugs();
    } catch (err) {
      alert('Failed to remove plug: ' + err.message);
    }
  }

  function fillRecommended() {
    const recOn = document.getElementById('schedule-rec-on').textContent;
    const recOff = document.getElementById('schedule-rec-off').textContent;
    if (recOn && recOn !== '--:--') setSelects('on', recOn);
    if (recOff && recOff !== '--:--') setSelects('off', recOff);
  }

  function openPasswordOnlyModal() {
    document.getElementById('password-only-email').value = '';
    document.getElementById('password-only-pass').value = '';

    fetch('/api/plugs/credentials').then(r => r.json()).then(data => {
      if (data.email) document.getElementById('password-only-email').value = data.email;
    }).catch(() => {});

    document.getElementById('password-modal').classList.remove('hidden');
  }

  function closePasswordModal() {
    document.getElementById('password-modal').classList.add('hidden');
    document.getElementById('password-only-pass').type = 'password';
    document.getElementById('password-only-toggle').textContent = '👁';
  }

  let editingPlugOriginalName = '';

  function openEditModal(plug) {
    editingPlugOriginalName = plug.name;
    document.getElementById('edit-plug-name').value = plug.name;
    document.getElementById('edit-plug-ip').value = plug.ip_address || '';
    document.getElementById('edit-plug-model').value = plug.model || '';
    document.getElementById('edit-plug-modal').classList.remove('hidden');
  }

  function closeEditModal() {
    document.getElementById('edit-plug-modal').classList.add('hidden');
  }

  async function submitEditPlug() {
    const name = document.getElementById('edit-plug-name').value.trim();
    const ip = document.getElementById('edit-plug-ip').value.trim();
    const model = document.getElementById('edit-plug-model').value.trim();

    if (!name) {
      alert('Please enter a name.');
      return;
    }
    if (!ip) {
      alert('Please enter an IP address.');
      return;
    }

    const btn = document.getElementById('edit-plug-submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const res = await fetch(`${PLUGS_API}/${encodeURIComponent(editingPlugOriginalName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ip_address: ip, model }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update plug');
        return;
      }
      closeEditModal();
      await fetchPlugs();
    } catch (err) {
      alert('Failed to update plug: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  async function submitPasswordOnly() {
    const email = document.getElementById('password-only-email').value.trim();
    const password = document.getElementById('password-only-pass').value;

    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }

    const btn = document.getElementById('password-submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const res = await fetch('/api/plugs/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to save credentials');
        btn.disabled = false;
        btn.textContent = 'Save';
        return;
      }
      closePasswordModal();
      await fetchPlugs();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Save';
  }

  function openAddModal() {
    loadCredentials();
    document.getElementById('add-plug-modal').classList.remove('hidden');
  }

  function closeAddModal() {
    document.getElementById('add-plug-modal').classList.add('hidden');
    document.getElementById('tapo-password').type = 'password';
    document.getElementById('tapo-password-toggle').textContent = '👁';
  }

  async function loadCredentials() {
    try {
      const res = await fetch('/api/plugs/credentials');
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          document.getElementById('tapo-email').value = data.email;
        }
      }
    } catch (err) {
      console.error('Error loading credentials:', err);
    }
  }

  async function submitAddPlug() {
    const email = document.getElementById('tapo-email').value.trim();
    const password = document.getElementById('tapo-password').value;
    const ip = document.getElementById('plug-ip').value.trim();
    const model = document.getElementById('plug-model').value.trim();
    const name = document.getElementById('plug-name').value.trim();

    if (!email || !password) {
      alert('Please enter your TAPO account email and password.');
      return;
    }
    if (!ip) {
      alert('Please enter the plug IP address.');
      return;
    }
    if (!name) {
      alert('Please enter a name for the plug.');
      return;
    }

    const submitBtn = document.getElementById('add-plug-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const res = await fetch(PLUGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ip_address: ip, model, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to add plug');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add';
        return;
      }

      closeAddModal();
      document.getElementById('plug-ip').value = '';
      document.getElementById('plug-model').value = '';
      document.getElementById('plug-name').value = '';
      await fetchPlugs();
    } catch (err) {
      alert('Failed to add plug: ' + err.message);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
