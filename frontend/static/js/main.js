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
}

new EnergyDashboard();
