class GoalsManager {
    constructor() {
        this._container = document.getElementById('goals-container');
        this._prevPoints = null;
        this._setupDelegation();
    }

    _setupDelegation() {
        document.addEventListener('click', (e) => {
            const badge = e.target.closest('#points-badge');
            if (badge && typeof navigation !== 'undefined') {
                navigation.switchTab('goals');
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
            </div>
        `;

        const cardsHtml = goals.map(g => this._renderCard(g)).join('');

        this._container.innerHTML = `
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
        let blocks = '';
        for (let i = 0; i < total; i++) {
            const cls = i < filled ? 'seg-block filled' : 'seg-block';
            blocks += `<span class="${cls}"></span>`;
        }
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
}

const goalsManager = new GoalsManager();
