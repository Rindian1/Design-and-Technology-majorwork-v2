class GaugeManager {
  constructor() {
    this.currentData = null;
    this.currentStats = null;
    this.budgetKwh = 30;
    this.ratePerKwh = 0.30;
    this.hasTou = false;
    this.peakHours = [];
    this.offpeakHours = [];
    this.shoulderHours = [];
    this.fillEl = document.getElementById('dial-fill');
    this.chartInstance = null;
    this.updateDisplay(null, null);
  }

  setConfig(budgetKwh, ratePerKwh, tariffInfo) {
    if (budgetKwh != null) this.budgetKwh = budgetKwh;
    if (ratePerKwh != null) this.ratePerKwh = ratePerKwh;
    if (tariffInfo) {
      this.hasTou = tariffInfo.has_tou || false;
      this.peakHours = tariffInfo.peak_hours || [];
      this.offpeakHours = tariffInfo.offpeak_hours || [];
      this.shoulderHours = tariffInfo.shoulder_hours || [];
    }
  }

  updateDisplay(dailyData, statistics) {
    this.currentData = dailyData;
    this.currentStats = statistics;
    this.render();
  }

  render() {
    const s = this.currentStats;
    if (!s || !s.count) {
      this.setDial(0);
      this.setCentre(0, 0);
      this.setMiniStats(null, null, null, null);
      this.initChart(this.currentData);
      return;
    }

    const totalKwh = s.total / 1000;
    const peakKw = s.peak / 1000;
    const avgKw = s.average / 1000;
    const cost = s.cost !== undefined ? s.cost : totalKwh * this.ratePerKwh;
    const fillRatio = Math.min(totalKwh / this.budgetKwh, 1);

    this.setDial(fillRatio);
    this.setCentre(cost, totalKwh);
    this.setMiniStats(totalKwh, peakKw, avgKw, cost);
    this.initChart(this.currentData);
  }

  setDial(ratio) {
    if (this.fillEl) {
      const dashOffset = 440 - ratio * 440;
      this.fillEl.style.strokeDashoffset = dashOffset;
    }
  }

  setCentre(cost, totalKwh) {
    const vEl = document.getElementById('gauge-value');
    const cEl = document.getElementById('gauge-cost');
    const bEl = document.getElementById('gauge-budget');
    if (vEl) vEl.textContent = `$${cost.toFixed(2)}`;
    if (cEl) cEl.textContent = `${totalKwh.toFixed(1)} kWh`;
    if (bEl) bEl.textContent = `Out of $${(this.budgetKwh * this.ratePerKwh).toFixed(2)}`;
  }

  setMiniStats(totalKwh, peakKw, avgKw, cost) {
    const set = (id, v, suffix) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (v === null || v === undefined) {
        el.innerHTML = '--';
      } else {
        el.innerHTML = `${v.toFixed(1)} <small>${suffix || ''}</small>`;
      }
    };
    set('stat-total', totalKwh, 'kWh');
    set('stat-peak', peakKw, 'kW');
    set('stat-avg', avgKw, 'kW');
    const costEl = document.getElementById('stat-cost');
    if (!costEl) return;
    if (cost === null || cost === undefined) {
      costEl.textContent = '--';
    } else {
      costEl.textContent = `$${cost.toFixed(2)}`;
    }
  }

  _formatHour(h) {
    if (h === 0 || h === 24) return '12a';
    if (h === 12) return '12p';
    return h < 12 ? h + 'a' : (h - 12) + 'p';
  }

  _formatTimeRange(r) {
    return this._formatHour(r.start) + '\u2013' + this._formatHour(r.end);
  }

  _getTariffPeriod(hour) {
    const inRange = (h, ranges) => ranges.some(r => {
      const s = r.start, e = r.end;
      return s < e ? s <= h && h < e : h >= s || h < e;
    });
    if (inRange(hour, this.peakHours)) return 'peak';
    if (inRange(hour, this.offpeakHours)) return 'offpeak';
    if (inRange(hour, this.shoulderHours)) return 'shoulder';
    return 'offpeak';
  }

  _buildLegendItems() {
    const fmt = (ranges) => ranges.map(r => this._formatTimeRange(r)).join(', ');
    const items = [];
    if (this.peakHours.length) items.push({ cls: 'peak', label: 'Peak (' + fmt(this.peakHours) + ')' });
    if (this.shoulderHours.length) items.push({ cls: 'shoulder', label: 'Shoulder (' + fmt(this.shoulderHours) + ')' });
    if (this.offpeakHours.length) items.push({ cls: 'off', label: 'Off-Peak (' + fmt(this.offpeakHours) + ')' });
    if (!this.peakHours.length && !this.shoulderHours.length) {
      items.push({ cls: 'off', label: 'Flat Rate' });
    }
    return items;
  }

  initChart(data) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const canvas = document.getElementById('home-chart');
    if (!canvas) return;

    const legendEl = document.getElementById('home-legend');
    if (legendEl) {
      const items = this._buildLegendItems();
      legendEl.innerHTML = items.map(item =>
        `<span class="dl-item"><span class="dl-dot ${item.cls}"></span> ${item.label}</span>`
      ).join('');
    }

    if (!data || !data.values || data.values.length === 0) return;

    const fullData = data.values.map(v => +(v / 1000).toFixed(3));
    const tariffColors = { peak: '#ff5252', shoulder: '#ffab00', offpeak: '#00e676' };

    const timeLabels = ['12a','3a','6a','9a','12p','3p','6p','9p'];
    const labels = Array(24).fill('');
    for (let i = 0; i < timeLabels.length; i++) {
      labels[i * 3] = timeLabels[i];
    }

    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: fullData,
          backgroundColor: fullData.map((v, i) => {
            const period = this._getTariffPeriod(i);
            if (period === 'peak') return 'rgba(255, 82, 82, 0.35)';
            return tariffColors[period] + '40';
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
              color: '#777',
              font: { size: 9 },
              maxRotation: 0,
            },
          }
        }
      }
    });
  }

  loadDataForDate(date) {
    const loading = document.getElementById('loading-overlay');
    loading.classList.remove('hidden');

    Promise.all([
      energyAPI.getDailyData(date),
      energyAPI.getStatistics(date)
    ]).then(([chartData, stats]) => {
      this.currentData = chartData;
      this.currentStats = stats;
      this.render();
    }).catch(err => {
      console.error('Failed to load data:', err);
      if (err.message.includes('No data found') || err.message.includes('No statistics')) {
        this.updateDisplay(null, null);
      } else {
        const modal = document.getElementById('error-modal');
        const msg = document.getElementById('error-message');
        if (msg) msg.textContent = 'Failed to load energy data. Please try again.';
        if (modal) modal.classList.remove('hidden');
        this.updateDisplay(null, null);
      }
    }).finally(() => {
      loading.classList.add('hidden');
    });
  }
}

const gaugeManager = new GaugeManager();
