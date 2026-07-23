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
    const ffTime = document.getElementById('ff-time');
    if (!ffBtn) return;

    this.ff = { running: false, timer: null, date: null, hour: 0, dayData: null };

    ffBtn.addEventListener('click', () => {
      if (this.ff.running) {
        this._stopFF();
      } else {
        this._startFF();
      }
    });
  }

  _startFF() {
    const ffBtn = document.getElementById('ff-btn');
    const ffTime = document.getElementById('ff-time');

    this.ff.date = navigation.getCurrentDate();
    this.ff.hour = 0;
    this.ff.running = true;

    ffBtn.classList.add('running');
    ffBtn.innerHTML = '&#9646;&#9646;';
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
    ffBtn.innerHTML = '&#9654;';
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
    if (!el) return;
    const d = new Date(date + 'T00:00:00');
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const h = hour % 12 || 12;
    const ap = hour < 12 ? 'am' : 'pm';
    el.textContent = `${mon} ${day} \u2014 ${h}${ap}`;
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

new EnergyDashboard();
