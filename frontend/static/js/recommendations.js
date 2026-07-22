class RecommendationsManager {
    constructor() {
        this._generalContainer = document.getElementById('general-container');
        this._applianceContainer = document.getElementById('appliance-container');
        this._chartInstance = null;
        this._trendChartInstance = null;
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

    _applianceHeading() {
        return '<h1 class="gi-title"><span class="info-heading">Appliance Specific Recommendations' + INFO.icon('appliance_recs') + '</span></h1>';
    }

    async loadApplianceRecs(date) {
        if (!this._applianceContainer) return;
        this._showLoading(this._applianceContainer, true);

        try {
            const data = await energyAPI.getApplianceRecs(date);
            if (data && data.recommendations && data.recommendations.length > 0) {
                this._renderApplianceRecs(data.recommendations);
                return;
            }
            if (data && data.error) {
                this._showError(this._applianceContainer, data.error, true);
                return;
            }
            this._showEmpty(this._applianceContainer, 'No appliance recommendations available. Fill in your appliance details in the survey.', true);
        } catch (err) {
            if (err.message && err.message.includes('404')) {
                this._showEmpty(this._applianceContainer, 'No appliance recommendations available.', true);
            } else {
                this._showError(this._applianceContainer, 'Failed to load recommendations.', true);
            }
        }
    }

    _renderGeneralDetailed(data) {
        const ws = data.weekly_spending || [];
        const vsLastWeek = data.today_vs_last_week;
        const vsAvg = data.today_vs_average;
        const tips = data.behaviour_tips || [];
        const tipBanner = data.tip_banner || '';
        const rate = data.rate_per_kwh || 0.30;

        const dayLabels = ws.map(d => {
            const dt = new Date(d.date + 'T00:00:00');
            return dt.toLocaleDateString('en', { weekday: 'short' });
        });
        const costValues = ws.map(d => d.cost);

        const hasPositive = vsLastWeek && vsLastWeek.is_positive;
        const hasNegative = vsAvg && !vsAvg.is_positive;

        const positiveHtml = hasPositive ? `
            <div class="insight-module insight-positive">
                <div class="insight-module-title">Today was lower than this time last week</div>
                <div class="insight-metrics">
                    <span class="metric metric-green">${vsLastWeek.diff_pct}% decrease</span>
                    <span class="metric metric-green">${vsLastWeek.diff_kwh} kWh${INFO.icon('kwh')} saved</span>
                    <span class="metric metric-green">$${vsLastWeek.savings} saved</span>
                </div>
                <div class="insight-baseline">Baseline: ${vsLastWeek.baseline_kwh} kWh${INFO.icon('kwh')} (last week)</div>
            </div>
        ` : '';

        const negativeHtml = hasNegative ? `
            <div class="insight-module insight-negative">
                <div class="insight-module-title">Today was higher than your daily average</div>
                <div class="insight-metrics">
                    <span class="metric metric-red">${vsAvg.diff_pct}% above average</span>
                </div>
                <div class="insight-baseline">7-day average: ${vsAvg.avg_kwh} kWh${INFO.icon('kwh')}</div>
            </div>
        ` : '';

        const tipsHtml = tips.length > 0 ? `
            <div class="behaviour-tips">
                <h3 class="section-subtitle">Behavioural Advice</h3>
                <div class="tips-list">
                    ${tips.map(t => `
                        <div class="rec-card severity-${t.severity || 'info'}">
                            <div class="rec-icon">${t.icon || '\u{1f4a1}'}</div>
                            <div class="rec-body">
                                <div class="rec-title">${this._escapeHtml(t.title || '')}</div>
                                <div class="rec-description">${this._escapeHtml(t.description || '')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const bannerHtml = tipBanner ? `
            <div class="tip-banner">
                <span class="tip-banner-icon">\u{1f4a1}</span>
                <span class="tip-banner-text"><strong>Tip:</strong> ${this._escapeHtml(tipBanner)}</span>
            </div>
        ` : '';

        this._generalContainer.innerHTML = `
            <div class="general-insights">
                <h1 class="gi-title"><span class="info-heading">General Insights${INFO.icon('general_insights')}</span></h1>

                <div class="gi-section-a">
                    <div class="gi-chart-col">
                        <h2 class="gi-section-title"><span class="info-heading">Weekly Spending${INFO.icon('weekly_spending')}</span></h2>
                        <div class="chart-wrap">
                            <canvas id="weekly-chart" role="img" aria-label="Bar chart showing daily energy spending for the past week"></canvas>
                        </div>
                    </div>
                    <div class="gi-insights-col">
                        ${positiveHtml}
                        ${negativeHtml}
                        ${!hasPositive && !hasNegative ? `
                            <div class="insight-module insight-neutral">
                                <div class="insight-module-title">Usage is on par with recent trends</div>
                                <div class="insight-baseline">Keep monitoring to identify patterns.</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="gi-section-b">
                    <div class="gi-stat-card">
                        <span class="gi-stat-label">Average Weekly Spending</span>
                        <span class="gi-stat-value">$${data.avg_weekly_spend || '0.00'}</span>
                    </div>
                    <div class="gi-stat-card">
                        <span class="gi-stat-label">Forecasted Monthly Bill${INFO.icon('forecasted_monthly')}</span>
                        <span class="gi-stat-value">$${data.forecasted_monthly || '0.00'}</span>
                    </div>
                </div>

                <div class="gi-section-c">
                    <h3 class="gi-section-title"><span class="info-heading">Savings in monthly bill if appliance usage is reduced by:${INFO.icon('savings_scenarios')}</span></h3>
                    <div class="gi-scenarios">
                        <div class="gi-scenario-card">
                            <span class="gi-scenario-pct">2%</span>
                            <span class="gi-scenario-value">$${data.savings_scenarios.pct_2 || '0.00'}</span>
                            <span class="gi-scenario-label">saved / month</span>
                        </div>
                        <div class="gi-scenario-card">
                            <span class="gi-scenario-pct">4%</span>
                            <span class="gi-scenario-value">$${data.savings_scenarios.pct_4 || '0.00'}</span>
                            <span class="gi-scenario-label">saved / month</span>
                        </div>
                        <div class="gi-scenario-card">
                            <span class="gi-scenario-pct">6%</span>
                            <span class="gi-scenario-value">$${data.savings_scenarios.pct_6 || '0.00'}</span>
                            <span class="gi-scenario-label">saved / month</span>
                        </div>
                    </div>
                </div>

                <div class="gi-section-d">
                    <h3 class="gi-section-title"><span class="info-heading">All-Time Spending Trend${INFO.icon('alltime_trend')}</span></h3>
                    <div class="chart-wrap">
                        <canvas id="trend-chart" role="img" aria-label="Line chart showing average daily spending over time"></canvas>
                    </div>
                </div>

                ${tipsHtml}

                ${bannerHtml}
            </div>
        `;

        this._initChart(dayLabels, costValues);
        this._initTrendChart();
    }

    _initChart(labels, values) {
        if (this._chartInstance) {
            this._chartInstance.destroy();
            this._chartInstance = null;
        }

        const canvas = document.getElementById('weekly-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this._chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: values.map(v => {
                        const max = Math.max(...values, 1);
                        const ratio = v / max;
                        if (ratio > 0.7) return '#ff525288';
                        if (ratio > 0.4) return '#ffab0088';
                        return '#00e67688';
                    }),
                    borderColor: values.map(v => {
                        const max = Math.max(...values, 1);
                        const ratio = v / max;
                        if (ratio > 0.7) return '#ff5252';
                        if (ratio > 0.4) return '#ffab00';
                        return '#00e676';
                    }),
                    borderWidth: 2,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: reduceMotion ? 0 : undefined },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `$${ctx.raw}`,
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            color: '#888',
                            font: { size: 10 },
                            callback: (v) => '$' + v,
                        },
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#888',
                            font: { size: 10 },
                        },
                    },
                },
            },
        });
    }

    async _initTrendChart() {
        if (this._trendChartInstance) {
            this._trendChartInstance.destroy();
            this._trendChartInstance = null;
        }

        const canvas = document.getElementById('trend-chart');
        if (!canvas) return;

        try {
            const data = await energyAPI.getGeneralTrend();
            if (!data || !data.buckets || data.buckets.length === 0) return;

            const labels = data.buckets.map(b => b.label);
            const values = data.buckets.map(b => b.avg_cost);

            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, '#00e67688');
            gradient.addColorStop(1, '#00e67600');
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            this._trendChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        borderColor: '#00e676',
                        backgroundColor: gradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#00e676',
                        pointBorderColor: '#0d0d1a',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: reduceMotion ? 0 : undefined },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const b = data.buckets[ctx.dataIndex];
                                    return `$${b.avg_cost}/day avg (${b.num_days} days)`;
                                },
                            },
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: {
                                color: '#888',
                                font: { size: 10 },
                                callback: (v) => '$' + v,
                            },
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#888',
                                font: { size: 10 },
                            },
                        },
                    },
                },
            });
        } catch (err) {
            console.warn('Failed to load all-time trend:', err);
        }
    }

    _renderApplianceRecs(recs) {
        if (!recs || recs.length === 0) {
            this._showEmpty(this._applianceContainer, 'No appliance recommendations available.');
            return;
        }

        const sorted = [...recs].sort((a, b) => (b.estimated_annual_savings_dollars || 0) - (a.estimated_annual_savings_dollars || 0));
        const cards = sorted.map(r => this._createApplianceCard(r)).join('');

        this._applianceContainer.innerHTML = this._applianceHeading() + `<div class="recs-appliance-list">${cards}</div>`;
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
                        <span class="spec-label">Power rating${INFO.icon('power_rating')}</span>
                        <span class="spec-value">${rec.power_rating_watts || '\u2014'} W</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Est. annual usage${INFO.icon('est_annual_usage')}</span>
                        <span class="spec-value">${rec.estimated_annual_kwh || '\u2014'} kWh${INFO.icon('kwh')}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Current annual cost</span>
                        <span class="spec-value">$${rec.current_annual_cost_dollars || '\u2014'}</span>
                    </div>
                    <div class="spec-item highlight">
                        <span class="spec-label">Est. annual cost${INFO.icon('est_annual_cost')}</span>
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
                        <span class="spec-label">Payback period${INFO.icon('payback_period')}</span>
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

    _showLoading(container, withHeading) {
        if (!container) return;
        const heading = withHeading ? this._applianceHeading() : '';
        container.innerHTML = heading + `
            <div class="recs-state">
                <div class="loading-spinner"></div>
                <p class="recs-state-text">Loading...</p>
            </div>
        `;
    }

    _showEmpty(container, msg, withHeading) {
        if (!container) return;
        const heading = withHeading ? this._applianceHeading() : '';
        container.innerHTML = heading + `
            <div class="recs-state">
                <div class="recs-state-icon">\u{1f4a1}</div>
                <p class="recs-state-text">${this._escapeHtml(msg)}</p>
            </div>
        `;
    }

    _showError(container, msg, withHeading) {
        if (!container) return;
        const heading = withHeading ? this._applianceHeading() : '';
        container.innerHTML = heading + `
            <div class="recs-state recs-error">
                <p class="recs-state-text">${this._escapeHtml(msg)}</p>
            </div>
        `;
    }
}

const recsManager = new RecommendationsManager();