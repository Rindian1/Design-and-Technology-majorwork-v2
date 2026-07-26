import json
from openai import OpenAI

from config import OPENAI_API_KEY

_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
OPENAI_MODEL = "gpt-4o-mini"


def _build_prompt(profile, usage, date_str):
    app_type = profile.get('appliance_type', 'general')
    app_model = profile.get('appliance_model')
    power_rating = profile.get('power_rating')
    rate = profile.get('rate_per_kwh', 0.30)

    total_kwh = 0
    if usage:
        for entry in usage:
            total_kwh += entry.get('watt_usage', 0) / 1000

    annual_kwh = total_kwh * 365 if total_kwh > 0 else 0
    annual_cost = annual_kwh * rate

    details = f"""
- Appliance type: {app_type}
- Current model: {app_model or 'Unknown'}
- Current power rating: {power_rating or 'Unknown'}W
- Today's energy usage: {total_kwh:.1f} kWh
- Estimated annual usage: {annual_kwh:.0f} kWh
- Estimated annual cost: ${annual_cost:.0f}
- Electricity rate: {rate * 100:.1f} cents/kWh
"""

    prompt = f"""You are an energy efficiency expert. Given the following user profile and usage data, recommend up to 3 more energy-efficient replacement appliances.

USER PROFILE:{details}

TASK:
Recommend up to 3 specific, real, currently-available replacement appliances that are more energy efficient. Only recommend if the user has provided enough details (appliance type and model/power rating). If insufficient info is given, respond with no_recommendation: true.
IMPORTANT: Do NOT recommend the same appliance model the user already owns. Recommend different, more efficient alternatives only.

Consider the user is in Australia. Use AUD for prices. Sort from most savings to least savings.

CRITICAL RULES:
- Each recommendation MUST have a DIFFERENT estimated_annual_kwh and estimated_retail_price_aud. Do not repeat the same values.
- estimated_annual_kwh must reflect the ACTUAL efficiency of each specific model. A more efficient model uses less kWh.
- Do NOT recommend the same appliance model the user already owns.
- Only output raw numbers, never formulas or calculations.

RESPONSE FORMAT (pure JSON, no markdown, no code fences):
{{
  "no_recommendation": false,
  "current_appliance_retail_price_aud": number,
  "recommendations": [
    {{
      "recommended_model": "Full model name",
      "brand": "Brand name",
      "power_rating_watts": number,
      "estimated_annual_kwh": number,
      "reasoning": "2-3 sentence explanation tailored to this user's usage pattern",
      "estimated_retail_price_aud": number
    }}
  ]
}}
"""
    return prompt


def _parse_response(text):
    cleaned = text.strip()
    if cleaned.startswith('```'):
        cleaned = cleaned.split('\n', 1)[-1]
        cleaned = cleaned.rsplit('```', 1)[0]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


def _call_llm(client, model, prompt):
    return client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an energy efficiency expert. Always respond with valid JSON only, no markdown formatting."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        max_tokens=2000,
    )


def _enrich_rec(rec, rate, current_annual_cost, current_appliance_retail=0):
    annual_kwh = rec.get('estimated_annual_kwh', 0)
    annual_cost = round(annual_kwh * rate, 2)
    savings = round(current_annual_cost - annual_cost, 2)
    savings_pct = round((savings / current_annual_cost) * 100, 1) if current_annual_cost > 0 else 0
    payback = round(rec.get('estimated_retail_price_aud', 0) / savings, 1) if savings > 0 else None

    new_retail = rec.get('estimated_retail_price_aud', 0) or 0
    resale_value = (current_appliance_retail or 0) * 0.7
    offset_price = round(new_retail - resale_value, 2)
    if offset_price < 0:
        payback_with_offset = 0
    elif savings > 0:
        payback_with_offset = round(offset_price / savings, 1)
    else:
        payback_with_offset = 0

    rec['current_annual_cost_dollars'] = round(current_annual_cost, 2)
    rec['estimated_annual_cost_dollars'] = annual_cost
    rec['estimated_annual_savings_dollars'] = savings
    rec['savings_percentage'] = savings_pct
    rec['payback_period_years'] = payback
    rec['offset_price'] = offset_price
    rec['payback_with_offset'] = payback_with_offset
    return rec


def _sort_recs(recs):
    return sorted(recs, key=lambda r: r.get('estimated_annual_savings_dollars', 0), reverse=True)


def _filter_by_efficiency(recs, current_annual_kwh, current_power_watts):
    filtered = []
    for r in recs:
        rec_kwh = r.get('estimated_annual_kwh')
        rec_power = r.get('power_rating_watts')
        more_efficient = False
        if current_annual_kwh and rec_kwh:
            more_efficient = rec_kwh < current_annual_kwh
        elif current_power_watts and rec_power:
            more_efficient = float(rec_power) < float(current_power_watts)
        else:
            more_efficient = True
        if more_efficient:
            filtered.append(r)
    return filtered


def _filter_same_model(recs, current_model):
    if not current_model:
        return recs
    current_lower = current_model.lower().strip()
    return [r for r in recs if current_lower not in (r.get('recommended_model') or '').lower()]


def get_appliance_recommendation(profile, usage, date_str):
    if not profile.get('appliance_model') and not profile.get('power_rating'):
        return {
            'date': date_str,
            'recommendations': None,
            'error': 'No appliance details provided. Fill in your appliance model in the survey to get recommendations.',
        }

    if not _client:
        return {
            'date': date_str,
            'recommendations': None,
            'error': 'No LLM API key configured.',
        }

    rate = profile.get('rate_per_kwh', 0.30)
    total_kwh = 0
    if usage:
        for entry in usage:
            total_kwh += entry.get('watt_usage', 0) / 1000
    current_annual_cost = round(total_kwh * 365 * rate, 2)

    prompt = _build_prompt(profile, usage, date_str)

    try:
        response = _call_llm(_client, OPENAI_MODEL, prompt)
        data = _parse_response(response.choices[0].message.content)
        if data.get('no_recommendation'):
            return {'date': date_str, 'recommendations': None}
        current_retail = data.get('current_appliance_retail_price_aud', 0)
        recs = [_enrich_rec(r, rate, current_annual_cost, current_retail) for r in data.get('recommendations', [])]
        recs = _filter_by_efficiency(recs, total_kwh * 365, profile.get('power_rating'))
        recs = _filter_same_model(recs, profile.get('appliance_model'))
        recs = _sort_recs(recs)
        return {
            'date': date_str,
            'current_appliance_model': profile.get('appliance_model', 'Unknown'),
            'current_appliance_retail_price_aud': current_retail,
            'recommendations': recs if recs else None,
        }
    except Exception as e:
        return {
            'date': date_str,
            'recommendations': None,
            'error': f'Failed to get recommendation: {str(e)}',
        }
