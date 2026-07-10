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
    this.setupErrorModal();
    await this.waitForNavigation();
    this.listenForDateChanges();
    this.setupErrorHandlers();
    await this.loadInitialData();
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
      if (navigation.getCurrentTab() === 'recommendations') {
        recsManager.loadRecommendations(date);
      }
    });
    window.addEventListener('tabChanged', (e) => {
      if (e.detail.tab === 'recommendations') {
        const date = navigation.getCurrentDate();
        recsManager.loadRecommendations(date);
      }
    });
  }

  async loadInitialData() {
    try {
      const date = navigation.getCurrentDate();
      gaugeManager.loadDataForDate(date);
      if (navigation.getCurrentTab() === 'recommendations') {
        recsManager.loadRecommendations(date);
      }
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
