class GoalsManager {
    constructor() {
        this._container = document.getElementById('goals-container');
        this._prevPoints = null;
        this._prevFilled = null;
        this._prevGoalStates = null;
        this._ff = { running: false };
        this._intensityModal = null;
        this._activeGoalForPicker = null;
        this._setupDelegation();
        this._setupResetConfirm();
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
                this._openResetConfirm();
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
            if (goalId) this._handleToggleClick(goalId);
        });

        document.addEventListener('click', (e) => {
            const claimBtn = e.target.closest('.goal-claim-btn');
            if (!claimBtn) return;
            const goalId = claimBtn.getAttribute('data-goal-id');
            if (goalId) this.claimGoal(goalId);
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.intensity-close')) {
                this._closeIntensityPicker();
                return;
            }
            if (e.target.closest('.intensity-modal-overlay') && !e.target.closest('.intensity-modal-content')) {
                this._closeIntensityPicker();
                return;
            }
            const btn = e.target.closest('.intensity-btn');
            if (!btn) return;
            const intensity = parseInt(btn.getAttribute('data-intensity'), 10);
            if (this._activeGoalForPicker !== null && !isNaN(intensity)) {
                this._activateWithIntensity(this._activeGoalForPicker, intensity);
            }
        });
    }

    _setupResetConfirm() {
        const modal = document.getElementById('confirm-modal');
        if (!modal) return;
        const hide = () => modal.classList.add('hidden');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        if (okBtn) okBtn.addEventListener('click', () => {
            hide();
            this._resetGoals();
        });
        if (cancelBtn) cancelBtn.addEventListener('click', hide);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hide();
        });
    }

    _openResetConfirm() {
        const modal = document.getElementById('confirm-modal');
        if (!modal) return;
        const message = document.getElementById('confirm-message');
        if (message) message.textContent = 'Are you sure you would like to do this?';
        modal.classList.remove('hidden');
    }

    _handleToggleClick(goalId) {
        const card = this._container.querySelector(`[data-goal-id="${goalId}"]`);
        if (!card) return;
        const isActive = card.querySelector('.goal-toggle.active') !== null;
        if (isActive) {
            this._deactivateGoal(goalId);
        } else {
            this._showIntensityPicker(goalId);
        }
    }

    _getIntensityLabel(goalId, cfg) {
        if (!cfg) return '';
        const target = cfg.target;
        const threshold = cfg.threshold_pct || 0;
        const budgetScale = cfg.budget_scale;

        if (goalId === 'budget_streak') {
            if (threshold > 0) return `${target}+${threshold}%`;
            return `${target} days`;
        }
        if (goalId === 'weekly_reduction') {
            const pct = Math.round((budgetScale || 1) * 100);
            return `${pct}%`;
        }
        if (goalId === 'offpeak_shift') {
            return `${threshold}% off`;
        }
        return `${target}`;
    }

    _showIntensityPicker(goalId) {
        const goals = this._currentGoals;
        if (!goals) return;
        const goal = goals.find(g => g.goal_id === goalId);
        if (!goal || !goal.intensity_config) return;

        this._activeGoalForPicker = goalId;

        if (!this._intensityModal) {
            this._intensityModal = document.createElement('div');
            this._intensityModal.className = 'intensity-modal-overlay';
            document.body.appendChild(this._intensityModal);
        }

        const intensities = goal.intensity_config;
        const currentIntensity = goal.status === 'active' ? goal.intensity : -1;

        const buttonsHtml = intensities.map((cfg, i) => `
            <button class="intensity-btn ${i === currentIntensity ? 'active' : ''}" data-intensity="${i}">
                <span class="intensity-btn-label">${this._escapeHtml(this._getIntensityLabel(goal.goal_id, cfg))}</span>
                <span class="intensity-btn-reward">+${cfg.reward}</span>
            </button>
        `).join('');

        this._intensityModal.innerHTML = `
            <div class="intensity-modal-content">
                <h2 class="intensity-title">Intensity</h2>
                <div class="intensity-buttons">
                    ${buttonsHtml}
                </div>
                <button class="intensity-close">Close</button>
            </div>
        `;
        this._intensityModal.classList.add('show');
    }

    _closeIntensityPicker() {
        if (this._intensityModal) {
            this._intensityModal.classList.remove('show');
        }
        this._activeGoalForPicker = null;
    }

    async _activateWithIntensity(goalId, intensity) {
        this._closeIntensityPicker();
        try {
            const result = await energyAPI.request(`/api/goals/${goalId}/activate`, {
                method: 'POST',
                body: JSON.stringify({ intensity }),
            });
            if (result.status === 'ok') {
                await this.loadGoals();
            }
        } catch (err) {
            console.error('Failed to activate goal:', err);
        }
    }

    async _deactivateGoal(goalId) {
        try {
            const result = await energyAPI.request(`/api/goals/${goalId}/toggle`, {
                method: 'POST',
                body: '{}',
            });
            if (result.status === 'ok') {
                await this.loadGoals();
            }
        } catch (err) {
            console.error('Failed to deactivate goal:', err);
        }
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
            this._currentGoals = data.goals || [];
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
                <span class="goals-header-icon"><img src="/static/images/Medal.svg?v=1" alt="Medal" class="goals-header-img"></span>
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

        this._checkNotifications(goals);

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
        const isClaimable = goal.pending_claim;
        const activeClass = isActive ? '' : 'inactive';

        const progressHtml = goal.type === 'streak'
            ? this._renderSegmented(goal)
            : this._renderLinear(goal);

        const intensityHtml = goal.max_intensities > 1
            ? `<div class="goal-tier">Intensity ${goal.intensity + 1}/${goal.max_intensities}</div>`
            : '';

        const rewardHtml = isClaimable
            ? `<div class="goal-metric-box reward claimable">
                   <button class="goal-claim-btn" data-goal-id="${goal.goal_id}">
                       <div class="goal-metric-value">Claim!</div>
                       <div class="goal-metric-label">+${goal.completion_reward} pts</div>
                   </button>
                   ${intensityHtml}
               </div>`
            : `<div class="goal-metric-box reward">
                   <div class="goal-metric-value">+${goal.completion_reward}</div>
                   <div class="goal-metric-label">Reward</div>
                   ${intensityHtml}
               </div>`;

        return `
            <div class="goal-card ${activeClass}" data-goal-id="${goal.goal_id}">
                <div class="goal-activation">
                    <button class="goal-toggle ${isActive ? 'active' : ''}"
                            aria-label="${isActive ? 'Deactivate' : 'Activate'} goal"></button>
                </div>
                <div class="goal-body">
                    <div class="goal-description">${this._escapeHtml(goal.description)}</div>
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
        this._handleToggleClick(goalId);
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
                this._showNotification('reset', 'Goal reset — keep going!');
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
                    intensity: g.intensity,
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
                    intensity: g.intensity,
                    pending_claim: g.pending_claim,
                };
                return;
            }

            if (!prev.pending_claim && g.pending_claim) {
                this._showNotification('claim', g.description);
            } else if (prev.current_streak > 0 && g.current_streak === 0 && !g.completed && !g.pending_claim) {
                this._showNotification('failure', g.description);
            }

            this._prevGoalStates[g.goal_id] = {
                completed: g.completed,
                current_streak: g.current_streak,
                intensity: g.intensity,
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

        const icons = {
            claim: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><rect x="5" y="12" width="14" height="10" rx="1"/><path d="M12 8v14"/><path d="M7 8c0-2 2-3 5-3s5 1 5 3"/></svg>',
            failure: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
            reset: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 5 3 11 9 11"/></svg>'
        };
        const titles = {
            claim: 'Goal reached! Claim your reward!',
            failure: 'Goal was not met and has been reset. Try again!',
            reset: 'Goal reset — keep going!',
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
                <span class="goals-header-icon"><img src="/static/images/Medal.svg?v=1" alt="Medal" class="goals-header-img"></span>
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
        this._currentGoals = null;
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
