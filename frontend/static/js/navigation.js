/**
 * Navigation System for Energy Monitoring Dashboard
 * Handles date navigation, tab switching, and URL management
 */

class NavigationManager {
    constructor() {
        this.currentDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
        this.dateRange = null;
        this.currentTab = 'graph';
        this.maxDate = new Date().toISOString().split('T')[0]; // Today
        this.eventListenersSetup = false;
        this._ready = new Promise(resolve => { this._resolveReady = resolve; });
        this._readyResolved = false;
        
        this.init();
    }

    /**
     * Initialize navigation system
     */
    async init() {
        const authPages = ['/login', '/register'];
        const isAuthPage = authPages.includes(window.location.pathname);

        try {
            this.setupEventListeners();

            if (isAuthPage) {
                this._resolveReady();
                this._readyResolved = true;
                return;
            }

            // Load date range from API
            await this.loadDateRange();
            
            // Parse URL parameters
            this.parseURLParams();
            
            // Update UI
            this.updateDateDisplay();
            this.updateNavigationButtons();
            this.updateTabDisplay();
            
            // Set initial URL
            this.updateURL();
            
        } catch (error) {
            console.error('Failed to initialize navigation:', error);
            // Don't show error immediately - try to continue with fallback
            // this.showError('Failed to initialize navigation system');
            
            // Ensure event listeners are set up even if API fails
            if (!this.eventListenersSetup) {
                this.setupEventListeners();
            }
            
            // Try to continue with fallback date range
            try {
                this.parseURLParams();
                this.updateDateDisplay();
                this.updateNavigationButtons();
                this.updateTabDisplay();
                this.updateURL();
            } catch (fallbackError) {
                console.error('Fallback initialization also failed:', fallbackError);
                this.showError('Failed to initialize navigation system');
            }
        } finally {
            this._resolveReady();
            this._readyResolved = true;
        }
    }

    /**
     * Load available date range from API
     */
    async loadDateRange() {
        try {
            this.dateRange = await energyAPI.getDateRange();
            if (this.dateRange) {
                // Use the actual data range as max
                this.maxDate = this.dateRange.latest;
                // Ensure current date is within range
                if (this.currentDate > this.dateRange.latest) {
                    this.currentDate = this.dateRange.latest;
                } else if (this.currentDate < this.dateRange.earliest) {
                    this.currentDate = this.dateRange.earliest;
                }
            }
        } catch (error) {
            console.error('Failed to load date range:', error);
            // Fallback to 2 weeks from today
            const today = new Date();
            const twoWeeksAgo = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
            
            this.dateRange = {
                earliest: twoWeeksAgo.toISOString().split('T')[0],
                latest: today.toISOString().split('T')[0]
            };
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Prevent duplicate setup
        if (this.eventListenersSetup) {
            return;
        }
        
        // Navigation arrows
        const prevBtn = document.getElementById('prev-day');
        const nextBtn = document.getElementById('next-day');
        
        console.log('Setting up navigation listeners...');
        console.log('prevBtn found:', !!prevBtn);
        console.log('nextBtn found:', !!nextBtn);
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log('Previous button clicked!');
                this.navigatePreviousDay();
            });
            console.log('Previous button listener attached');
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log('Next button clicked!');
                this.navigateNextDay();
            });
            console.log('Next button listener attached');
        }

        // Tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.navigatePreviousDay();
            } else if (e.key === 'ArrowRight') {
                this.navigateNextDay();
            }
        });

        // Browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                this.currentDate = e.state.date;
                this.currentTab = e.state.tab || 'graph';
                this.updateDateDisplay();
                this.updateNavigationButtons();
                this.updateTabDisplay();
                
                // Trigger data reload
                window.dispatchEvent(new CustomEvent('dateChanged', { 
                    detail: { date: this.currentDate } 
                }));
            }
        });

        // Touch gestures for mobile
        this.setupTouchGestures();
        
        // Mark as setup complete
        this.eventListenersSetup = true;
    }

    /**
     * Setup touch gestures for mobile navigation
     */
    setupTouchGestures() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    }

    /**
     * Handle swipe gestures
     */
    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next day
                this.navigateNextDay();
            } else {
                // Swipe right - previous day
                this.navigatePreviousDay();
            }
        }
    }

    /**
     * Navigate to previous day
     */
    navigatePreviousDay() {
        console.log('navigatePreviousDay called, current date:', this.currentDate);
        
        const newDate = new Date(this.currentDate);
        newDate.setDate(newDate.getDate() - 1);
        
        const newDateString = newDate.toISOString().split('T')[0];
        console.log('Attempting to navigate to previous date:', newDateString);
        
        if (this.canNavigateToDate(newDateString)) {
            console.log('Can navigate to previous date, updating...');
            this.currentDate = newDateString;
            this.updateDateDisplay();
            this.updateNavigationButtons();
            this.updateURL();
            
            // Trigger data reload
            window.dispatchEvent(new CustomEvent('dateChanged', { 
                detail: { date: this.currentDate } 
            }));
        } else {
            console.log('Cannot navigate to previous date:', newDateString);
        }
    }

    /**
     * Navigate to next day
     */
    navigateNextDay() {
        console.log('navigateNextDay called, current date:', this.currentDate);
        
        const newDate = new Date(this.currentDate);
        newDate.setDate(newDate.getDate() + 1);
        
        const newDateString = newDate.toISOString().split('T')[0];
        console.log('Attempting to navigate to next date:', newDateString);
        
        if (this.canNavigateToDate(newDateString)) {
            console.log('Can navigate to next date, updating...');
            this.currentDate = newDateString;
            this.updateDateDisplay();
            this.updateNavigationButtons();
            this.updateURL();
            
            // Trigger data reload
            window.dispatchEvent(new CustomEvent('dateChanged', { 
                detail: { date: this.currentDate } 
            }));
        } else {
            console.log('Cannot navigate to next date:', newDateString);
        }
    }

    /**
     * Check if navigation to date is allowed
     */
    canNavigateToDate(dateString) {
        // If no date range is available, allow reasonable navigation
        if (!this.dateRange) {
            // Allow navigation within reasonable range (2 weeks back from today)
            const targetDate = new Date(dateString + 'T00:00:00');
            const today = new Date();
            const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
            
            return targetDate >= twoWeeksAgo && targetDate <= today;
        }
        
        return dateString >= this.dateRange.earliest && 
               dateString <= this.dateRange.latest && 
               dateString <= this.maxDate;
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        if (this.currentTab === tabName) return;
        
        this.currentTab = tabName;
        this.updateTabDisplay();
        this.updateURL();
        
        // Trigger tab change event
        window.dispatchEvent(new CustomEvent('tabChanged', { 
            detail: { tab: this.currentTab } 
        }));
    }

    /**
     * Update date display
     */
    updateDateDisplay() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            const date = new Date(this.currentDate + 'T00:00:00');
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            dateElement.textContent = date.toLocaleDateString('en-US', options);
        }
    }

    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-day');
        const nextBtn = document.getElementById('next-day');
        
        if (prevBtn) {
            const prevDate = new Date(this.currentDate + 'T00:00:00');
            prevDate.setDate(prevDate.getDate() - 1);
            prevBtn.disabled = !this.canNavigateToDate(prevDate.toISOString().split('T')[0]);
        }
        
        if (nextBtn) {
            const nextDate = new Date(this.currentDate + 'T00:00:00');
            nextDate.setDate(nextDate.getDate() + 1);
            nextBtn.disabled = !this.canNavigateToDate(nextDate.toISOString().split('T')[0]);
        }
    }

    /**
     * Update tab display
     */
    updateTabDisplay() {
        // Update button states
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            const tabName = btn.getAttribute('data-tab');
            const isActive = tabName === this.currentTab;
            
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        // Update panel visibility
        const panels = document.querySelectorAll('.tab-panel');
        panels.forEach(panel => {
            const panelId = panel.id;
            const isActive = panelId === `${this.currentTab}-panel`;
            
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    }

    /**
     * Parse URL parameters
     */
    parseURLParams() {
        const params = new URLSearchParams(window.location.search);
        
        const dateParam = params.get('date');
        if (dateParam && this.isValidDate(dateParam)) {
            this.currentDate = dateParam;
        }
        
        const tabParam = params.get('tab');
        if (tabParam && ['graph', 'general', 'appliance'].includes(tabParam)) {
            this.currentTab = tabParam;
        }
    }

    /**
     * Validate date string
     */
    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && 
               dateString.match(/^\d{4}-\d{2}-\d{2}$/);
    }

    /**
     * Update URL with current state
     */
    updateURL() {
        const params = new URLSearchParams();
        params.set('date', this.currentDate);
        params.set('tab', this.currentTab);
        
        const newURL = `${window.location.pathname}?${params.toString()}`;
        const state = { date: this.currentDate, tab: this.currentTab };
        
        window.history.pushState(state, '', newURL);
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorModal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');
        
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        
        if (errorModal) {
            errorModal.classList.remove('hidden');
            errorModal.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Get current date
     */
    getCurrentDate() {
        return this.currentDate;
    }

    /**
     * Get current tab
     */
    getCurrentTab() {
        return this.currentTab;
    }

    /**
     * Navigate to specific date
     */
    navigateToDate(dateString) {
        if (this.isValidDate(dateString) && this.canNavigateToDate(dateString)) {
            this.currentDate = dateString;
            this.updateDateDisplay();
            this.updateNavigationButtons();
            this.updateURL();
            
            window.dispatchEvent(new CustomEvent('dateChanged', { 
                detail: { date: this.currentDate } 
            }));
        }
    }
}

// Create global navigation instance - initialize when DOM is ready
let navigation = null;

// Initialize navigation when DOM is ready
function initializeNavigation() {
    if (!navigation && document.getElementById('prev-day') && document.getElementById('next-day')) {
        navigation = new NavigationManager();
    }
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
    initializeNavigation();
}
