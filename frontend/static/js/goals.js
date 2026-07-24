class GoalsManager {
    constructor() {
        this._container = document.getElementById('goals-container');
        this._prevPoints = null;
        this._prevFilled = null;
        this._ff = { running: false, timer: null, date: null, ticking: false, started: false, lingerTimer: null, dateBeforeFF: null };
        this._setupDelegation();
    }

    _setupDelegation() {
        document.addEventListener('click', (e) => {
            const badge = e.target.closest('#points-badge');
            if (badge && typeof navigation !== 'undefined') {
                navigation.switchTab('goals');
                return;
            }
            const resetBtn = e.target.closest('#ff-goals-reset');
            if (resetBtn) {
                e.stopPropagation();
                this._resetGoals();
                return;
            }
            const btn = e.target.closest('.goal-toggle');
            if (!btn) return;
            const card = btn.closest('[data-goal-id]');
            if (!card) return;
            const goalId = card.getAttribute('data-goal-id');
            if (goalId) this.toggleGoal(goalId);
        });
    }

    async loadGoals() {
        if (!this._container) return;
        this._showLoading();

        try {
            const data = await energyAPI.request(`/api/goals?_=${Date.now()}`);
            this._render(data);
        } catch (err) {
            this._showError('Failed to load goals.');
        }
    }

    _render(data) {
        const goals = data.goals || [];
        const points = data.points_total || 0;
        const prevPoints = this._prevPoints;
        this._prevPoints = points;

        const headerHtml = `
            <div class="goals-header ${prevPoints !== null && points > prevPoints ? 'points-flash' : ''}">
                <span class="goals-header-icon">\u{1f3c6}</span>
                <div>
                    <div class="goals-header-label">Your Points${INFO.icon('points')}</div>
                </div>
                <span class="goals-header-points" id="goals-counter">${prevPoints !== null && points > prevPoints ? prevPoints : points}</span>
                <div class="ff-controls">
                    <button id="ff-goals-reset" class="ff-goals-reset" title="Reset all goals and points">&#8634;</button>
                </div>
            </div>
        `;

        const cardsHtml = goals.map(g => this._renderCard(g)).join('');

        this._container.innerHTML = `
            <h1 class="gi-title"><span class="info-heading">Goals${INFO.icon('points')}</span></h1>
            ${headerHtml}
            <div class="goals-list">${cardsHtml}</div>
        `;

        goals.forEach(g => {
            if (g.status === 'active') {
                const btn = this._container.querySelector(`[data-goal-id="${g.goal_id}"] .goal-toggle`);
                if (btn) btn.classList.add('active');
            }
        });

        this._updatePointsBadge(points);

        if (prevPoints !== null && points > prevPoints) {
            this._animateCounter(prevPoints, points, 'goals-counter');
            this._triggerConfetti();
        }
    }

    _updatePointsBadge(points) {
        const el = document.getElementById('points-badge-value');
        if (el) el.textContent = points;
    }

    _renderCard(goal) {
        const isActive = goal.status === 'active';
        const isCompleted = goal.completed;
        const activeClass = isActive && !isCompleted ? '' : 'inactive';
        const completedClass = isCompleted ? 'completed' : '';

        const progressHtml = goal.type === 'streak'
            ? this._renderSegmented(goal)
            : this._renderLinear(goal);

        return `
            <div class="goal-card ${activeClass}" data-goal-id="${goal.goal_id}">
                <div class="goal-activation">
                    <button class="goal-toggle ${isActive && !isCompleted ? 'active' : ''}"
                            aria-label="${isActive ? 'Deactivate' : 'Activate'} goal"></button>
                </div>
                <div class="goal-body">
                    <div class="goal-description ${completedClass}">${this._escapeHtml(goal.description)}</div>
                    <div class="goal-progress">${progressHtml}</div>
                </div>
                <div class="goal-metric-box reward">
                    <div class="goal-metric-value">+${goal.completion_reward}</div>
                    <div class="goal-metric-label">Reward</div>
                </div>
            </div>
        `;
    }

    _renderSegmented(goal) {
        const total = Math.round(goal.target_value);
        const filled = Math.min(Math.round(goal.current_value), total);
        const prevFilled = this._prevFilled?.[goal.goal_id] ?? 0;

        let blocks = '';
        for (let i = 0; i < total; i++) {
            if (i < filled) {
                const isNew = i >= prevFilled;
                const cls = isNew && !this._ff.running ? 'seg-block filled new' : 'seg-block filled';
                blocks += `<span class="${cls}"></span>`;
            } else {
                blocks += `<span class="seg-block"></span>`;
            }
        }

        if (!this._prevFilled) this._prevFilled = {};
        this._prevFilled[goal.goal_id] = filled;

        return `<div class="progress-segmented">${blocks}</div>`;
    }

    _renderLinear(goal) {
        const pct = goal.target_value > 0
            ? Math.min((goal.current_value / goal.target_value) * 100, 100)
            : 0;
        return `
            <div class="progress-linear-track">
                <div class="progress-linear-fill" style="width:${pct}%"></div>
            </div>
            <div style="font-size:10px;color:#888;margin-top:3px">${this._escapeHtml(goal.timeframe_label)}</div>
        `;
    }

    _animateCounter(from, to, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const duration = 600;
        const start = performance.now();
        const diff = to - from;

        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(from + diff * eased);
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = to;
            }
        };

        requestAnimationFrame(tick);
    }

    _triggerConfetti() {
        const frag = document.createDocumentFragment();
        const colors = ['#00e676', '#ffab00', '#ff5252', '#448aff', '#e040fb', '#fff'];
        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.top = '-10px';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (Math.random() * 6 + 4) + 'px';
            piece.style.height = (Math.random() * 6 + 4) + 'px';
            piece.style.animationDuration = (Math.random() * 1.5 + 1) + 's';
            piece.style.animationDelay = (Math.random() * 0.5) + 's';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            frag.appendChild(piece);
        }
        const overlay = document.createElement('div');
        overlay.className = 'confetti-overlay';
        overlay.appendChild(frag);
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 2500);
    }

    async toggleGoal(goalId) {
        try {
            const result = await energyAPI.request(`/api/goals/${goalId}/toggle`, {
                method: 'POST',
                body: '{}',
            });
            if (result.status === 'ok') {
                await this.loadGoals();
            }
        } catch (err) {
            console.error('Failed to toggle goal:', err);
        }
    }

    _showLoading() {
        this._container.innerHTML = `
            <div class="recs-state">
                <div class="loading-spinner"></div>
                <p class="recs-state-text">Loading goals...</p>
            </div>
        `;
    }

    _showError(msg) {
        this._container.innerHTML = `
            <div class="recs-state recs-error">
                <p class="recs-state-text">${this._escapeHtml(msg)}</p>
            </div>
        `;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async _startFF() {
        if (this._ff.started) return;
        this._ff.started = true;

        if (window.dashboard?.ff?.running) window.dashboard._stopFF();
        if (typeof recsManager !== 'undefined' && recsManager._ff.running) recsManager._stopFF();

        const ffBtn = document.getElementById('ff-btn');
        const ffTime = document.getElementById('ff-time');

        let range;
        try {
            range = await energyAPI.getDateRange();
        } catch (e) {
            this._ff.started = false;
            return;
        }
        if (!range || !range.earliest) {
            this._ff.started = false;
            return;
        }

        try {
            await energyAPI.request('/api/goals/demo-init', {
                method: 'POST',
                body: JSON.stringify({ date: navigation.currentDate }),
            });
        } catch (e) { /* proceed even if demo-init fails */ }

        this._ff.dateBeforeFF = navigation.currentDate;
        this._ff.running = true;
        this._ff.date = navigation.currentDate;
        this._ff.ticking = false;

        if (ffBtn) { ffBtn.classList.add('running'); ffBtn.innerHTML = '&#9646;&#9646;'; }
        if (ffTime) ffTime.classList.remove('hidden');

        this._updateGlobalDate(this._ff.date);

        energyAPI.clearCache();
        this._tickFF();
        this._ff.timer = setInterval(() => this._tickFF(), 2000);
    }

    _stopFF(manual = true) {
        clearInterval(this._ff.timer);
        clearTimeout(this._ff.lingerTimer);
        this._ff.running = false;
        this._ff.timer = null;
        this._ff.ticking = false;
        this._ff.started = false;

        const ffBtn = document.getElementById('ff-btn');
        const ffTime = document.getElementById('ff-time');
        if (ffBtn) { ffBtn.classList.remove('running'); ffBtn.innerHTML = '&#9654;'; }
        if (ffTime) ffTime.classList.add('hidden');

        if (!manual) {
            this._ff.lingerTimer = setTimeout(() => {
                if (navigation) {
                    navigation.navigateToDate(this._ff.dateBeforeFF);
                }
            }, 3000);
        }
    }

    async _tickFF() {
        if (this._ff.ticking) return;
        this._ff.ticking = true;

        try {
            const { date } = this._ff;
            if (!date) { this._stopFF(); return; }

            const range = await energyAPI.getDateRange().catch(() => null);
            if (!range || date > range.latest) { this._stopFF(false); return; }
            if (!this._ff.running) return;

            try {
                energyAPI.clearCache();
                const data = await energyAPI.request(`/api/goals?date=${date}&_=${Date.now()}`);
                if (!this._ff.running) return;
                this._renderFF(data);
            } catch (e) {
                console.error('FF goals tick failed:', e);
            }

            this._updateGlobalDate(date);

            const ffTime = document.getElementById('ff-time');
            if (ffTime) {
                const d = new Date(date + 'T00:00:00');
                ffTime.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }

            const next = new Date(date);
            next.setDate(next.getDate() + 1);
            this._ff.date = next.toISOString().split('T')[0];
        } finally {
            this._ff.ticking = false;
        }
    }

    _renderFF(data) {
        const goals = data.goals || [];
        const points = data.points_total || 0;
        const prevPoints = this._prevPoints;
        this._prevPoints = points;

        const cardsHtml = goals.map(g => this._renderCard(g)).join('');

        this._container.innerHTML = `
            <h1 class="gi-title"><span class="info-heading">Goals${INFO.icon('points')}</span></h1>
            <div class="goals-header">
                <span class="goals-header-icon">\u{1f3c6}</span>
                <div>
                    <div class="goals-header-label">Your Points${INFO.icon('points')}</div>
                </div>
                <span class="goals-header-points" id="goals-counter">${points}</span>
                <div class="ff-controls">
                    <button id="ff-goals-reset" class="ff-goals-reset" title="Reset all goals and points">&#8634;</button>
                </div>
            </div>
            <div class="goals-list">${cardsHtml}</div>
        `;

        goals.forEach(g => {
            if (g.status === 'active') {
                const btn = this._container.querySelector(`[data-goal-id="${g.goal_id}"] .goal-toggle`);
                if (btn) btn.classList.add('active');
            }
        });

        this._updatePointsBadge(points);

        if (prevPoints !== null && points > prevPoints) {
            this._animateCounter(prevPoints, points, 'goals-counter');
            this._triggerConfetti();
        }
    }

    _updateGlobalDate(dateStr) {
        if (navigation) {
            navigation.currentDate = dateStr;
            navigation.updateDateDisplay();
            navigation.updateNavigationButtons();
        }
    }

    async _resetGoals() {
        if (this._ff.running) this._stopFF(true);
        this._prevFilled = {};
        try {
            await energyAPI.request('/api/goals/reset', { method: 'POST' });
            energyAPI.clearCache();
            this._prevPoints = null;
            await this.loadGoals();
        } catch (e) {
            console.error('Failed to reset goals:', e);
        }
    }
}

const goalsManager = new GoalsManager();
