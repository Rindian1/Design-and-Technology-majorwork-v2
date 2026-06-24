/**
 * Chart Management for Energy Monitoring Dashboard
 * Handles Chart.js configuration, data rendering, and interactions
 */

class ChartManager {
    constructor() {
        this.chart = null;
        this.currentData = null;
        this.chartConfig = this.getDefaultConfig();
        
        this.init();
    }

    /**
     * Initialize chart system
     */
    init() {
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup refresh button
        this.setupRefreshButton();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for date changes
        window.addEventListener('dateChanged', (e) => {
            this.loadDataForDate(e.detail.date);
        });

        // Listen for tab changes
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'graph') {
                // Refresh chart when returning to graph tab
                this.refreshChart();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
    }

    /**
     * Setup refresh button
     */
    setupRefreshButton() {
        const refreshBtn = document.getElementById('refresh-chart');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshChart();
            });
        }
    }

    /**
     * Get default chart configuration
     */
    getDefaultConfig() {
        return {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Energy Usage (Watts)',
                    data: [],
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2,
                    hoverBackgroundColor: 'rgba(102, 126, 234, 0.8)',
                    hoverBorderColor: 'rgba(102, 126, 234, 1)',
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 14,
                                weight: '500'
                            },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return `Time: ${context[0].label}`;
                            },
                            label: function(context) {
                                return `Usage: ${context.parsed.y.toLocaleString()} watts`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time of Day',
                            font: {
                                size: 14,
                                weight: '500'
                            },
                            padding: { top: 10, bottom: 10 }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 24,
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Energy Usage (Watts)',
                            font: {
                                size: 14,
                                weight: '500'
                            },
                            padding: { top: 10, bottom: 10 }
                        },
                        grid: {
                            display: true,
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.1)',
                            borderDash: [5, 5]
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        },
                        beginAtZero: true
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                layout: {
                    padding: {
                        top: 20,
                        right: 20,
                        bottom: 10,
                        left: 10
                    }
                }
            }
        };
    }

    /**
     * Initialize chart
     */
    initializeChart() {
        const ctx = document.getElementById('energy-chart');
        if (!ctx) {
            console.error('Chart canvas not found');
            return;
        }

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new chart
        this.chart = new Chart(ctx, this.chartConfig);
    }

    /**
     * Load data for specific date
     */
    async loadDataForDate(date) {
        try {
            this.showLoading(true);
            
            // Load both chart data and statistics in parallel
            const [chartData, statistics] = await Promise.all([
                energyAPI.getDailyData(date),
                energyAPI.getStatistics(date)
            ]);

            this.currentData = chartData;
            
            // Update chart
            this.updateChart(chartData);
            
            // Update statistics
            this.updateStatistics(statistics);
            
            // Show chart, hide no-data message
            this.toggleNoDataMessage(false);
            
        } catch (error) {
            console.error('Failed to load chart data:', error);
            
            if (error.message.includes('No data found')) {
                this.toggleNoDataMessage(true);
                this.clearStatistics();
            } else {
                this.showError('Failed to load energy data');
            }
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Update chart with new data
     */
    updateChart(data) {
        if (!this.chart) {
            this.initializeChart();
        }

        if (!data || !data.labels || !data.values) {
            console.warn('Invalid chart data:', data);
            return;
        }

        // Update chart data
        this.chart.data.labels = data.labels;
        this.chart.data.datasets[0].data = data.values;
        
        // Update chart
        this.chart.update('active');
    }

    /**
     * Update statistics display
     */
    updateStatistics(statistics) {
        if (!statistics) {
            this.clearStatistics();
            return;
        }

        // Update statistic cards
        this.updateStatisticCard('stat-total', statistics.total);
        this.updateStatisticCard('stat-average', statistics.average);
        this.updateStatisticCard('stat-peak', statistics.peak);
        this.updateStatisticCard('stat-minimum', statistics.minimum);
    }

    /**
     * Update individual statistic card
     */
    updateStatisticCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value ? value.toLocaleString() : '--';
        }
    }

    /**
     * Clear statistics display
     */
    clearStatistics() {
        ['stat-total', 'stat-average', 'stat-peak', 'stat-minimum'].forEach(id => {
            this.updateStatisticCard(id, null);
        });
    }

    /**
     * Toggle no-data message
     */
    toggleNoDataMessage(show) {
        const noDataMessage = document.getElementById('no-data-message');
        const chartWrapper = document.querySelector('.chart-wrapper');
        
        if (noDataMessage && chartWrapper) {
            if (show) {
                noDataMessage.classList.remove('hidden');
                noDataMessage.setAttribute('aria-hidden', 'false');
                chartWrapper.style.display = 'none';
            } else {
                noDataMessage.classList.add('hidden');
                noDataMessage.setAttribute('aria-hidden', 'true');
                chartWrapper.style.display = 'block';
            }
        }
    }

    /**
     * Show/hide loading state
     */
    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.remove('hidden');
                loadingOverlay.setAttribute('aria-hidden', 'false');
            } else {
                loadingOverlay.classList.add('hidden');
                loadingOverlay.setAttribute('aria-hidden', 'true');
            }
        }
    }

    /**
     * Refresh chart data
     */
    async refreshChart() {
        if (navigation) {
            await this.loadDataForDate(navigation.getCurrentDate());
        }
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
     * Export chart as image (future feature)
     */
    exportChart() {
        if (!this.chart) return;
        
        const url = this.chart.toBase64Image();
        const link = document.createElement('a');
        link.download = `energy-chart-${navigation.getCurrentDate()}.png`;
        link.href = url;
        link.click();
    }

    /**
     * Get current chart data
     */
    getCurrentData() {
        return this.currentData;
    }

    /**
     * Destroy chart
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Create global chart manager instance
const chartManager = new ChartManager();
