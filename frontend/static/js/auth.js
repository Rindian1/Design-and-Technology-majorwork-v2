class AuthManager {
    constructor() {
        this._questions = null;
    }

    async checkSession() {
        try {
            const data = await energyAPI.getSession();
            return data;
        } catch {
            return null;
        }
    }

    async login(email, password) {
        return energyAPI.login(email, password);
    }

    async register(email, password, surveyData) {
        return energyAPI.register(email, password, surveyData);
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

    renderSurveyForm(containerId, onSubmit) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.loadSurveyQuestions().then(questions => {
            const steps = [...new Set(questions.map(q => q.step))].sort();
            let currentStep = 0;
            const answers = {};

            const render = () => {
                const stepQs = questions.filter(q => q.step === steps[currentStep]);
                let html = `<div class="survey-steps">`;
                html += `<div class="step-indicator">${steps.map((s, i) =>
                    `<span class="step-dot${i === currentStep ? ' active' : ''}${i < currentStep ? ' done' : ''}"></span>`
                ).join('<span class="step-line"></span>')}</div>`;
                html += `<h3 class="survey-step-title">Step ${currentStep + 1} of ${steps.length}</h3>`;
                html += `<div class="survey-fields">`;
                stepQs.forEach(q => {
                    const val = answers[q.id] || '';
                    html += `<div class="survey-field">`;
                    html += `<label for="survey-${q.id}">${q.label}${q.required ? ' <span class="required">*</span>' : ''}</label>`;
                    if (q.type === 'select') {
                        html += `<select id="survey-${q.id}" class="survey-input" ${q.required ? 'required' : ''}>`;
                        html += `<option value="">-- Select --</option>`;
                        (q.options || []).forEach(o => {
                            html += `<option value="${o.value}"${val === o.value ? ' selected' : ''}>${o.label}</option>`;
                        });
                        html += `</select>`;
                    } else if (q.type === 'multiselect') {
                        html += `<div class="survey-checkboxes">`;
                        (q.options || []).forEach(o => {
                            const checked = (answers[q.id] || []).includes(o.value);
                            html += `<label class="checkbox-label"><input type="checkbox" value="${o.value}"${checked ? ' checked' : ''}> ${o.label}</label>`;
                        });
                        html += `</div>`;
                    } else if (q.type === 'number') {
                        html += `<input type="number" id="survey-${q.id}" class="survey-input" value="${val}" min="${q.min || ''}" max="${q.max || ''}" ${q.required ? 'required' : ''}>`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
                html += `<div class="survey-actions">`;
                if (currentStep > 0) {
                    html += `<button type="button" class="btn btn-secondary" id="survey-prev">Back</button>`;
                }
                if (currentStep < steps.length - 1) {
                    html += `<button type="button" class="btn btn-primary" id="survey-next">Next</button>`;
                } else {
                    html += `<button type="submit" class="btn btn-primary" id="survey-submit">Create Account</button>`;
                }
                html += `</div></div>`;
                container.innerHTML = html;

                const collectAnswers = () => {
                    stepQs.forEach(q => {
                        const el = document.getElementById(`survey-${q.id}`);
                        if (q.type === 'multiselect') {
                            const checked = container.querySelectorAll(`#survey-${q.id} input[type="checkbox"]:checked`);
                            answers[q.id] = Array.from(checked).map(c => c.value);
                        } else if (el) {
                            answers[q.id] = el.value;
                        }
                    });
                };

                document.getElementById('survey-next')?.addEventListener('click', () => {
                    collectAnswers();
                    const valid = this._validateStep(stepQs, answers, container);
                    if (!valid) return;
                    currentStep++;
                    render();
                });

                document.getElementById('survey-prev')?.addEventListener('click', () => {
                    collectAnswers();
                    currentStep--;
                    render();
                });

                document.getElementById('survey-submit')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    collectAnswers();
                    const valid = this._validateStep(stepQs, answers, container);
                    if (!valid) return;
                    onSubmit(answers);
                });
            };

            render();
        }).catch(err => {
            container.innerHTML = `<div class="recs-state recs-error"><p class="recs-state-text">Failed to load survey: ${err.message}</p></div>`;
        });
    }

    _validateStep(questions, answers, container) {
        for (const q of questions) {
            if (!q.required) continue;
            const val = answers[q.id];
            if (!val || (Array.isArray(val) && val.length === 0)) {
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
