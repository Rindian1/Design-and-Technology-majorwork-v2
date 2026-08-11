const INSIGHT_ICONS = {
    chart: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>'
};

function insightIcon(key, size) {
    var svg = INSIGHT_ICONS[key] || INSIGHT_ICONS.bulb;
    if (size && size !== 22) {
        svg = svg.replace(/width="22"/g, 'width="' + size + '"').replace(/height="22"/g, 'height="' + size + '"');
    }
    return svg;
}

class RecommendationsManager {
    constructor() {
        this._generalContainer = document.getElementById('general-container');
        this._applianceContainer = document.getElementById('appliance-container');
        this._chartInstance = null;
        this._trendChartInstance = null;
        this._ff = { running: false, timer: null, date: null };
        this._setupDelegation();
    }

    _setupDelegation() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.appliance-switch-btn');
            if (!btn) return;
            this._switchAppliance(btn);
        });
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

    _applianceHeading(currentAppliance) {
        const applianceLabel = currentAppliance
            ? '<span class="current-appliance-label">Current appliance: ' + this._escapeHtml(currentAppliance) + '</span>'
            : '';
        return '<div class="appliance-heading-row">' +
            '<h1 class="gi-title"><span class="info-heading">Appliance Specific Recommendations' + INFO.icon('feat_appliance') + '</span></h1>' +
            applianceLabel +
            '</div>' +
            '<div class="appliance-afford-question">What if I can\'t afford this upgrade? ' + INFO.icon('cant_afford') + '</div>';
    }

    async loadApplianceRecs(date) {
        if (!this._applianceContainer) return;
        this._showLoading(this._applianceContainer, true);

        try {
            const data = await energyAPI.getApplianceRecs(date);
            if (data && data.recommendations && data.recommendations.length > 0) {
                this._renderApplianceRecs(data);
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
        const budgetKwh = data.budget_kwh || 16.7;
        const dailyBudget = budgetKwh * rate;

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
                <h3 class="section-subtitle">Behavioural Advice ${INFO.icon('feat_behavioural')}</h3>
                <div class="tips-list">
                    ${tips.map(t => `
                        <div class="rec-card severity-${t.severity || 'info'}">
                            <div class="rec-icon">${insightIcon(t.icon)}</div>
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
                <span class="tip-banner-icon">${insightIcon('bulb', 18)}</span>
                <span class="tip-banner-text"><strong>Tip:</strong> ${this._escapeHtml(tipBanner)}</span>
            </div>
        ` : '';

        this._generalContainer.innerHTML = `
            <div class="general-insights">
                <h1 class="gi-title"><span class="info-heading">General Insights${INFO.icon('general_insights')}</span></h1>
                <div class="gi-section-a">
                    <div class="gi-chart-col">
                        <h2 class="gi-section-title"><span class="info-heading">Weekly Spending${INFO.icon('feat_weekly_spending')}</span></h2>
                        <div class="chart-wrap">
                            <canvas id="weekly-chart" role="img" aria-label="Bar chart showing daily energy spending for the past week"></canvas>
                        </div>
                    </div>
                    <div class="gi-insights-col">
                        <h3 class="gi-section-title"><span class="info-heading">Usage Comparisons${INFO.icon('feat_comparison')}</span></h3>
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
                    <h3 class="gi-section-title"><span class="info-heading">Savings in monthly bill if appliance usage is reduced by:${INFO.icon('feat_savings')}</span></h3>
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
                    <h3 class="gi-section-title"><span class="info-heading">All-Time Spending Trend${INFO.icon('feat_trend')}</span></h3>
                    <div class="chart-wrap">
                        <canvas id="trend-chart" role="img" aria-label="Line chart showing average daily spending over time"></canvas>
                    </div>
                </div>

                ${tipsHtml}

                ${bannerHtml}
            </div>
        `;

        this._initChart(dayLabels, costValues, dailyBudget);
        this._initTrendChart();
    }

    _initChart(labels, values, dailyBudget) {
        if (this._chartInstance) {
            this._chartInstance.destroy();
            this._chartInstance = null;
        }

        const canvas = document.getElementById('weekly-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const budgetLine = dailyBudget != null ? new Array(labels.length).fill(dailyBudget) : null;

        const budgetLabelPlugin = budgetLine ? {
            id: 'budgetLabel',
            afterDraw(chart) {
                const yScale = chart.scales.y;
                const xArea = chart.chartArea;
                const yPos = yScale.getPixelForValue(dailyBudget);
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = '10px sans-serif';
                ctx.fillStyle = '#448aff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText('Budget', xArea.left, yPos - 4);
                ctx.restore();
            },
        } : null;

        this._chartInstance = new Chart(ctx, {
            type: 'bar',
            plugins: budgetLabelPlugin ? [budgetLabelPlugin] : [],
            data: {
                labels: labels,
                datasets: [
                    {
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
                        order: 2,
                    },
                    ...(budgetLine ? [{
                        type: 'line',
                        data: budgetLine,
                        borderColor: '#448aff',
                        borderWidth: 2,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 1,
                    }] : []),
                ]
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
                                if (ctx.datasetIndex === 1) return `Budget: $${ctx.raw.toFixed(2)}`;
                                return `Daily: $${ctx.raw}`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 10,
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

    _renderApplianceRecs(data) {
        const recs = data.recommendations;
        if (!recs || recs.length === 0) {
            this._showEmpty(this._applianceContainer, 'No appliance recommendations available.');
            return;
        }

        const currentAppliance = data.current_appliance_model || null;
        const sorted = [...recs].sort((a, b) => (b.estimated_annual_savings_dollars || 0) - (a.estimated_annual_savings_dollars || 0));
        const cards = sorted.map(r => this._createApplianceCard(r)).join('');

        this._applianceContainer.innerHTML = this._applianceHeading(currentAppliance) + `<div class="recs-appliance-list">${cards}</div>`;
    }

    _createApplianceCard(rec) {
        return `
            <div class="recs-appliance">
                <div class="rec-card severity-info">
                    <div class="rec-icon"><svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="20" height="28" rx="3"/><rect x="18" y="32" width="4" height="6" rx="1"/><rect x="26" y="32" width="4" height="6" rx="1"/><rect x="14" y="40" width="20" height="4" rx="1"/><line x1="17" y1="12" x2="17" y2="20"/><line x1="31" y1="12" x2="31" y2="20"/><line x1="20" y1="14" x2="28" y2="14"/><line x1="20" y1="18" x2="28" y2="18"/></svg></div>
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
                    <div class="spec-item${rec.offset_price < 0 ? ' highlight-green' : ''}">
                        <span class="spec-label">Offset price${INFO.icon(rec.offset_price < 0 ? 'offset_profit' : 'offset_price')}</span>
                        <span class="spec-value">$${Math.abs(rec.offset_price || 0)}${rec.offset_price < 0 ? ' profit' : ''}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Payback with offset${INFO.icon('payback_offset')}</span>
                        <span class="spec-value">${rec.payback_with_offset || 0} years</span>
                    </div>
                </div>
                <button class="appliance-switch-btn"
                        data-model="${this._escapeHtml(rec.recommended_model || '')}"
                        data-power="${rec.power_rating_watts || ''}"
                        data-type="">
                    I have switched my appliance to this
                </button>
            </div>
        `;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async _switchAppliance(btn) {
        const model = btn.dataset.model;
        const power = btn.dataset.power;
        if (!model) return;
        btn.disabled = true;
        btn.textContent = 'Updating...';
        try {
            await energyAPI.request('/api/appliance-switch', {
                method: 'POST',
                body: JSON.stringify({ appliance_model: model, power_rating: power }),
            });
            energyAPI.clearCache();
            if (typeof navigation !== 'undefined') {
                await this.loadApplianceRecs(navigation.getCurrentDate());
            }
        } catch (err) {
            console.error('Failed to switch appliance:', err);
            btn.disabled = false;
            btn.textContent = 'I have switched my appliance to this';
        }
    }

    async _startFF() {
        const ffBtn = document.getElementById('ff-btn');
        const ffTime = document.getElementById('ff-time');

        if (window.dashboard?.ff?.running) window.dashboard._stopFF();
        if (typeof goalsManager !== 'undefined' && goalsManager._ff?.running) goalsManager._stopFF(true);

        let range;
        try {
            range = await energyAPI.getDateRange();
        } catch (e) {
            return;
        }
        if (!range || !range.earliest) return;

        this._ff.running = true;
        this._ff.date = range.earliest;
        if (ffBtn) ffBtn.classList.add('running');
        if (ffTime) ffTime.classList.remove('hidden');

        energyAPI.clearCache();
        this._tickFF();
        this._ff.timer = setInterval(() => this._tickFF(), 500);
    }

    _stopFF() {
        const ffBtn = document.getElementById('ff-btn');
        const ffTime = document.getElementById('ff-time');

        clearInterval(this._ff.timer);
        this._ff.running = false;
        this._ff.timer = null;

        if (ffBtn) ffBtn.classList.remove('running');
        if (ffTime) ffTime.classList.add('hidden');
    }

    async _tickFF() {
        const { date } = this._ff;
        if (!date) { this._stopFF(); return; }

        const range = await energyAPI.getDateRange().catch(() => null);
        if (!range || date > range.latest) { this._stopFF(); return; }

        this._updateFFTime(date);

        try {
            energyAPI.clearCache();
            const data = await energyAPI.getGeneralDetailed(date);
            if (data && data.weekly_spending && data.weekly_spending.length > 0) {
                this._renderGeneralDetailed(data);
                const ffBtn = document.getElementById('ff-btn');
                if (ffBtn) ffBtn.classList.add('running');
                const ffTime = document.getElementById('ff-time');
                if (ffTime) ffTime.classList.remove('hidden');
            }
        } catch (e) {
            /* skip dates with no data */
        }

        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        this._ff.date = next.toISOString().split('T')[0];
    }

    _updateFFTime(dateStr) {
        const el = document.getElementById('ff-time');
        if (el) {
            const d = new Date(dateStr + 'T00:00:00');
            const opts = { weekday: 'short', month: 'short', day: 'numeric' };
            el.textContent = d.toLocaleDateString('en-US', opts);
        }
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const d = new Date(dateStr + 'T00:00:00');
            dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
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
                <div class="recs-state-icon">${insightIcon('bulb', 40)}</div>
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