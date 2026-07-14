class RecommendationsManager {
    constructor(containerId = 'recs-container') {
        this.container = document.getElementById(containerId);
        this._currentDate = null;
        this._currentCategory = 'general';
        this._dropdown = document.getElementById('recs-category');
        this._bindDropdown();
    }

    _bindDropdown() {
        if (!this._dropdown) return;
        this._dropdown.addEventListener('change', () => {
            this._currentCategory = this._dropdown.value;
            if (this._currentDate) {
                this.loadRecommendations(this._currentDate);
            }
        });
    }

    async loadRecommendations(date) {
        this._currentDate = date;
        if (!this.container) return;
        this.showLoading();

        const category = this._currentCategory;
        try {
            let data;
            if (category === 'general') {
                data = await energyAPI.getGeneralInsights(date);
            } else if (category === 'behaviour') {
                data = await energyAPI.getBehaviourRecs(date);
            } else if (category === 'appliance') {
                data = await energyAPI.getApplianceRecs(date);
            }

            if (!data || !data.recommendations || data.recommendations.length === 0) {
                if (category === 'appliance' && data && data.recommendation) {
                    this.renderApplianceRec(data.recommendation);
                    return;
                }
                if (category === 'appliance' && data && data.error) {
                    this.showError(data.error);
                    return;
                }
                this.showEmpty(category);
                return;
            }
            this.renderCards(data.recommendations);
        } catch (err) {
            if (err.message && err.message.includes('404')) {
                this.showEmpty(category);
            } else {
                this.showError('Failed to load recommendations.');
            }
        }
    }

    renderCards(recommendations) {
        if (!this.container) return;
        const cards = recommendations.map(r => this.createCard(r)).join('');
        this.container.innerHTML = `<div class="recs-list">${cards}</div>`;
    }

    renderApplianceRec(rec) {
        const html = `
            <div class="recs-appliance">
                <div class="rec-card severity-info">
                    <div class="rec-icon">\u{1f50c}</div>
                    <div class="rec-body">
                        <div class="rec-title">${this.escapeHtml(rec.recommended_model || 'Recommended upgrade')}</div>
                        <div class="rec-description">${this.escapeHtml(rec.reasoning || '')}</div>
                    </div>
                </div>
                <div class="appliance-specs">
                    <div class="spec-item">
                        <span class="spec-label">Brand</span>
                        <span class="spec-value">${this.escapeHtml(rec.brand || '—')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Power rating</span>
                        <span class="spec-value">${rec.power_rating_watts || '—'} W</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Est. annual usage</span>
                        <span class="spec-value">${rec.estimated_annual_kwh || '—'} kWh</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Current annual cost</span>
                        <span class="spec-value">$${rec.current_annual_cost_dollars || '—'}</span>
                    </div>
                    <div class="spec-item highlight">
                        <span class="spec-label">Est. annual cost</span>
                        <span class="spec-value">$${rec.estimated_annual_cost_dollars || '—'}</span>
                    </div>
                    <div class="spec-item highlight">
                        <span class="spec-label">Annual savings</span>
                        <span class="spec-value">$${rec.estimated_annual_savings_dollars || '—'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Est. retail price</span>
                        <span class="spec-value">$${rec.estimated_retail_price_aud || '—'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Payback period</span>
                        <span class="spec-value">${rec.payback_period_years || '—'} years</span>
                    </div>
                </div>
            </div>
        `;
        this.container.innerHTML = html;
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

    showEmpty(category) {
        if (!this.container) return;
        const labels = {
            general: 'No general insights available for this date.',
            behaviour: 'No behaviour-specific recommendations for this date.',
            appliance: 'No appliance recommendations available. Fill in your appliance details in the survey.',
        };
        this.container.innerHTML = `
            <div class="recs-state">
                <div class="recs-state-icon">\u{1f4a1}</div>
                <p class="recs-state-text">${labels[category] || 'No recommendations available for this date.'}</p>
            </div>
        `;
    }

    showError(msg) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="recs-state recs-error">
                <p class="recs-state-text">${this.escapeHtml(msg)}</p>
            </div>
        `;
    }
}

const recsManager = new RecommendationsManager();