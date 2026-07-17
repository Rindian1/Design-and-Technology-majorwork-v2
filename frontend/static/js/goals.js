class GoalsManager {
    constructor() {
        this._container = document.getElementById('goals-container');
        this._setupDelegation();
    }

    _setupDelegation() {
        document.addEventListener('click', (e) => {
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

        const headerHtml = `
            <div class="goals-header">
                <span class="goals-header-icon">\u{1f3c6}</span>
                <div>
                    <div class="goals-header-label">Your Points</div>
                </div>
                <span class="goals-header-points">${points}</span>
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
                <div class="goal-metrics">
                    <div class="goal-metric-box reward">
                        <div class="goal-metric-value">+${goal.completion_reward}</div>
                        <div class="goal-metric-label">Reward</div>
                    </div>
                    <div class="goal-metric-box stake">
                        <div class="goal-metric-value">\u2212${goal.stake_amount}</div>
                        <div class="goal-metric-label">Stake</div>
                    </div>
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
