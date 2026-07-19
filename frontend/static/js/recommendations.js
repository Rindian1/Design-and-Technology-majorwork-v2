class RecommendationsManager {
    constructor() {
        this._generalContainer = document.getElementById('general-container');
        this._applianceContainer = document.getElementById('appliance-container');
        this._chartInstance = null;
    }

    async loadGeneralInsights(date) {
        if (!this._generalContainer) return;
        this._showLoading(this._generalContainer);

        try {
            const data = await energyAPI.getGeneralDetailed(date);
            if (!data || !data.weekly_spending || data.weekly_spending.length === 0) {
                this._showEmpty(this._generalContainer, 'No data available for this date.');
                return;
            }
            this._renderGeneralDetailed(data);
        } catch (err) {
            if (err.message && err.message.includes('404')) {
                this._showEmpty(this._generalContainer, 'No general insights available for this date.');
            } else {
                this._showError(this._generalContainer, 'Failed to load general insights.');
            }
        }
    }

    async loadApplianceRecs(date) {
        if (!this._applianceContainer) return;
        this._showLoading(this._applianceContainer);

        try {
            const data = await energyAPI.getApplianceRecs(date);
            if (data && data.recommendations && data.recommendations.length > 0) {
                this._renderApplianceRecs(data.recommendations);
                return;
            }
            if (data && data.error) {
                this._showError(this._applianceContainer, data.error);
                return;
            }
            this._showEmpty(this._applianceContainer, 'No appliance recommendations available. Fill in your appliance details in the survey.');
        } catch (err) {
            if (err.message && err.message.includes('404')) {
                this._showEmpty(this._applianceContainer, 'No appliance recommendations available.');
            } else {
                this._showError(this._applianceContainer, 'Failed to load recommendations.');
            }
        }
    }

    /* ── Helpers ── */

    _formatHour(h) {
        if (h === 0 || h === 24) return '12a';
        if (h === 12) return '12p';
        return h < 12 ? h + 'a' : (h - 12) + 'p';
    }

    _formatTimeRange(r) {
        return this._formatHour(r.start) + '\u2013' + this._formatHour(r.end);
    }

    _getTariffPeriod(hour, peakHours, offpeakHours, shoulderHours) {
        const inRange = (h, ranges) => ranges.some(r => {
            const s = r.start, e = r.end;
            return s < e ? s <= h && h < e : h >= s || h < e;
        });
        if (inRange(hour, peakHours)) return 'peak';
        if (inRange(hour, offpeakHours)) return 'offpeak';
        if (inRange(hour, shoulderHours)) return 'shoulder';
        return 'offpeak';
    }

    _buildLegendItems(peakHours, offpeakHours, shoulderHours) {
        const fmt = (ranges) => ranges.map(r => this._formatTimeRange(r)).join(', ');
        const items = [];
        if (peakHours.length) items.push({ cls: 'peak', label: 'Peak (' + fmt(peakHours) + ')' });
        if (shoulderHours.length) items.push({ cls: 'shoulder', label: 'Shoulder (' + fmt(shoulderHours) + ')' });
        if (offpeakHours.length) items.push({ cls: 'off', label: 'Off-Peak (' + fmt(offpeakHours) + ')' });
        if (!peakHours.length && !shoulderHours.length) {
            items.push({ cls: 'off', label: 'Flat Rate' });
        }
        return items;
    }

    /* ── Render ── */

    _renderGeneralDetailed(data) {
        const todayKwh = data.today_kwh || 0;
        const todayCost = data.today_cost || 0;
        const hourly = data.hourly_records || [];
        const peakHours = data.peak_hours || [];
        const offpeakHours = data.offpeak_hours || [];
        const shoulderHours = data.shoulder_hours || [];

        const legendItems = this._buildLegendItems(peakHours, offpeakHours, shoulderHours);

        const dialFillPct = data.budget_kwh > 0 ? Math.min(todayKwh / data.budget_kwh, 1) : 0;
        const dashOffset = 440 - dialFillPct * 440;

        const peakKw = hourly.length > 0 ? Math.max(...hourly.map(r => r.watt_usage)) / 1000 : 0;

        this._generalContainer.innerHTML = `
            <div class="general-insights">
                <h1 class="gi-title">General Insights</h1>

                <div class="gi-dial-section">
                    <div class="gi-dial-wrap">
                        <svg class="gi-dial-svg" viewBox="0 0 340 200" role="img" aria-label="Gauge showing today's energy spending of $${todayCost}">
                            <defs>
                                <linearGradient id="giDialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stop-color="#00e676"/>
                                    <stop offset="40%" stop-color="#ffab00"/>
                                    <stop offset="100%" stop-color="#ff5252"/>
                                </linearGradient>
                            </defs>
                            <path class="gi-dial-bg" d="M 30 175 A 140 140 0 0 1 310 175"/>
                            <path class="gi-dial-fill" d="M 30 175 A 140 140 0 0 1 310 175" stroke-dashoffset="${dashOffset}"/>
                        </svg>
                        <div class="gi-dial-centre">
                            <div class="gi-dial-label-top">Current spending</div>
                            <div class="gi-dial-value-row">
                                <span class="gi-dial-value">$${todayCost}</span>
                            </div>
                            <div class="gi-dial-divider"></div>
                            <div class="gi-dial-today-label">Energy usage</div>
                            <div class="gi-dial-cost">${todayKwh} kWh</div>
                        </div>
                    </div>
                </div>

                <div class="gi-chart-section">
                    <div class="gi-chart-wrap">
                        <canvas id="gi-hourly-chart" role="img" aria-label="Hourly energy usage bar chart coloured by tariff period"></canvas>
                    </div>
                </div>

                <div class="gi-legend">
                    ${legendItems.map(item => `
                        <span class="gi-legend-item"><span class="gi-dot ${item.cls}"></span> ${item.label}</span>
                    `).join('')}
                </div>

                <div class="gi-mini-stats">
                    <div class="gi-mini-stat">
                        <div class="gi-mini-lbl">Total Today</div>
                        <div class="gi-mini-val">${todayKwh} <small>kWh</small></div>
                    </div>
                    <div class="gi-mini-stat">
                        <div class="gi-mini-lbl">Today's Cost</div>
                        <div class="gi-mini-val">$${todayCost}</div>
                    </div>
                    <div class="gi-mini-stat">
                        <div class="gi-mini-lbl">Peak Demand</div>
                        <div class="gi-mini-val">${peakKw.toFixed(2)} <small>kW</small></div>
                    </div>
                    <div class="gi-mini-stat">
                        <div class="gi-mini-lbl">vs Budget</div>
                        <div class="gi-mini-val" style="color:${dialFillPct > 0.7 ? '#ff5252' : dialFillPct > 0.4 ? '#ffab00' : '#00e676'}">${Math.round(dialFillPct * 100)}%</div>
                    </div>
                </div>
            </div>
        `;

        this._initHourlyChart(hourly, peakHours, offpeakHours, shoulderHours);
    }

    _initHourlyChart(hourlyRecords, peakHours, offpeakHours, shoulderHours) {
        if (this._chartInstance) {
            this._chartInstance.destroy();
            this._chartInstance = null;
        }

        const canvas = document.getElementById('gi-hourly-chart');
        if (!canvas || hourlyRecords.length === 0) return;

        const fullData = Array(24).fill(0);
        hourlyRecords.forEach(r => {
            if (r.hour >= 0 && r.hour < 24) fullData[r.hour] = r.watt_usage;
        });

        const maxVal = Math.max(...fullData, 1);
        const tariffColors = { peak: '#ff5252', shoulder: '#ffab00', offpeak: '#00e676' };

        const timeLabels = ['12a','3a','6a','9a','12p','3p','6p','9p'];
        const labels = Array(24).fill('');
        for (let i = 0; i < timeLabels.length; i++) {
            labels[i * 3] = timeLabels[i];
        }

        const ctx = canvas.getContext('2d');
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this._chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: fullData.map(v => +(v / 1000).toFixed(3)),
                    backgroundColor: fullData.map((v, i) => {
                        const period = this._getTariffPeriod(i, peakHours, offpeakHours, shoulderHours);
                        const color = tariffColors[period] || '#00e676';
                        const ratio = v / maxVal;
                        return color + Math.round(20 + ratio * 35).toString(16).padStart(2, '0');
                    }),
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: reduceMotion ? 0 : undefined },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    y: { display: false, beginAtZero: true },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#666',
                            font: { size: 9 },
                            maxRotation: 0,
                        },
                    }
                }
            }
        });
    }

    _renderApplianceRecs(recs) {
        if (!recs || recs.length === 0) {
            this._showEmpty(this._applianceContainer, 'No appliance recommendations available.');
            return;
        }

        const sorted = [...recs].sort((a, b) => (b.estimated_annual_savings_dollars || 0) - (a.estimated_annual_savings_dollars || 0));
        const cards = sorted.map(r => this._createApplianceCard(r)).join('');

        this._applianceContainer.innerHTML = `<div class="recs-appliance-list">${cards}</div>`;
    }

    _createApplianceCard(rec) {
        return `
            <div class="recs-appliance">
                <div class="rec-card severity-info">
                    <div class="rec-icon">\u{1f50c}</div>
                    <div class="rec-body">
                        <div class="rec-title">${this._escapeHtml(rec.recommended_model || 'Recommended upgrade')}</div>
                        <div class="rec-description">${this._escapeHtml(rec.reasoning || '')}</div>
                    </div>
                </div>
                <div class="appliance-specs">
                    <div class="spec-item">
                        <span class="spec-label">Brand</span>
                        <span class="spec-value">${this._escapeHtml(rec.brand || '\u2014')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Power rating</span>
                        <span class="spec-value">${rec.power_rating_watts || '\u2014'} W</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Est. annual usage</span>
                        <span class="spec-value">${rec.estimated_annual_kwh || '\u2014'} kWh</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Current annual cost</span>
                        <span class="spec-value">$${rec.current_annual_cost_dollars || '\u2014'}</span>
                    </div>
                    <div class="spec-item highlight">
                        <span class="spec-label">Est. annual cost</span>
                        <span class="spec-value">$${rec.estimated_annual_cost_dollars || '\u2014'}</span>
                    </div>
                    <div class="spec-item highlight">
                        <span class="spec-label">Annual savings</span>
                        <span class="spec-value">$${rec.estimated_annual_savings_dollars || '\u2014'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Est. retail price</span>
                        <span class="spec-value">$${rec.estimated_retail_price_aud || '\u2014'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Payback period</span>
                        <span class="spec-value">${rec.payback_period_years || '\u2014'} years</span>
                    </div>
                </div>
            </div>
        `;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    _showLoading(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="recs-state">
                <div class="loading-spinner"></div>
                <p class="recs-state-text">Loading...</p>
            </div>
        `;
    }

    _showEmpty(container, msg) {
        if (!container) return;
        container.innerHTML = `
            <div class="recs-state">
                <div class="recs-state-icon">\u{1f4a1}</div>
                <p class="recs-state-text">${this._escapeHtml(msg)}</p>
            </div>
        `;
    }

    _showError(container, msg) {
        if (!container) return;
        container.innerHTML = `
            <div class="recs-state recs-error">
                <p class="recs-state-text">${this._escapeHtml(msg)}</p>
            </div>
        `;
    }
}

const recsManager = new RecommendationsManager();
