SURVEY_QUESTIONS = [
    # ══════════════════════════════════════════
    # Step 1: Appliance
    # ══════════════════════════════════════════
    {
        "step": 1,
        "id": "appliance_type",
        "type": "select",
        "label": "What kind of appliance will your plug be measuring?",
        "options": [
            {"value": "heater", "label": "Heater"},
            {"value": "fridge", "label": "Fridge"},
            {"value": "lighting", "label": "Lighting"},
            {"value": "general", "label": "General appliance"},
            {"value": "__other__", "label": "Other"},
        ],
        "has_other": True,
        "other_placeholder": "Enter your appliance type",
        "required": True,
    },
    {
        "step": 1,
        "id": "power_rating",
        "type": "number",
        "label": "If applicable, what is the power rating of your appliance? (Watts)",
        "required": False,
        "placeholder": "Optional — e.g. 2000",
    },
    {
        "step": 1,
        "id": "appliance_model",
        "type": "text",
        "label": "What is the exact model of your appliance?",
        "required": False,
        "placeholder": "Optional — e.g. Dyson Hot+Cool HP07",
    },

    # ══════════════════════════════════════════
    # Step 2: Energy plan
    # ══════════════════════════════════════════
    {
        "step": 2,
        "id": "knows_plan",
        "type": "select",
        "label": "Are you aware of your current energy plan?",
        "description": "Check <a href='https://www.energymadeeasy.gov.au' target='_blank' rel='noopener'>Energy Made Easy</a> to find out before selecting No.",
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"},
        ],
        "required": True,
    },
    {
        "step": 2,
        "id": "static_rate_cents",
        "type": "number",
        "label": "Electricity rate (cents per kWh)",
        "description": "If you are still not sure, the average Australian rate is 27c/kWh.",
        "placeholder": "27",
        "required": True,
        "depends_on": {"question": "knows_plan", "value": "no"},
    },
    {
        "step": 2,
        "id": "plan_type",
        "type": "select",
        "label": "Is your plan single rate or time of use?",
        "description": "See <a href='https://www.energymadeeasy.gov.au/energy-plans/energy-plan-types' target='_blank' rel='noopener'>Energy Made Easy plan types</a> if you're unsure.",
        "options": [
            {"value": "single", "label": "Single rate"},
            {"value": "tou", "label": "Time of use"},
        ],
        "required": True,
        "depends_on": {"question": "knows_plan", "value": "yes"},
    },
    {
        "step": 2,
        "id": "single_usage_charge",
        "type": "number",
        "label": "What is the usage charge? (cents/kWh)",
        "description": "This is the price you pay for using electricity, not to be confused with your supply charge.",
        "placeholder": "e.g. 27.5",
        "required": True,
        "depends_on": {"question": "plan_type", "value": "single"},
    },

    # ── Time of Use: Usage charges ──
    {
        "step": 2,
        "id": "_tou_usage_heading",
        "type": "subheading",
        "label": "Usage charges (cents per kWh)",
        "description": "See <a href='https://www.energymadeeasy.gov.au/energy-plans/energy-plan-types' target='_blank' rel='noopener'>Energy Made Easy plan types</a> if you're unsure.",
        "depends_on": {"question": "plan_type", "value": "tou"},
    },
    {
        "step": 2,
        "id": "peak_charge",
        "type": "number",
        "label": "Peak usage charge (cents/kWh)",
        "placeholder": "e.g. 35.0",
        "required": True,
        "depends_on": {"question": "plan_type", "value": "tou"},
    },
    {
        "step": 2,
        "id": "offpeak_charge",
        "type": "number",
        "label": "Off-peak usage charge (cents/kWh)",
        "placeholder": "e.g. 15.0",
        "required": True,
        "depends_on": {"question": "plan_type", "value": "tou"},
    },
    {
        "step": 2,
        "id": "shoulder_charge",
        "type": "number",
        "label": "Shoulder usage charge (cents/kWh)",
        "placeholder": "e.g. 22.0 (leave blank if not applicable)",
        "required": False,
        "depends_on": {"question": "plan_type", "value": "tou"},
    },

    # ── Time of Use: Time ranges ──
    {
        "step": 2,
        "id": "_tou_times_heading",
        "type": "subheading",
        "label": "Time ranges",
        "description": "See <a href='https://www.energymadeeasy.gov.au/energy-plans/energy-plan-types' target='_blank' rel='noopener'>Energy Made Easy plan types</a> if you're unsure.",
        "depends_on": {"question": "plan_type", "value": "tou"},
    },
    {
        "step": 2,
        "id": "peak_hours",
        "type": "timerange",
        "label": "Peak hour times",
        "can_add_multiple": True,
        "required": True,
        "depends_on": {"question": "plan_type", "value": "tou"},
    },
    {
        "step": 2,
        "id": "offpeak_hours",
        "type": "timerange",
        "label": "Off-peak hour times",
        "can_add_multiple": True,
        "required": True,
        "depends_on": {"question": "plan_type", "value": "tou"},
    },
    {
        "step": 2,
        "id": "shoulder_hours",
        "type": "timerange",
        "label": "Shoulder hour times",
        "can_add_multiple": True,
        "required": False,
        "depends_on": {"question": "plan_type", "value": "tou"},
    },

    # ══════════════════════════════════════════
    # Step 3: Intentions
    # ══════════════════════════════════════════
    {
        "step": 3,
        "id": "intentions",
        "type": "multiselect",
        "label": "What are your intentions with using this app? (Check all that apply)",
        "options": [
            {"value": "reduce_bill", "label": "Focusing on reducing your electricity bill"},
            {"value": "maintain", "label": "Maintaining current usage"},
            {"value": "monitor", "label": "Just monitoring your usage for general purposes"},
        ],
        "required": True,
    },
    {
        "step": 3,
        "id": "monthly_budget_dollars",
        "type": "number",
        "label": "What is your monthly budget for electricity? (AUD)",
        "description": "This helps us track when you reach your budget limit and alert you.",
        "placeholder": "e.g. 150",
        "required": True,
        "min": 0,
    },
]
