/**
 * API Client for Energy Monitoring Dashboard
 * Handles all HTTP requests to the Flask backend
 */

class EnergyAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Generic HTTP request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${endpoint}${JSON.stringify(options)}`;

        // Check cache first for GET requests
        if (!options.method || options.method === 'GET') {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache successful GET requests
            if (!options.method || options.method === 'GET') {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }

            return data;

        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Get daily energy data for a specific date
     */
    async getDailyData(date) {
        return this.request(`/api/daily-data/${date}`);
    }

    /**
     * Get statistics for a specific date
     */
    async getStatistics(date) {
        return this.request(`/api/statistics/${date}`);
    }

    /**
     * Get available date range
     */
    async getDateRange() {
        return this.request('/api/date-range');
    }

    /**
     * Get recommendations for a specific date
     */
    async getRecommendations(date) {
        return this.request(`/api/recommendations/${date}`);
    }

    /**
     * Health check
     */
    async healthCheck() {
        return this.request('/api/health');
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Retry mechanism for failed requests
     */
    async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx)
                if (error.message.includes('HTTP 4')) {
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }

        throw lastError;
    }
}

// Create global API instance
const energyAPI = new EnergyAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnergyAPI;
}
