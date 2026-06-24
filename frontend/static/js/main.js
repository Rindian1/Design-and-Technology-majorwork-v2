/**
 * Main Application Controller
 * Initializes the entire energy monitoring dashboard
 */

class EnergyDashboard {
    constructor() {
        this.isInitialized = false;
        this.errorModal = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Energy Dashboard...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeApp());
            } else {
                this.initializeApp();
            }
            
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    /**
     * Initialize application components
     */
    async initializeApp() {
        try {
            // Setup error modal
            this.setupErrorModal();
            
            // Check API health
            await this.checkAPIHealth();
            
            // Wait for navigation to be initialized
            await this.waitForNavigation();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup global error handlers
            this.setupErrorHandlers();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('Energy Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showError('Failed to initialize the dashboard. Please try again.');
        }
    }

    /**
     * Setup error modal
     */
    setupErrorModal() {
        this.errorModal = document.getElementById('error-modal');
        const closeBtn = document.querySelector('.modal-close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideError();
            });
        }
        
        // Close modal when clicking outside
        if (this.errorModal) {
            this.errorModal.addEventListener('click', (e) => {
                if (e.target === this.errorModal) {
                    this.hideError();
                }
            });
        }
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.errorModal.classList.contains('hidden')) {
                this.hideError();
            }
        });
    }

    /**
     * Check API health
     */
    async checkAPIHealth() {
        try {
            await energyAPI.healthCheck();
            console.log('API health check passed');
        } catch (error) {
            console.error('API health check failed:', error);
            throw new Error('Unable to connect to the server. Please check your connection.');
        }
    }

    /**
     * Wait for navigation to be initialized
     */
    async waitForNavigation() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        while (!navigation && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!navigation) {
            throw new Error('Navigation system failed to initialize');
        }
        
        console.log('Navigation system initialized successfully');
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            // Load data for current date
            const currentDate = navigation.getCurrentDate();
            await chartManager.loadDataForDate(currentDate);
            
            console.log('Initial data loaded successfully');
        } catch (error) {
            console.error('Failed to load initial data:', error);
            // Don't throw error here, as the chart manager will handle the display
        }
    }

    /**
     * Setup global error handlers
     */
    setupErrorHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showError('An unexpected error occurred. Please refresh the page.');
            e.preventDefault();
        });

        // Handle JavaScript errors
        window.addEventListener('error', (e) => {
            console.error('JavaScript error:', e.error);
            this.showError('A script error occurred. Some features may not work correctly.');
        });
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.errorModal) {
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = message;
            }
            
            this.errorModal.classList.remove('hidden');
            this.errorModal.setAttribute('aria-hidden', 'false');
            
            // Focus the modal for accessibility
            this.errorModal.focus();
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        if (this.errorModal) {
            this.errorModal.classList.add('hidden');
            this.errorModal.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', options);
    }

    /**
     * Format number with locale
     */
    formatNumber(number) {
        return number ? number.toLocaleString() : '--';
    }

    /**
     * Check if application is initialized
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            currentDate: navigation ? navigation.getCurrentDate() : null,
            currentTab: navigation ? navigation.getCurrentTab() : null,
            hasData: chartManager ? !!chartManager.getCurrentData() : false
        };
    }

    /**
     * Refresh application data
     */
    async refresh() {
        try {
            // Clear API cache
            energyAPI.clearCache();
            
            // Reload current data
            await chartManager.refreshChart();
            
            console.log('Application refreshed successfully');
        } catch (error) {
            console.error('Failed to refresh application:', error);
            this.showError('Failed to refresh data. Please try again.');
        }
    }

    /**
     * Export current chart (placeholder for future feature)
     */
    exportChart() {
        if (chartManager) {
            chartManager.exportChart();
        }
    }

    /**
     * Print current view (placeholder for future feature)
     */
    printView() {
        window.print();
    }
}

// Utility functions
window.utils = {
    formatDate: (dateString) => {
        const date = new Date(dateString + 'T00:00:00');
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', options);
    },
    
    formatNumber: (number) => {
        return number ? number.toLocaleString() : '--';
    },
    
    formatWatts: (watts) => {
        if (!watts) return '--';
        if (watts >= 1000) {
            return `${(watts / 1000).toFixed(1)} kW`;
        }
        return `${watts.toLocaleString()} W`;
    },
    
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Create global dashboard instance
const dashboard = new EnergyDashboard();

// Make dashboard available globally for debugging
window.dashboard = dashboard;
window.energyAPI = energyAPI;
window.navigation = navigation;
window.chartManager = chartManager;

// Add print styles
const printStyles = document.createElement('style');
printStyles.textContent = `
    @media print {
        .header, .footer, .nav, .nav-arrow, .btn {
            display: none !important;
        }
        
        .main {
            padding: 0 !important;
        }
        
        .chart-container {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
        }
        
        .stat-card {
            break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
        }
    }
`;
document.head.appendChild(printStyles);
