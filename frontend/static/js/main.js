class EnergyDashboard {
  constructor() {
    this.init();
  }

  async init() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize());
      } else {
        this.initialize();
      }
    } catch (err) {
      console.error('Dashboard init failed:', err);
    }
  }

  async initialize() {
    this.setupThemeToggle();

    const authPages = ['/login', '/register', '/survey'];
    if (authPages.includes(window.location.pathname)) {
      return;
    }

    const session = await authManager.checkSession();
    if (!session) {
      window.location.href = '/login';
      return;
    }

    try {
      const profile = await energyAPI.getProfile();
      if (profile && gaugeManager.setConfig) {
        gaugeManager.setConfig(profile.budget_kwh, profile.rate_per_kwh, {
          has_tou: profile.has_tou,
          peak_hours: profile.peak_hours,
          offpeak_hours: profile.offpeak_hours,
          shoulder_hours: profile.shoulder_hours
        });
      }
    } catch (err) {
      console.error('Failed to load profile config:', err);
    }

    this.setupErrorModal();
    this.setupUserMenu(session);
    await this.waitForNavigation();
    this.listenForDateChanges();
    this.setupErrorHandlers();
    this.setupFastForward();
    await this.loadInitialData();
  }

  setupUserMenu(session) {
    const menu = document.getElementById('user-menu');
    const emailDisplay = document.getElementById('user-email-display');
    if (menu && emailDisplay && session && session.user) {
      emailDisplay.textContent = session.user.email;
      menu.style.display = 'block';
    }

    const menuBtn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', () => {
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });
    }

    document.getElementById('edit-preferences-btn')?.addEventListener('click', () => {
      window.location.href = '/survey';
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await authManager.logout();
      window.location.href = '/login';
    });
  }

  setupErrorModal() {
    const modal = document.getElementById('error-modal');
    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    });
  }

  async waitForNavigation() {
    let attempts = 0;
    while (typeof navigation === 'undefined' && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (typeof navigation === 'undefined') {
      throw new Error('Navigation system failed to initialize');
    }
    await navigation._ready;
  }

  listenForDateChanges() {
    window.addEventListener('dateChanged', (e) => {
      const { date } = e.detail;
      gaugeManager.loadDataForDate(date);
      this._loadTabContent(date);
    });
    window.addEventListener('tabChanged', (e) => {
      const date = navigation.getCurrentDate();
      this._loadTabContent(date, e.detail.tab);
      if (this.ff.running) this._stopFF();
      if (this._dayFF.running) this._stopDayFF(true);
      if (recsManager._ff.running) recsManager._stopFF();
    });
  }

  _loadTabContent(date, tab) {
    const activeTab = tab || navigation.getCurrentTab();
    if (activeTab === 'general') {
      recsManager.loadGeneralInsights(date);
    } else if (activeTab === 'appliance') {
      recsManager.loadApplianceRecs(date);
    } else if (activeTab === 'goals') {
      goalsManager.loadGoals();
    }
  }

  async loadInitialData() {
    try {
      const date = navigation.getCurrentDate();
      gaugeManager.loadDataForDate(date);
      this._loadTabContent(date);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  setupErrorHandlers() {
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
      e.preventDefault();
    });
    window.addEventListener('error', (e) => {
      console.error('JavaScript error:', e.error);
    });
  }

  setupFastForward() {
    const ffBtn = document.getElementById('ff-btn');
    const ffDayBtn = document.getElementById('ff-day-btn');
    const ffTime = document.getElementById('ff-time');
    if (!ffBtn) return;

    this.ff = { running: false, timer: null, date: null, hour: 0, dayData: null };
    this._dayFF = { running: false, timer: null, date: null, dateBeforeFF: null, lingerTimer: null, ticking: false, claimableStop: false };

    if (ffDayBtn) {
      ffDayBtn.addEventListener('click', () => {
        if (this._dayFF.running) {
          this._stopDayFF(true);
        } else {
          if (this.ff.running) this._stopFF();
          if (recsManager._ff.running) recsManager._stopFF();
          this._startDayFF();
        }
      });
    }

    ffBtn.addEventListener('click', () => {
      const tab = navigation.getCurrentTab();
      if (tab === 'general') {
        if (recsManager._ff.running) {
          recsManager._stopFF();
        } else {
          if (this.ff.running) this._stopFF();
          if (this._dayFF.running) this._stopDayFF(true);
          recsManager._startFF();
        }
      } else if (tab === 'goals') {
        if (this._dayFF.running) {
          this._stopDayFF(true);
        } else {
          if (this.ff.running) this._stopFF();
          if (recsManager._ff.running) recsManager._stopFF();
          this._startDayFF();
        }
      } else if (tab === 'graph') {
        if (this.ff.running) {
          this._stopFF();
        } else {
          if (recsManager._ff.running) recsManager._stopFF();
          if (this._dayFF.running) this._stopDayFF(true);
          this._startFF();
        }
      }
    });
  }

  async _startDayFF() {
    if (this._dayFF.running) return;

    const ffDayBtn = document.getElementById('ff-day-btn');
    const ffTime = document.getElementById('ff-time');

    if (!this._dayFF.claimableStop) {
      try {
        await energyAPI.request('/api/goals/demo-init', {
          method: 'POST',
          body: JSON.stringify({ date: navigation.currentDate }),
        });
      } catch (e) { /* proceed even if demo-init fails */ }
    }
    this._dayFF.claimableStop = false;

    if (typeof goalsManager !== 'undefined') {
      goalsManager._ff.running = true;
      goalsManager._prevFilled = {};
      goalsManager._prevGoalStates = null;
    }

    this._dayFF.dateBeforeFF = navigation.currentDate;
    this._dayFF.date = navigation.currentDate;
    this._dayFF.running = true;
    energyAPI.clearCache();

    if (ffDayBtn) ffDayBtn.classList.add('running');
    if (ffTime) ffTime.classList.remove('hidden');

    this._updateDayFFDate(this._dayFF.date);
    this._tickDayFF();
    this._dayFF.timer = setInterval(() => this._tickDayFF(), 1000);
  }

  _stopDayFF(manual = true) {
    clearInterval(this._dayFF.timer);
    clearTimeout(this._dayFF.lingerTimer);
    this._dayFF.running = false;
    this._dayFF.timer = null;
    this._dayFF.ticking = false;

    if (typeof goalsManager !== 'undefined') goalsManager._ff.running = false;

    const ffDayBtn = document.getElementById('ff-day-btn');
    const ffTime = document.getElementById('ff-time');
    if (ffDayBtn) ffDayBtn.classList.remove('running');
    if (ffTime) ffTime.classList.add('hidden');

    if (!manual && this._dayFF.dateBeforeFF) {
      this._dayFF.lingerTimer = setTimeout(() => {
        if (navigation) {
          navigation.navigateToDate(this._dayFF.dateBeforeFF);
        }
      }, 3000);
    }
  }

  async _tickDayFF() {
    if (!this._dayFF.running || this._dayFF.ticking) return;
    this._dayFF.ticking = true;

    try {
      const { date } = this._dayFF;
      if (!date) { this._stopDayFF(); return; }

      const range = await energyAPI.getDateRange().catch(() => null);
      if (!range || date > range.latest) { this._stopDayFF(false); return; }
      if (!this._dayFF.running) return;

      const activeTab = navigation.getCurrentTab();
      if (activeTab === 'graph') {
        try {
          const [chartData, stats] = await Promise.all([
            energyAPI.getDailyData(date),
            energyAPI.getStatistics(date)
          ]);
          gaugeManager.currentData = chartData;
          gaugeManager.currentStats = stats;
          gaugeManager.render();
        } catch (e) { /* skip graph render on error */ }
      }

      if (typeof goalsManager !== 'undefined' && this._dayFF.running) {
        try {
          energyAPI.clearCache();
          const data = await energyAPI.request(`/api/goals?date=${date}&_=${Date.now()}`);
          if (!this._dayFF.running) return;
          goalsManager._renderFF(data);
          goalsManager._checkNotifications(data.goals || []);
          if (data.goals && data.goals.some(g => g.pending_claim)) {
            this._dayFF.claimableStop = true;
            this._stopDayFF(true);
            return;
          }
        } catch (e) {
          console.error('Day FF goals tick failed:', e);
        }
      }

      this._updateDayFFDate(date);

      const ffTime = document.getElementById('ff-time');
      if (ffTime) {
        const d = new Date(date + 'T00:00:00');
        ffTime.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }

      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      this._dayFF.date = next.toISOString().split('T')[0];
    } finally {
      this._dayFF.ticking = false;
    }
  }

  _updateDayFFDate(dateStr) {
    if (navigation) {
      navigation.currentDate = dateStr;
      navigation.updateDateDisplay();
      navigation.updateNavigationButtons();
    }
  }

  _startFF() {
    if (typeof goalsManager !== 'undefined' && goalsManager._ff?.running) goalsManager._stopFF(true);
    if (recsManager._ff.running) recsManager._stopFF();

    const ffBtn = document.getElementById('ff-btn');
    const ffTime = document.getElementById('ff-time');

    this.ff.date = navigation.getCurrentDate();
    this.ff.hour = 0;
    this.ff.running = true;

    ffBtn.classList.add('running');
    ffTime.classList.remove('hidden');

    energyAPI.clearCache();
    this._fetchFFDay().then(() => {
      this.ff.timer = setInterval(() => this._tickFF(), 250);
    });
  }

  _stopFF() {
    const ffBtn = document.getElementById('ff-btn');
    const ffTime = document.getElementById('ff-time');

    clearInterval(this.ff.timer);
    this.ff.running = false;
    this.ff.timer = null;

    ffBtn.classList.remove('running');
    ffTime.classList.add('hidden');

    gaugeManager.loadDataForDate(navigation.getCurrentDate());
  }

  async _fetchFFDay() {
    try {
      const [chartData, stats] = await Promise.all([
        energyAPI.getDailyData(this.ff.date),
        energyAPI.getStatistics(this.ff.date)
      ]);
      this.ff.dayData = { chartData, stats };
    } catch (err) {
      this.ff.dayData = null;
    }
  }

  _tickFF() {
    const { hour, dayData } = this.ff;

    if (dayData) {
      const values = dayData.chartData.values || [];
      const sliced = values.slice(0, hour + 1);
      const partial = this._partialStats(sliced, dayData.stats);
      gaugeManager.renderPartial(sliced, partial);
    }

    this._updateFFTime(this.ff.date, hour);

    this.ff.hour++;
    if (this.ff.hour > 23) {
      this.ff.hour = 0;
      this.ff.dayData = null;
      const next = new Date(this.ff.date);
      next.setDate(next.getDate() + 1);
      const nextStr = next.toISOString().split('T')[0];
      if (nextStr > navigation.dateRange.latest) {
        this._stopFF();
        return;
      }
      this.ff.date = nextStr;
      energyAPI.clearCache();
      this._fetchFFDay();
    }
  }

  _partialStats(sliced, fullStats) {
    if (!sliced || !sliced.length) {
      return { count: 0, total: 0, peak: 0, average: 0, cost: 0 };
    }
    const total = sliced.reduce((s, v) => s + v, 0);
    const peak = Math.max(...sliced);
    const average = total / sliced.length;
    let cost = 0;
    if (fullStats && fullStats.total > 0) {
      cost = (total / fullStats.total) * (fullStats.cost || 0);
    } else {
      cost = (total / 1000) * gaugeManager.ratePerKwh;
    }
    return { count: sliced.length, total, peak, average, cost };
  }

  _updateFFTime(date, hour) {
    const el = document.getElementById('ff-time');
    if (el) {
      const d = new Date(date + 'T00:00:00');
      const mon = d.toLocaleString('en-US', { month: 'short' });
      const day = d.getDate();
      const h = hour % 12 || 12;
      const ap = hour < 12 ? 'am' : 'pm';
      el.textContent = `${mon} ${day} \u2014 ${h}${ap}`;
    }
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
      const d = new Date(date + 'T00:00:00');
      dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  setupThemeToggle() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.classList.add('light-mode');
      btn.textContent = 'Dark Mode';
    } else {
      btn.textContent = 'Light Mode';
    }

    btn.addEventListener('click', () => {
      const isLight = !document.documentElement.classList.contains('light-mode');
      document.documentElement.classList.toggle('light-mode', isLight);
      btn.textContent = isLight ? 'Dark Mode' : 'Light Mode';
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
  }
}

window.dashboard = new EnergyDashboard();
