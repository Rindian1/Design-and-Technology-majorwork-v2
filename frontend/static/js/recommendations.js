class RecommendationsManager {
    constructor(containerId = 'recs-container') {
        this.container = document.getElementById(containerId);
        this._currentDate = null;
    }

    async loadRecommendations(date) {
        this._currentDate = date;
        if (!this.container) return;
        this.showLoading();
        try {
            const data = await energyAPI.getRecommendations(date);
            if (!data || !data.recommendations || data.recommendations.length === 0) {
                this.showEmpty();
                return;
            }
            this.renderRecommendations(data.recommendations);
        } catch (err) {
            if (err.message && err.message.includes('404')) {
                this.showEmpty();
            } else {
                this.showError('Failed to load recommendations.');
            }
        }
    }

    renderRecommendations(recommendations) {
        if (!this.container) return;
        const cards = recommendations.map(r => this.createCard(r)).join('');
        this.container.innerHTML = `<div class="recs-list">${cards}</div>`;
    }

    createCard(rec) {
        const severity = rec.severity || 'info';
        const icon = rec.icon || '\u{1f4a1}';
        const title = this.escapeHtml(rec.title || '');
        const description = this.escapeHtml(rec.description || '');
        return `
            <div class="rec-card severity-${severity}">
                <div class="rec-icon">${icon}</div>
                <div class="rec-body">
                    <div class="rec-title">${title}</div>
                    <div class="rec-description">${description}</div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="recs-state">
                <div class="loading-spinner"></div>
                <p class="recs-state-text">Loading recommendations...</p>
            </div>
        `;
    }

    showEmpty() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="recs-state">
                <div class="recs-state-icon">\u{1f4a1}</div>
                <p class="recs-state-text">No recommendations available for this date.</p>
            </div>
        `;
    }

    showError(msg) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="recs-state recs-error">
                <p class="recs-state-text">${msg}</p>
            </div>
        `;
    }
}

const recsManager = new RecommendationsManager();
