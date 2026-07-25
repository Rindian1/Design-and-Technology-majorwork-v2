class GoalsManager {
    constructor() {
        this._container = document.getElementById('goals-container');
        this._prevPoints = null;
        this._prevFilled = null;
        this._prevGoalStates = null;
        this._ff = { running: false };
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
            const notif = e.target.closest('.goal-notification');
            if (notif) {
                if (typeof navigation !== 'undefined') navigation.switchTab('goals');
                notif.remove();
                return;
            }
            const btn = e.target.closest('.goal-toggle');
            if (!btn) return;
            const card = btn.closest('[data-goal-id]');
            if (!card) return;
            const goalId = card.getAttribute('data-goal-id');
            if (goalId) this.toggleGoal(goalId);
        });

        document.addEventListener('click', (e) => {
            const claimBtn = e.target.closest('.goal-claim-btn');
            if (!claimBtn) return;
            const goalId = claimBtn.getAttribute('data-goal-id');
            if (goalId) this.claimGoal(goalId);
        });
    }

    async loadGoals() {
        if (!this._container) return;
        this._showLoading();

        try {
            const targetDate = (typeof navigation !== 'undefined') ? navigation.getCurrentDate() : undefined;
            const url = targetDate
                ? `/api/goals?date=${targetDate}&_=${Date.now()}`
                : `/api/goals?_=${Date.now()}`;
            const data = await energyAPI.request(url);
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

        goals.sort((a, b) => (a.status === 'active' ? -1 : 1));

        const cardsHtml = goals.map(g => this._renderCard(g)).join('');

        this._container.innerHTML = `
            <h1 class="gi-title"><span class="info-heading">Goals${INFO.icon('feat_goals')}</span></h1>
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
        const isClaimable = goal.pending_claim;
        const activeClass = isActive && !isCompleted ? '' : 'inactive';
        const completedClass = isCompleted ? 'completed' : '';

        const progressHtml = goal.type === 'streak'
            ? this._renderSegmented(goal)
            : this._renderLinear(goal);

        const tierHtml = goal.max_tiers > 1
            ? `<div class="goal-tier">Tier ${goal.tier + 1}/${goal.max_tiers}</div>`
            : '';

        const rewardHtml = isClaimable
            ? `<div class="goal-metric-box reward claimable">
                   <button class="goal-claim-btn" data-goal-id="${goal.goal_id}">
                       <div class="goal-metric-value">Claim!</div>
                       <div class="goal-metric-label">+${goal.completion_reward} pts</div>
                   </button>
                   ${tierHtml}
               </div>`
            : `<div class="goal-metric-box reward">
                   <div class="goal-metric-value">+${goal.completion_reward}</div>
                   <div class="goal-metric-label">Reward</div>
                   ${tierHtml}
               </div>`;

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
                ${rewardHtml}
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

    async claimGoal(goalId) {
        try {
            const result = await energyAPI.request(`/api/goals/${goalId}/claim`, {
                method: 'POST',
                body: '{}',
            });
            if (result.status === 'ok') {
                const prevPoints = this._prevPoints;
                await this.loadGoals();
                if (result.reward && prevPoints !== null) {
                    const newPoints = prevPoints + result.reward;
                    this._prevPoints = newPoints;
                    this._updatePointsBadge(newPoints);
                    this._animateCounter(prevPoints, newPoints, 'goals-counter');
                    this._triggerConfetti();
                }
            }
        } catch (err) {
            console.error('Failed to claim goal:', err);
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

    _checkNotifications(goals) {
        if (!this._prevGoalStates) {
            this._prevGoalStates = {};
            goals.forEach(g => {
                this._prevGoalStates[g.goal_id] = {
                    completed: g.completed,
                    current_streak: g.current_streak,
                    tier: g.tier,
                    pending_claim: g.pending_claim,
                };
            });
            return;
        }

        goals.forEach(g => {
            const prev = this._prevGoalStates[g.goal_id];
            if (!prev) {
                this._prevGoalStates[g.goal_id] = {
                    completed: g.completed,
                    current_streak: g.current_streak,
                    tier: g.tier,
                    pending_claim: g.pending_claim,
                };
                return;
            }

            if (!prev.completed && g.completed) {
                this._showNotification('success', g.description);
            } else if (g.tier !== undefined && prev.tier !== undefined && g.tier > prev.tier) {
                this._showNotification('tier', g.description);
            } else if (!prev.pending_claim && g.pending_claim) {
                this._showNotification('claim', g.description);
            } else if (prev.current_streak > 0 && g.current_streak === 0 && !g.completed && !g.pending_claim) {
                this._showNotification('failure', g.description);
            }

            this._prevGoalStates[g.goal_id] = {
                completed: g.completed,
                current_streak: g.current_streak,
                tier: g.tier,
                pending_claim: g.pending_claim,
            };
        });
    }

    _showNotification(type, description) {
        let container = document.getElementById('goal-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'goal-notifications';
            document.body.appendChild(container);
        }

        const notif = document.createElement('div');
        notif.className = `goal-notification goal-notification-${type}`;

        const icons = { success: '&#127881;', tier: '&#127942;', claim: '&#127873;', failure: '&#9888;' };
        const titles = {
            success: 'Congratulations! Goal completed!',
            tier: 'Goal tier advanced! Keep going!',
            claim: 'Goal reached! Claim your reward!',
            failure: 'Goal was not met and has been reset. Try again!',
        };
        const icon = icons[type] || icons.failure;
        const title = titles[type] || titles.failure;

        notif.innerHTML = `
            <div class="goal-notification-icon">${icon}</div>
            <div class="goal-notification-body">
                <div class="goal-notification-title">${title}</div>
                <div class="goal-notification-desc">${this._escapeHtml(description)}</div>
            </div>
        `;

        container.appendChild(notif);
        requestAnimationFrame(() => notif.classList.add('show'));

        setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 400);
        }, 5000);
    }

    _startFF() {
        if (typeof dashboard !== 'undefined') dashboard._startDayFF();
    }

    _stopFF(manual = true) {
        if (typeof dashboard !== 'undefined') dashboard._stopDayFF(manual);
    }

    _renderFF(data) {
        const goals = data.goals || [];
        const points = data.points_total || 0;
        const prevPoints = this._prevPoints;
        this._prevPoints = points;

        goals.sort((a, b) => (a.status === 'active' ? -1 : 1));

        const cardsHtml = goals.map(g => this._renderCard(g)).join('');

        this._container.innerHTML = `
            <h1 class="gi-title"><span class="info-heading">Goals${INFO.icon('feat_goals')}</span></h1>
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

    async _resetGoals() {
        if (typeof dashboard !== 'undefined' && dashboard._dayFF.running) dashboard._stopDayFF(true);
        if (typeof dashboard !== 'undefined') dashboard._dayFF.claimableStop = false;
        this._prevFilled = {};
        this._prevGoalStates = null;
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
