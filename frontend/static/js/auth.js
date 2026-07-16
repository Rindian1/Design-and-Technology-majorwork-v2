class AuthManager {
    constructor() {
        this._questions = null;
    }

    async checkSession() {
        try {
            return await energyAPI.getSession();
        } catch {
            return null;
        }
    }

    async login(email, password) {
        return energyAPI.login(email, password);
    }

    async register(email, password) {
        return energyAPI.register(email, password);
    }

    async demoLogin() {
        return energyAPI.demoLogin();
    }

    async logout() {
        return energyAPI.logout();
    }

    async loadSurveyQuestions() {
        if (this._questions) return this._questions;
        const data = await energyAPI.getSurveyQuestions();
        this._questions = data;
        return data;
    }

    renderSurveyForm(containerId, opts) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const onSubmit = typeof opts === 'function' ? opts : (opts?.onSubmit || (() => {}));
        const submitText = opts?.submitText || 'Save';
        const initialAnswers = opts?.initialAnswers || null;
        const showCancel = opts?.showCancel || false;

        this.loadSurveyQuestions().then(questions => {
            const steps = [...new Set(questions.map(q => q.step))].sort();
            let currentStep = 0;
            const answers = initialAnswers ? JSON.parse(JSON.stringify(initialAnswers)) : {};

            if (showCancel) {
                const existingCancel = container.querySelector('.survey-cancel-bar');
                if (!existingCancel) {
                    const bar = document.createElement('div');
                    bar.className = 'survey-cancel-bar';
                    bar.innerHTML = '<button type="button" class="btn btn-secondary" id="survey-cancel">Cancel</button>';
                    container.parentElement?.insertBefore(bar, container);
                    document.getElementById('survey-cancel')?.addEventListener('click', () => {
                        window.location.href = '/';
                    });
                }
            }

            const render = () => {
                const stepQs = questions.filter(q => q.step === steps[currentStep]);

                if (currentStep === 1) {
                    this._renderStep2(container, stepQs, answers, steps, currentStep, () => {
                        currentStep++;
                        render();
                    }, () => {
                        if (currentStep > 0) { currentStep--; render(); }
                    }, () => {
                        const s3qs = questions.filter(q => q.step === steps[steps.length - 1]);
                        this._renderFinalStep(container, s3qs, answers, steps, steps.length - 1, submitText, onSubmit, () => {
                            currentStep--;
                            render();
                        });
                    });
                } else if (currentStep === steps.length - 1) {
                    this._renderFinalStep(container, stepQs, answers, steps, currentStep, submitText, onSubmit, () => {
                        currentStep--;
                        render();
                    });
                } else {
                    this._renderSimpleStep(container, stepQs, answers, steps, currentStep, () => {
                        currentStep++;
                        render();
                    }, () => {
                        if (currentStep > 0) { currentStep--; render(); }
                    });
                }
            };

            render();
        }).catch(err => {
            container.innerHTML = `<div class="recs-state recs-error"><p class="recs-state-text">Failed to load survey: ${err.message}</p></div>`;
        });
    }

    _renderSimpleStep(container, questions, answers, steps, currentStep, onNext, onPrev) {
        let html = this._stepIndicator(steps, currentStep);
        html += `<h3 class="survey-step-title">Step ${currentStep + 1} of ${steps.length}</h3>`;
        html += `<div class="survey-fields">`;
        questions.forEach(q => {
            html += this._renderField(q, answers[q.id]);
        });
        html += `</div>`;
        html += this._stepActions(currentStep, steps.length, false, true);
        container.innerHTML = html;
        this._attachFieldBehaviours(container, questions, answers);
        this._wireActions(container, questions, answers, currentStep, steps, onNext, onPrev);
    }

    _renderStep2(container, questions, answers, steps, currentStep, onNext, onPrev, onDone) {
        let html = this._stepIndicator(steps, currentStep);
        html += `<h3 class="survey-step-title">Step ${currentStep + 1} of ${steps.length}</h3>`;
        html += `<div class="survey-fields">`;
        const ordered = this._orderStep2(questions);
        ordered.forEach(q => {
            const containerStyle = q.depends_on ? ' style="display:none"' : '';
            html += `<div class="survey-field-wrap" data-qid="${q.id}"${containerStyle}>`;
            if (q.type === 'subheading') {
                html += this._renderSubheading(q);
            } else {
                html += this._renderField(q, answers[q.id]);
            }
            html += `</div>`;
        });
        html += `</div>`;
        html += this._stepActions(currentStep, steps.length, false, false);
        container.innerHTML = html;
        this._attachFieldBehaviours(container, questions, answers);
        this._wireStep2(container, questions, answers, currentStep, steps, onNext, onPrev, onDone);
        this._reEvaluateStep2(container, questions, answers);
    }

    _renderFinalStep(container, questions, answers, steps, currentStep, submitText, onSubmit, onPrev) {
        let html = this._stepIndicator(steps, currentStep);
        html += `<h3 class="survey-step-title">Step ${currentStep + 1} of ${steps.length}</h3>`;
        html += `<div class="survey-fields">`;
        questions.forEach(q => {
            html += this._renderField(q, answers[q.id]);
        });
        html += `</div>`;
        html += `<div class="survey-actions">`;
        html += `<button type="button" class="btn btn-secondary" id="survey-prev">Back</button>`;
        html += `<button type="submit" class="btn btn-primary" id="survey-submit">${submitText}</button>`;
        html += `</div></div>`;
        container.innerHTML = html;
        this._attachFieldBehaviours(container, questions, answers);
        document.getElementById('survey-prev')?.addEventListener('click', onPrev);
        document.getElementById('survey-submit')?.addEventListener('click', (e) => {
            e.preventDefault();
            this._collectStepAnswers(container, questions, answers);
            if (!this._validateStep(questions, answers)) return;
            onSubmit(answers);
        });
    }

    _stepIndicator(steps, currentStep) {
        let html = `<div class="step-indicator">`;
        steps.forEach((s, i) => {
            if (i > 0) html += `<span class="step-line"></span>`;
            html += `<span class="step-dot${i === currentStep ? ' active' : ''}${i < currentStep ? ' done' : ''}"></span>`;
        });
        html += `</div>`;
        return html;
    }

    _stepActions(currentStep, totalSteps, canSubmit, enabled) {
        let html = `<div class="survey-actions">`;
        if (currentStep > 0) {
            html += `<button type="button" class="btn btn-secondary" id="survey-prev">Back</button>`;
        }
        html += `<button type="button" class="btn btn-primary" id="survey-next"${enabled ? '' : ' disabled'}>Next</button>`;
        html += `</div>`;
        return html;
    }

    _renderField(q, currentVal) {
        const val = currentVal || '';
        let html = `<div class="survey-field" id="field-${q.id}">`;
        html += `<label for="survey-${q.id}">${q.label}${q.required ? ' <span class="required">*</span>' : ''}</label>`;
        if (q.description) {
            html += `<p class="survey-desc">${q.description}</p>`;
        }
        if (q.type === 'select') {
            html += `<select id="survey-${q.id}" class="survey-input" ${q.required ? 'required' : ''}>`;
            html += `<option value="">-- Select --</option>`;
            (q.options || []).forEach(o => {
                const selected = val === o.value ? ' selected' : '';
                html += `<option value="${o.value}"${selected}>${o.label}</option>`;
            });
            html += `</select>`;
            if (q.has_other) {
                const otherVal = val && !(q.options || []).some(o => o.value === val) ? val : '';
                html += `<input type="text" id="survey-${q.id}-other" class="survey-other-input" placeholder="${q.other_placeholder || 'Please specify'}" value="${otherVal}" style="display:${otherVal ? 'block' : 'none'}">`;
            }
        } else if (q.type === 'multiselect') {
            html += `<div id="survey-${q.id}" class="survey-checkboxes">`;
            (q.options || []).forEach(o => {
                const checked = (val || []).includes(o.value);
                html += `<label class="checkbox-label"><input type="checkbox" value="${o.value}"${checked ? ' checked' : ''}> ${o.label}</label>`;
            });
            html += `</div>`;
        } else if (q.type === 'number') {
            html += `<input type="number" id="survey-${q.id}" class="survey-input" value="${val}" placeholder="${q.placeholder || ''}" min="${q.min || ''}" max="${q.max || ''}" ${q.required ? 'required' : ''}>`;
        } else if (q.type === 'text') {
            html += `<input type="text" id="survey-${q.id}" class="survey-input" value="${val}" placeholder="${q.placeholder || ''}">`;
        } else if (q.type === 'timerange') {
            html += `<div id="tr-${q.id}" class="timerange-wrap"></div>`;
        }
        html += `</div>`;
        return html;
    }

    _renderSubheading(q) {
        let html = `<div class="survey-subheading">`;
        html += `<h4>${q.label}</h4>`;
        if (q.description) {
            html += `<p class="survey-desc">${q.description}</p>`;
        }
        html += `</div>`;
        return html;
    }

    _renderTimerangeRows(container, qId, ranges) {
        const wrap = container.querySelector(`#tr-${qId}`);
        if (!wrap) return;
        const q = this._findQuestion(qId);
        const canAdd = q && q.can_add_multiple;
        let html = '';
        (ranges || [{ start: '', end: '' }]).forEach((r, i) => {
            html += `<div class="timerange-row" data-idx="${i}">`;
            html += this._hourSelect(`${qId}_start_${i}`, r.start);
            html += `<span class="timerange-sep">to</span>`;
            html += this._hourSelect(`${qId}_end_${i}`, r.end);
            if (canAdd && (ranges || []).length > 1) {
                html += `<button type="button" class="timerange-remove" data-qid="${qId}" data-idx="${i}">&times;</button>`;
            }
            html += `</div>`;
        });
        if (canAdd) {
            html += `<button type="button" class="timerange-add" data-qid="${qId}">+ Add another range</button>`;
        }
        wrap.innerHTML = html;
    }

    _hourSelect(name, selected) {
        const labels = [
            '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM',
            '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
            '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
            '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
        ];
        let html = `<select class="survey-input timerange-select" name="${name}" id="survey-${name}">`;
        html += `<option value="">--</option>`;
        for (let h = 0; h < 24; h++) {
            const sel = selected !== undefined && selected !== '' && Number(selected) === h ? ' selected' : '';
            html += `<option value="${h}"${sel}>${labels[h]}</option>`;
        }
        html += `</select>`;
        return html;
    }

    _findQuestion(id) {
        if (!this._questions) return null;
        return this._questions.find(q => q.id === id);
    }

    _orderStep2(questions) {
        const controlling = questions.filter(q => ['knows_plan', 'plan_type'].includes(q.id));
        const others = questions.filter(q => !['knows_plan', 'plan_type'].includes(q.id) && q.type !== 'subheading');
        const subheadings = questions.filter(q => q.type === 'subheading');
        const all = [...controlling, ...subheadings, ...others];
        return all;
    }

    _collectStepAnswers(container, questions, answers) {
        questions.forEach(q => {
            if (q.type === 'subheading') return;
            const fieldWrap = container.querySelector(`.survey-field-wrap[data-qid="${q.id}"]`);
            if (fieldWrap && fieldWrap.style.display === 'none') {
                delete answers[q.id];
                return;
            }
            if (q.type === 'timerange') {
                const wrap = container.querySelector(`#tr-${q.id}`);
                if (!wrap) return;
                const rows = wrap.querySelectorAll('.timerange-row');
                const ranges = [];
                rows.forEach(row => {
                    const idx = row.dataset.idx;
                    const startEl = container.querySelector(`select[name="${q.id}_start_${idx}"]`);
                    const endEl = container.querySelector(`select[name="${q.id}_end_${idx}"]`);
                    if (startEl && endEl && startEl.value !== '' && endEl.value !== '') {
                        ranges.push({ start: Number(startEl.value), end: Number(endEl.value) });
                    }
                });
                answers[q.id] = ranges;
                return;
            }
            if (q.type === 'multiselect') {
                const checked = container.querySelectorAll(`#survey-${q.id} input[type="checkbox"]:checked`);
                answers[q.id] = Array.from(checked).map(c => c.value);
                return;
            }
            const el = container.querySelector(`#survey-${q.id}`);
            if (!el) return;
            if (q.has_other && el.value === '__other__') {
                const otherEl = container.querySelector(`#survey-${q.id}-other`);
                answers[q.id] = otherEl ? otherEl.value.trim() : '';
            } else {
                answers[q.id] = el.value;
            }
        });
    }

    _attachFieldBehaviours(container, questions, answers) {
        questions.forEach(q => {
            if (q.type === 'subheading') return;
            if (q.type === 'timerange') {
                this._renderTimerangeRows(container, q.id, answers[q.id] || []);
                this._wireTimerange(container, q.id, answers);
                return;
            }
            if (q.has_other) {
                const sel = container.querySelector(`#survey-${q.id}`);
                if (sel) {
                    sel.addEventListener('change', () => {
                        const otherInput = container.querySelector(`#survey-${q.id}-other`);
                        if (otherInput) {
                            otherInput.style.display = sel.value === '__other__' ? 'block' : 'none';
                            if (sel.value !== '__other__') otherInput.value = '';
                        }
                    });
                }
            }
        });
    }

    _wireTimerange(container, qId, answers) {
        const q = this._findQuestion(qId);
        const canAdd = q && q.can_add_multiple;
        container.querySelectorAll(`.timerange-add[data-qid="${qId}"]`).forEach(btn => {
            btn.addEventListener('click', () => {
                const current = answers[qId] || [{ start: '', end: '' }];
                current.push({ start: '', end: '' });
                answers[qId] = current;
                this._renderTimerangeRows(container, qId, current);
                this._wireTimerange(container, qId, answers);
            });
        });
        if (canAdd) {
            container.querySelectorAll(`.timerange-remove[data-qid="${qId}"]`).forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.idx);
                    const current = answers[qId] || [{ start: '', end: '' }];
                    current.splice(idx, 1);
                    answers[qId] = current.length === 0 ? [{ start: '', end: '' }] : current;
                    this._renderTimerangeRows(container, qId, answers[qId]);
                    this._wireTimerange(container, qId, answers);
                });
            });
        }
    }

    _isVisible(container, question) {
        if (!question.depends_on) return true;
        const controlWrap = container.querySelector(`.survey-field-wrap[data-qid="${question.depends_on.question}"]`);
        if (controlWrap && controlWrap.style.display === 'none') return false;
        const controlEl = container.querySelector(`#survey-${question.depends_on.question}`);
        if (!controlEl) return true;
        return controlEl.value === question.depends_on.value;
    }

    _reEvaluateStep2(container, questions, answers) {
        questions.forEach(q => {
            if (!q.depends_on) return;
            const wrap = container.querySelector(`.survey-field-wrap[data-qid="${q.id}"]`);
            if (!wrap) return;
            const wasVisible = wrap.style.display !== 'none';
            const visible = this._isVisible(container, q);
            wrap.style.display = visible ? '' : 'none';

            if (q.type === 'timerange') {
                if (visible && !wasVisible) {
                    if (!answers[q.id] || answers[q.id].length === 0) {
                        answers[q.id] = [{ start: '', end: '' }];
                    }
                    this._renderTimerangeRows(container, q.id, answers[q.id]);
                    this._wireTimerange(container, q.id, answers);
                }
            }

            if (!visible && wasVisible) {
                delete answers[q.id];
                const el = container.querySelector(`#survey-${q.id}`);
                if (el) el.value = '';
            }
        });
        this._updateNextButton(container, questions, answers);
    }

    _updateNextButton(container, questions, answers) {
        const nextBtn = container.querySelector('#survey-next');
        if (!nextBtn) return;
        const allValid = this._step2AllValid(container, questions, answers);
        nextBtn.disabled = !allValid;
    }

    _step2AllValid(container, questions, answers) {
        for (const q of questions) {
            if (q.type === 'subheading') continue;
            if (!q.required) continue;
            if (q.depends_on && !this._isVisible(container, q)) continue;

            if (q.type === 'timerange') {
                const wrap = container.querySelector(`#tr-${q.id}`);
                if (!wrap) continue;
                const rows = wrap.querySelectorAll('.timerange-row');
                if (rows.length === 0) return false;
                let allFilled = true;
                rows.forEach(row => {
                    const idx = row.dataset.idx;
                    const startEl = container.querySelector(`select[name="${q.id}_start_${idx}"]`);
                    const endEl = container.querySelector(`select[name="${q.id}_end_${idx}"]`);
                    if (!startEl || !endEl || startEl.value === '' || endEl.value === '') {
                        allFilled = false;
                    } else if (Number(startEl.value) === Number(endEl.value)) {
                        allFilled = false;
                    }
                });
                if (!allFilled) return false;
                continue;
            }
            if (q.type === 'multiselect') {
                const val = answers[q.id] || [];
                if (val.length === 0) return false;
                continue;
            }
            const val = answers[q.id];
            if (!val || (typeof val === 'string' && val.trim() === '')) {
                return false;
            }
        }
        return true;
    }

    _wireStep2(container, questions, answers, currentStep, steps, onNext, onPrev, onDone) {
        document.getElementById('survey-prev')?.addEventListener('click', onPrev);

        const nextBtn = document.getElementById('survey-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this._collectStepAnswers(container, questions, answers);
                if (!this._step2AllValid(container, questions, answers)) return;
                onDone();
            });
        }

        const onChange = () => {
            this._collectStepAnswers(container, questions, answers);
            this._reEvaluateStep2(container, questions, answers);
        };

        container.addEventListener('change', (e) => {
            if (e.target.matches('.survey-input, .survey-other-input, .survey-checkboxes input, .timerange-select')) {
                onChange();
            }
        });

        const inputEls = container.querySelectorAll('.survey-input, .survey-other-input');
        inputEls.forEach(inp => {
            if (inp.type === 'number' || inp.type === 'text') {
                inp.addEventListener('input', onChange);
            }
        });

        this._reEvaluateStep2(container, questions, answers);
    }

    _wireActions(container, questions, answers, currentStep, steps, onNext, onPrev) {
        document.getElementById('survey-prev')?.addEventListener('click', onPrev);
        document.getElementById('survey-next')?.addEventListener('click', () => {
            this._collectStepAnswers(container, questions, answers);
            if (!this._validateStep(questions, answers)) return;
            onNext();
        });
    }

    _validateStep(questions, answers) {
        for (const q of questions) {
            if (!q.required) continue;
            const val = answers[q.id];
            if (q.type === 'multiselect') {
                if (!val || val.length === 0) {
                    alert(`${q.label} is required.`);
                    return false;
                }
                continue;
            }
            if (!val || (typeof val === 'string' && val.trim() === '')) {
                alert(`${q.label} is required.`);
                return false;
            }
            if (q.type === 'number') {
                const num = Number(val);
                if (q.min !== undefined && num < q.min) {
                    alert(`${q.label} must be at least ${q.min}.`);
                    return false;
                }
                if (q.max !== undefined && num > q.max) {
                    alert(`${q.label} must be at most ${q.max}.`);
                    return false;
                }
            }
        }
        return true;
    }
}

const authManager = new AuthManager();
