const SEGMENTS = 20;

const CX = 170;
const CY = 185;
const R = 135;
const GAP_RAD = 0.035;

const DIM = '#1e1e32';
const COLOURS = ['#00e676', '#00e676', '#00e676', '#00e676',
                 '#00e676', '#00e676', '#00e676', '#00e676',
                 '#ffab00', '#ffab00', '#ffab00', '#ffab00',
                 '#ffab00', '#ffab00', '#ffab00',
                 '#ff5252', '#ff5252', '#ff5252', '#ff5252', '#ff5252'];

class GaugeManager {
  constructor() {
    this.currentData = null;
    this.currentStats = null;
    this.budgetKwh = 30;
    this.ratePerKwh = 0.30;
    this.svg = document.getElementById('energy-gauge');
    this.initSegments();
    this.updateDisplay(null, null);
  }

  setConfig(budgetKwh, ratePerKwh) {
    if (budgetKwh != null) this.budgetKwh = budgetKwh;
    if (ratePerKwh != null) this.ratePerKwh = ratePerKwh;
  }

  initSegments() {
    this.svg.innerHTML = '';
    for (let i = 0; i < SEGMENTS; i++) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', this.segPath(i));
      el.setAttribute('data-idx', i);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', DIM);
      el.setAttribute('stroke-width', '16');
      el.setAttribute('stroke-linecap', 'butt');
      this.svg.appendChild(el);
    }
  }

  segPath(i) {
    const total = Math.PI;
    const seg = total / SEGMENTS;
    const a1 = Math.PI - (i / SEGMENTS) * total;
    const a2 = a1 - seg + GAP_RAD;
    const x1 = CX + R * Math.cos(a1);
    const y1 = CY - R * Math.sin(a1);
    const x2 = CX + R * Math.cos(a2);
    const y2 = CY - R * Math.sin(a2);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  }

  updateDisplay(dailyData, statistics) {
    this.currentData = dailyData;
    this.currentStats = statistics;
    this.render();
  }

  render() {
    const s = this.currentStats;
    if (!s || !s.count) {
      this.drawSegments(0);
      this.setCentre('--', '$--.--');
      this.setBudgetBar(0);
      this.setAlert(null);
      this.setInsight('No data available for this date.');
      this.setMiniStats(null, null, null, null);
      return;
    }

    const totalKwh = s.total / 1000;
    const peakKw = s.peak / 1000;
    const avgKw = s.average / 1000;
    const cost = totalKwh * this.ratePerKwh;
    const fillRatio = Math.min(totalKwh / this.budgetKwh, 1);
    const filled = Math.round(fillRatio * SEGMENTS);

    this.drawSegments(filled);
    this.setCentre(peakKw.toFixed(2), `$${cost.toFixed(2)}`);
    this.setBudgetBar(fillRatio);
    this.setAlert(fillRatio);
    this.setMiniStats(totalKwh, peakKw, avgKw, cost);
    this.setInsightFromData(this.currentData);
  }

  drawSegments(filled) {
    for (let i = 0; i < SEGMENTS; i++) {
      const el = this.svg.querySelector(`[data-idx="${i}"]`);
      if (!el) continue;
      el.setAttribute('stroke', i < filled ? COLOURS[i] : DIM);
    }
  }

  setCentre(value, cost) {
    document.getElementById('gauge-value').textContent = value;
    document.getElementById('gauge-cost').textContent = cost;
  }

  setBudgetBar(ratio) {
    const pct = Math.min(ratio * 100, 100);
    const fill = document.getElementById('budget-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('over', ratio >= 1);
  }

  setAlert(ratio) {
    const badge = document.getElementById('alert-badge');
    if (ratio === null) {
      badge.className = 'alert-badge ok';
      badge.innerHTML = '<span>&#10003;</span><span>No Data</span>';
    } else if (ratio >= 1) {
      badge.className = 'alert-badge danger';
      badge.innerHTML = '<span>&#9889;</span><span>Over Budget</span>';
    } else if (ratio >= 0.8) {
      badge.className = 'alert-badge warning';
      badge.innerHTML = '<span>&#9889;</span><span>High Usage</span>';
    } else {
      badge.className = 'alert-badge ok';
      badge.innerHTML = '<span>&#10003;</span><span>On Track</span>';
    }
  }

  setInsight(text) {
    document.getElementById('insight-text').textContent = text;
  }

  setInsightFromData(data) {
    if (!data || !data.labels || !data.values || data.values.length === 0) {
      this.setInsight('No hourly data to analyse for this date.');
      return;
    }

    let peakVal = -1, peakIdx = -1;
    for (let i = 0; i < data.values.length; i++) {
      if (data.values[i] > peakVal) {
        peakVal = data.values[i];
        peakIdx = i;
      }
    }

    if (peakIdx === -1) {
      this.setInsight('No significant usage detected today.');
      return;
    }

    const peakHour = data.labels[peakIdx];
    const peakKw = (peakVal / 1000).toFixed(1);

    const hourNum = parseInt(peakHour);
    let suggestion = '';
    if (hourNum >= 18) {
      suggestion = 'Try running high-usage appliances earlier in the day to reduce peak costs.';
    } else if (hourNum >= 6 && hourNum <= 9) {
      suggestion = 'Consider using timers to spread morning load more evenly.';
    } else if (hourNum >= 0 && hourNum <= 5) {
      suggestion = 'Overnight draw detected. Check for devices left on standby.';
    } else {
      suggestion = 'Spreading usage across the day can help stay within budget.';
    }

    this.setInsight(`Peak at ${peakHour} (${peakKw} kW). ${suggestion}`);
  }

  setMiniStats(totalKwh, peakKw, avgKw, cost) {
    const set = (id, v, suffix) => {
      const el = document.getElementById(id);
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
    if (cost === null || cost === undefined) {
      costEl.textContent = '--';
    } else {
      costEl.textContent = `$${cost.toFixed(2)}`;
    }
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
