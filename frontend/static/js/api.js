class EnergyAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${endpoint}${JSON.stringify(options)}`;

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
                credentials: 'include',
                ...options
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!options.method || options.method === 'GET') {
                this.cache.set(cacheKey, { data, timestamp: Date.now() });
            }

            return data;
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getDailyData(date) {
        return this.request(`/api/daily-data/${date}`);
    }

    async getStatistics(date) {
        return this.request(`/api/statistics/${date}`);
    }

    async getDateRange() {
        return this.request('/api/date-range');
    }

    async getRecommendations(date) {
        return this.request(`/api/recommendations/${date}`);
    }

    async getProfile() {
        return this.request('/api/profile');
    }

    async healthCheck() {
        return this.request('/api/health');
    }

    // ── Auth methods ──

    async register(email, password) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async submitSurvey(surveyData) {
        return this.request('/api/auth/survey', {
            method: 'POST',
            body: JSON.stringify({ survey_data: surveyData }),
        });
    }

    async login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async demoLogin() {
        return this.request('/api/auth/demo', { method: 'POST' });
    }

    async logout() {
        return this.request('/api/auth/logout', { method: 'POST' });
    }

    async getSession() {
        return this.request('/api/auth/me');
    }

    async getSurveyQuestions() {
        return this.request('/api/survey/questions');
    }

    clearCache() {
        this.cache.clear();
    }

    async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;
                if (error.message.includes('HTTP 4')) throw error;
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }
        throw lastError;
    }
}

const energyAPI = new EnergyAPI();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnergyAPI;
}
