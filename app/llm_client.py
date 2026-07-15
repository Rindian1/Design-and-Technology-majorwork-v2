import json
from openai import OpenAI

from config import DEEPSEEK_API_KEY

OLLAMA_BASE = "http://localhost:11434/v1"
OLLAMA_MODEL = "llama3.2:1b"

_deepseek_client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com",
) if DEEPSEEK_API_KEY else None

_ollama_client = OpenAI(
    api_key="ollama",
    base_url=OLLAMA_BASE,
)


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

Consider the user is in Australia. Use AUD for prices. Sort from most savings to least savings.

IMPORTANT: Only output raw numbers, never formulas or calculations.

RESPONSE FORMAT (pure JSON, no markdown, no code fences):
{{
  "no_recommendation": false,
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
        temperature=0.3,
        max_tokens=2000,
    )


def _enrich_rec(rec, rate, current_annual_cost):
    annual_kwh = rec.get('estimated_annual_kwh', 0)
    annual_cost = round(annual_kwh * rate, 2)
    savings = round(current_annual_cost - annual_cost, 2)
    savings_pct = round((savings / current_annual_cost) * 100, 1) if current_annual_cost > 0 else 0
    payback = round(rec.get('estimated_retail_price_aud', 0) / savings, 1) if savings > 0 else None

    rec['current_annual_cost_dollars'] = round(current_annual_cost, 2)
    rec['estimated_annual_cost_dollars'] = annual_cost
    rec['estimated_annual_savings_dollars'] = savings
    rec['savings_percentage'] = savings_pct
    rec['payback_period_years'] = payback
    return rec


def _sort_recs(recs):
    return sorted(recs, key=lambda r: r.get('estimated_annual_savings_dollars', 0), reverse=True)


def get_appliance_recommendation(profile, usage, date_str):
    if not profile.get('appliance_model') and not profile.get('power_rating'):
        return {
            'date': date_str,
            'recommendations': None,
            'error': 'No appliance details provided. Fill in your appliance model in the survey to get recommendations.',
        }

    rate = profile.get('rate_per_kwh', 0.30)
    total_kwh = 0
    if usage:
        for entry in usage:
            total_kwh += entry.get('watt_usage', 0) / 1000
    current_annual_cost = round(total_kwh * 365 * rate, 2)

    prompt = _build_prompt(profile, usage, date_str)

    # Try DeepSeek first, fall back to Ollama
    last_error = None
    if _deepseek_client:
        try:
            response = _call_llm(_deepseek_client, "deepseek-chat", prompt)
            data = _parse_response(response.choices[0].message.content)
            if data.get('no_recommendation'):
                return {'date': date_str, 'recommendations': None}
            recs = [_enrich_rec(r, rate, current_annual_cost) for r in data.get('recommendations', [])]
            recs = _sort_recs(recs)
            return {'date': date_str, 'recommendations': recs if recs else None}
        except Exception as e:
            last_error = e

    try:
        response = _call_llm(_ollama_client, OLLAMA_MODEL, prompt)
        data = _parse_response(response.choices[0].message.content)
        if data.get('no_recommendation'):
            return {'date': date_str, 'recommendations': None}
        recs = [_enrich_rec(r, rate, current_annual_cost) for r in data.get('recommendations', [])]
        recs = _sort_recs(recs)
        return {'date': date_str, 'recommendations': recs if recs else None}
    except Exception as e:
        error_msg = f'Failed to get recommendation: {str(e)}'
        if last_error:
            error_msg += f' (DeepSeek: {last_error})'
        return {
            'date': date_str,
            'recommendations': None,
            'error': error_msg,
        }
