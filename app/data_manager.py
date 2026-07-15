import json
from datetime import datetime, timedelta, date
from sqlalchemy import func

from app.models import HeatingUsage, UserProfile, DatabaseSession
from config import HEATING_DB_PATH, TWO_WEEK_DAYS, ELECTRICITY_RATE_CENTS_PER_KWH

TIPS_POOL = [
    "Lowering your thermostat by 1\u00b0C can reduce heating costs by up to 10%.",
    "Devices on standby can account for up to 10% of your electricity bill. Unplug when not in use.",
    "Using cold water for laundry can save up to $100 per year.",
    "LED bulbs use up to 80% less energy than incandescent bulbs.",
    "Sealing windows and doors can reduce heat loss and lower energy costs.",
    "Setting your water heater to 60\u00b0C (140\u00b0F) is sufficient for most homes.",
    "Ceiling fans running clockwise in winter push warm air down, reducing heating needs.",
    "Consider upgrading to energy-efficient appliances with good energy ratings.",
    "Running dishwashers and washing machines only when full maximizes efficiency.",
    "Regular maintenance of heating systems can improve efficiency by up to 15%.",
]


def _load_user_profile(session, user_id):
    profile = session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile and profile.survey_data:
        data = json.loads(profile.survey_data)
        appliance_type = data.get('appliance_type', 'general')
        power_rating = data.get('power_rating')
        appliance_model = data.get('appliance_model')

        knows_plan = data.get('knows_plan', 'no')
        if knows_plan == 'no':
            rate_cents = float(data.get('static_rate_cents') or 27)
        elif data.get('plan_type') == 'single':
            rate_cents = float(data.get('single_usage_charge', 27))
        else:
            rate_cents = float(data.get('peak_charge', 27))

        intentions = data.get('intentions', ['monitor'])
        is_tou = knows_plan == 'yes' and data.get('plan_type') == 'tou'

        return {
            'appliance_type': appliance_type,
            'power_rating': power_rating,
            'appliance_model': appliance_model,
            'rate_per_kwh': rate_cents / 100,
            'budget_kwh': 30,
            'intentions': intentions,
            'has_tou': is_tou,
            'peak_hours': data.get('peak_hours', []),
            'offpeak_hours': data.get('offpeak_hours', []),
            'shoulder_hours': data.get('shoulder_hours', []),
            'peak_charge': float(data.get('peak_charge', 0)) if is_tou else None,
            'offpeak_charge': float(data.get('offpeak_charge', 0)) if is_tou else None,
            'shoulder_charge': float(data.get('shoulder_charge', 0)) if is_tou else None,
        }
    return {
        'appliance_type': 'general',
        'power_rating': None,
        'appliance_model': None,
        'rate_per_kwh': ELECTRICITY_RATE_CENTS_PER_KWH / 100,
        'budget_kwh': 30,
        'intentions': ['monitor'],
        'has_tou': False,
        'peak_hours': [],
        'offpeak_hours': [],
        'shoulder_hours': [],
        'peak_charge': None,
        'offpeak_charge': None,
        'shoulder_charge': None,
    }


class EnergyDataManager:
    def __init__(self, db_path: str = HEATING_DB_PATH):
        self.db = DatabaseSession(db_path)

    def fetch_daily_data(self, target_date: str, user_id: int = 1):
        session = self.db.get_session()
        try:
            parsed = datetime.strptime(target_date, '%Y-%m-%d').date()
            records = HeatingUsage.get_by_date(session, parsed, user_id=user_id)
            return [
                {
                    'timestamp': r.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    'watt_usage': r.watt_usage,
                    'daily_usage_hours': r.daily_usage_hours,
                }
                for r in records
            ]
        finally:
            session.close()

    def calculate_statistics(self, target_date: str, user_id: int = 1):
        session = self.db.get_session()
        try:
            parsed = datetime.strptime(target_date, '%Y-%m-%d').date()
            result = HeatingUsage.get_statistics(session, parsed, user_id=user_id)
            if result and result.count > 0:
                return {
                    'count': result.count,
                    'average': round(result.average, 2) if result.average else 0,
                    'peak': result.peak if result.peak else 0,
                    'minimum': result.minimum if result.minimum else 0,
                    'total': result.total if result.total else 0,
                }
            return None
        finally:
            session.close()

    def get_available_dates(self, user_id: int = 1):
        session = self.db.get_session()
        try:
            result = HeatingUsage.get_date_range(session, user_id=user_id)
            if result and result.earliest and result.latest:
                latest = result.latest
                if TWO_WEEK_DAYS > 0:
                    earliest = max(result.earliest, latest - timedelta(days=TWO_WEEK_DAYS))
                else:
                    earliest = result.earliest
                return {
                    'earliest': earliest.isoformat(),
                    'latest': latest.isoformat(),
                }
            return None
        finally:
            session.close()

    def validate_date_range(self, date_str: str, user_id: int = 1):
        try:
            target = datetime.strptime(date_str, '%Y-%m-%d').date()
            dr = self.get_available_dates(user_id=user_id)
            if not dr:
                return False
            earliest = datetime.strptime(dr['earliest'], '%Y-%m-%d').date()
            latest = datetime.strptime(dr['latest'], '%Y-%m-%d').date()
            return earliest <= target <= latest
        except ValueError:
            return False

    def get_user_profile(self, user_id: int):
        session = self.db.get_session()
        try:
            return _load_user_profile(session, user_id)
        finally:
            session.close()


class GraphDataProcessor:
    @staticmethod
    def format_for_chart(data):
        if not data:
            return {'labels': [], 'values': []}
        labels = []
        values = []
        for entry in data:
            ts = datetime.strptime(entry['timestamp'], '%Y-%m-%d %H:%M:%S')
            labels.append(ts.strftime('%H:00'))
            values.append(entry['watt_usage'])
        return {'labels': labels, 'values': values}

    @staticmethod
    def handle_missing_data(data):
        if not data:
            return []
        complete = {f"{h:02d}:00": 0 for h in range(24)}
        for entry in data:
            ts = datetime.strptime(entry['timestamp'], '%Y-%m-%d %H:%M:%S')
            complete[ts.strftime('%H:00')] = entry['watt_usage']
        return complete


class RecommendationEngine:
    def __init__(self, db_path: str = HEATING_DB_PATH):
        self.db = DatabaseSession(db_path)

    def get_general_insights(self, date_str: str, user_id: int = 1):
        session = self.db.get_session()
        try:
            profile = _load_user_profile(session, user_id)
            budget_kwh = profile['budget_kwh']
            rate_per_kwh = profile['rate_per_kwh']

            parsed = datetime.strptime(date_str, '%Y-%m-%d').date()
            today_stats = HeatingUsage.get_statistics(session, parsed, user_id=user_id)
            if not today_stats or today_stats.count == 0:
                return []

            today_total_kwh = (today_stats.total or 0) / 1000
            today_records = HeatingUsage.get_by_date(session, parsed, user_id=user_id)
            recs = []

            # 1. Comparison with yesterday
            yesterday = parsed - timedelta(days=1)
            yesterday_stats = HeatingUsage.get_statistics(session, yesterday, user_id=user_id)
            if yesterday_stats and yesterday_stats.count > 0:
                yest_total_kwh = (yesterday_stats.total or 0) / 1000
                diff_pct = ((today_total_kwh - yest_total_kwh) / yest_total_kwh) * 100
                cost_diff = abs(today_total_kwh - yest_total_kwh) * rate_per_kwh
                if diff_pct > 5:
                    recs.append({
                        'type': 'comparison', 'icon': '\U0001f4ca',
                        'severity': 'warning',
                        'title': f'{diff_pct:.0f}% higher than yesterday',
                        'description': (
                            f"Today's usage ({today_total_kwh:.1f} kWh) is {diff_pct:.0f}% "
                            f"higher than yesterday ({yest_total_kwh:.1f} kWh), "
                            f"costing an extra ${cost_diff:.2f}."
                        )
                    })
                elif diff_pct < -5:
                    recs.append({
                        'type': 'comparison', 'icon': '\U0001f4ca',
                        'severity': 'info',
                        'title': f'{abs(diff_pct):.0f}% lower than yesterday',
                        'description': (
                            f"Great job! Today's usage ({today_total_kwh:.1f} kWh) is "
                            f"{abs(diff_pct):.0f}% lower than yesterday ({yest_total_kwh:.1f} kWh), "
                            f"saving ${cost_diff:.2f}."
                        )
                    })
                else:
                    recs.append({
                        'type': 'comparison', 'icon': '\U0001f4ca',
                        'severity': 'info',
                        'title': 'Similar to yesterday',
                        'description': (
                            f"Today's usage ({today_total_kwh:.1f} kWh) is roughly "
                            f"on par with yesterday ({yest_total_kwh:.1f} kWh)."
                        )
                    })

            # 2. Comparison with last week
            last_week = parsed - timedelta(days=7)
            lw_stats = HeatingUsage.get_statistics(session, last_week, user_id=user_id)
            if lw_stats and lw_stats.count > 0:
                lw_total_kwh = (lw_stats.total or 0) / 1000
                diff_pct = ((today_total_kwh - lw_total_kwh) / lw_total_kwh) * 100
                cost_diff = abs(today_total_kwh - lw_total_kwh) * rate_per_kwh
                if diff_pct > 5:
                    recs.append({
                        'type': 'comparison', 'icon': '\U0001f5d3\ufe0f',
                        'severity': 'warning',
                        'title': f'{diff_pct:.0f}% higher than last week',
                        'description': (
                            f"Today's usage ({today_total_kwh:.1f} kWh) is {diff_pct:.0f}% "
                            f"higher than this day last week ({lw_total_kwh:.1f} kWh), "
                            f"costing an extra ${cost_diff:.2f}."
                        )
                    })
                elif diff_pct < -5:
                    recs.append({
                        'type': 'comparison', 'icon': '\U0001f5d3\ufe0f',
                        'severity': 'info',
                        'title': f'{abs(diff_pct):.0f}% lower than last week',
                        'description': (
                            f"Today's usage ({today_total_kwh:.1f} kWh) is "
                            f"{abs(diff_pct):.0f}% lower than this day last week "
                            f"({lw_total_kwh:.1f} kWh), saving ${cost_diff:.2f}."
                        )
                    })
                else:
                    recs.append({
                        'type': 'comparison', 'icon': '\U0001f5d3\ufe0f',
                        'severity': 'info',
                        'title': 'Similar to last week',
                        'description': (
                            f"Today's usage ({today_total_kwh:.1f} kWh) is roughly "
                            f"on par with this day last week ({lw_total_kwh:.1f} kWh)."
                        )
                    })

            # 3. Budget status
            budget_pct = (today_total_kwh / budget_kwh) * 100
            if budget_pct > 100:
                over_pct = budget_pct - 100
                over_cost = (today_total_kwh - budget_kwh) * rate_per_kwh
                recs.append({
                    'type': 'budget', 'icon': '\U0001f3af',
                    'severity': 'danger',
                    'title': f'{over_pct:.0f}% over budget',
                    'description': (
                        f"Today's usage ({today_total_kwh:.1f} kWh) exceeded your "
                        f"{budget_kwh} kWh budget by {over_pct:.0f}%. "
                        f"That's ${over_cost:.2f} over budget."
                    )
                })
            elif budget_pct > 80:
                recs.append({
                    'type': 'budget', 'icon': '\U0001f3af',
                    'severity': 'warning',
                    'title': f'{budget_pct:.0f}% of budget used',
                    'description': (
                        f"Today's usage ({today_total_kwh:.1f} kWh) is "
                        f"{budget_pct:.0f}% of your {budget_kwh} kWh budget."
                    )
                })
            else:
                remaining = budget_kwh - today_total_kwh
                recs.append({
                    'type': 'budget', 'icon': '\U0001f3af',
                    'severity': 'info',
                    'title': f'{budget_pct:.0f}% of budget used',
                    'description': (
                        f"Today's usage ({today_total_kwh:.1f} kWh) is well within "
                        f"your {budget_kwh} kWh budget. You have {remaining:.1f} kWh to spare."
                    )
                })

            # 4. Peak insight
            if today_records:
                peak_record = max(today_records, key=lambda r: r.watt_usage)
                peak_hour = peak_record.timestamp.hour
                peak_kw = peak_record.watt_usage / 1000
                if 6 <= peak_hour < 12:
                    period = 'morning'
                    tip = 'Consider running high-power tasks later in the day when overall demand is lower.'
                elif 12 <= peak_hour < 18:
                    period = 'afternoon'
                    tip = 'Your peak aligns with daytime hours \u2014 great if you have solar panels.'
                elif 18 <= peak_hour < 23:
                    period = 'evening'
                    tip = 'Shifting high-energy activities to midday could reduce costs.'
                else:
                    period = 'overnight'
                    tip = 'Check for devices left on overnight that could be turned off or scheduled.'
                ampm = f"{peak_hour % 12 if peak_hour % 12 != 0 else 12}:00 {'PM' if peak_hour >= 12 else 'AM'}"
                recs.append({
                    'type': 'peak', 'icon': '\u26a1',
                    'severity': 'warning' if period in ('evening', 'overnight') else 'info',
                    'title': f'Peak at {ampm}',
                    'description': (
                        f"Your highest usage was {peak_kw:.2f} kW at {ampm} ({period}). {tip}"
                    )
                })

            # 5. Anomaly detection (7-day rolling average)
            historical_totals = []
            for i in range(1, 8):
                d = parsed - timedelta(days=i)
                s = HeatingUsage.get_statistics(session, d, user_id=user_id)
                if s and s.count > 0:
                    historical_totals.append((s.total or 0) / 1000)
            if len(historical_totals) >= 3:
                avg = sum(historical_totals) / len(historical_totals)
                if avg > 0:
                    deviation = ((today_total_kwh - avg) / avg) * 100
                    if deviation > 50:
                        recs.append({
                            'type': 'anomaly', 'icon': '\U0001f514',
                            'severity': 'danger',
                            'title': 'Unusually high usage today',
                            'description': (
                                f"Today's usage ({today_total_kwh:.1f} kWh) is "
                                f"{deviation:.0f}% above your {len(historical_totals)}-day "
                                f"average ({avg:.1f} kWh). Check for unusual activity."
                            )
                        })
                    elif deviation > 20:
                        recs.append({
                            'type': 'anomaly', 'icon': '\U0001f514',
                            'severity': 'warning',
                            'title': 'Higher than usual today',
                            'description': (
                                f"Today's usage ({today_total_kwh:.1f} kWh) is "
                                f"{deviation:.0f}% above your {len(historical_totals)}-day "
                                f"average ({avg:.1f} kWh)."
                            )
                        })
                    elif deviation < -30:
                        recs.append({
                            'type': 'anomaly', 'icon': '\U0001f514',
                            'severity': 'info',
                            'title': 'Well below average today',
                            'description': (
                                f"Today's usage ({today_total_kwh:.1f} kWh) is "
                                f"{abs(deviation):.0f}% below your {len(historical_totals)}-day "
                                f"average ({avg:.1f} kWh). Keep it up!"
                            )
                        })

            # 6. Overnight usage check
            if today_records:
                overnight_hours = [r for r in today_records
                                   if r.timestamp.hour >= 23 or r.timestamp.hour < 6]
                if overnight_hours:
                    overnight_total = sum(r.watt_usage for r in overnight_hours) / 1000
                    overnight_pct = (overnight_total / today_total_kwh * 100) if today_total_kwh > 0 else 0
                    if overnight_pct > 20:
                        recs.append({
                            'type': 'overnight', 'icon': '\U0001f319',
                            'severity': 'warning',
                            'title': f'{overnight_pct:.0f}% usage overnight',
                            'description': (
                                f"Overnight usage (11PM\u20136AM) accounts for {overnight_pct:.0f}% "
                                f"of today's total ({overnight_total:.1f} kWh). "
                                f"Consider using smart plugs to cut standby power."
                            )
                        })

            # 7. Tips (conditional + static)
            if today_records:
                peak_record = max(today_records, key=lambda r: r.watt_usage)
                peak_hour = peak_record.timestamp.hour
                if peak_hour >= 18 or peak_hour < 6:
                    recs.append({
                        'type': 'tip', 'icon': '\U0001f4a1',
                        'severity': 'info',
                        'title': 'Shift your peak',
                        'description': (
                            'Running high-power appliances (washer, dryer, dishwasher) during '
                            'midday rather than evening can reduce strain on the grid and your wallet.'
                        )
                    })

            if today_records:
                overnight_hours = [r for r in today_records
                                   if r.timestamp.hour >= 23 or r.timestamp.hour < 6]
                if overnight_hours:
                    overnight_total = sum(r.watt_usage for r in overnight_hours) / 1000
                    overnight_pct = (overnight_total / today_total_kwh * 100) if today_total_kwh > 0 else 0
                    if overnight_pct > 15:
                        recs.append({
                            'type': 'tip', 'icon': '\U0001f4a1',
                            'severity': 'info',
                            'title': 'Reduce standby power',
                            'description': (
                                'Devices on standby can account for up to 10% of your electricity '
                                'bill. Use smart plugs to schedule power-off times overnight.'
                            )
                        })

            tip_index = parsed.timetuple().tm_yday % len(TIPS_POOL)
            recs.append({
                'type': 'tip', 'icon': '\U0001f4a1',
                'severity': 'info',
                'title': 'Energy saving tip',
                'description': TIPS_POOL[tip_index]
            })

            return recs
        finally:
            session.close()

    def get_general_detailed(self, date_str: str, user_id: int = 1):
        session = self.db.get_session()
        try:
            profile = _load_user_profile(session, user_id)
            rate = profile['rate_per_kwh']
            budget_kwh = profile['budget_kwh']

            parsed = datetime.strptime(date_str, '%Y-%m-%d').date()

            today_stats = HeatingUsage.get_statistics(session, parsed, user_id=user_id)
            today_kwh = (today_stats.total or 0) / 1000 if today_stats and today_stats.count > 0 else 0
            today_records = HeatingUsage.get_by_date(session, parsed, user_id=user_id) if today_stats and today_stats.count > 0 else []

            # 1. Weekly spending (last 7 days)
            weekly_spending = []
            total_7day_kwh = 0
            for i in range(6, -1, -1):
                d = parsed - timedelta(days=i)
                s = HeatingUsage.get_statistics(session, d, user_id=user_id)
                kwh = (s.total or 0) / 1000 if s and s.count > 0 else 0
                cost = kwh * rate
                weekly_spending.append({
                    'date': d.isoformat(),
                    'total_kwh': round(kwh, 2),
                    'cost': round(cost, 2),
                })
                total_7day_kwh += kwh

            # 2. Today vs last week
            today_vs_last_week = None
            last_week = parsed - timedelta(days=7)
            lw_stats = HeatingUsage.get_statistics(session, last_week, user_id=user_id)
            lw_kwh = (lw_stats.total or 0) / 1000 if lw_stats and lw_stats.count > 0 else 0
            if today_kwh > 0 and lw_kwh > 0:
                diff_pct = ((today_kwh - lw_kwh) / lw_kwh) * 100
                diff_kwh = today_kwh - lw_kwh
                today_vs_last_week = {
                    'diff_pct': round(diff_pct, 1),
                    'baseline_kwh': round(lw_kwh, 2),
                    'diff_kwh': round(diff_kwh, 2),
                    'savings': round(abs(diff_kwh) * rate, 2),
                    'is_positive': diff_pct < 0,
                }

            # 3. Today vs 7-day rolling average
            today_vs_average = None
            historical = []
            for i in range(1, 8):
                d = parsed - timedelta(days=i)
                s = HeatingUsage.get_statistics(session, d, user_id=user_id)
                if s and s.count > 0:
                    historical.append((s.total or 0) / 1000)
            if historical:
                avg_kwh = sum(historical) / len(historical)
                if avg_kwh > 0:
                    diff_pct = ((today_kwh - avg_kwh) / avg_kwh) * 100
                    today_vs_average = {
                        'diff_pct': round(diff_pct, 1),
                        'avg_kwh': round(avg_kwh, 2),
                        'is_positive': diff_pct < 0,
                    }

            # 4. Averages
            avg_daily_cost = (total_7day_kwh / 7) * rate if total_7day_kwh > 0 else 0
            avg_weekly_spend = round(avg_daily_cost * 7, 2)
            forecasted_monthly = round(avg_daily_cost * 30, 2)

            # 5. Savings scenarios
            monthly_cost_est = (total_7day_kwh / 7) * 30 * rate
            savings_scenarios = {
                'pct_2': round(monthly_cost_est * 0.02, 2),
                'pct_4': round(monthly_cost_est * 0.04, 2),
                'pct_6': round(monthly_cost_est * 0.06, 2),
            }

            # 6. Behaviour tips
            behaviour_tips = self.get_behaviour_recs(date_str, user_id=user_id)

            # 7. Tip banner
            tip_banner = self._generate_tip_banner(today_records, today_kwh, rate, profile)

            return {
                'date': date_str,
                'weekly_spending': weekly_spending,
                'today_vs_last_week': today_vs_last_week,
                'today_vs_average': today_vs_average,
                'avg_weekly_spend': avg_weekly_spend,
                'forecasted_monthly': forecasted_monthly,
                'savings_scenarios': savings_scenarios,
                'behaviour_tips': behaviour_tips,
                'tip_banner': tip_banner,
                'budget_kwh': budget_kwh,
                'rate_per_kwh': rate,
            }
        finally:
            session.close()

    def _generate_tip_banner(self, records, today_kwh, rate, profile):
        if not records:
            return 'No usage data available for today.'

        peak_record = max(records, key=lambda r: r.watt_usage)
        peak_hour = peak_record.timestamp.hour
        peak_kw = peak_record.watt_usage / 1000

        has_tou = profile.get('has_tou', False)
        if has_tou:
            peak_hours = profile.get('peak_hours', [])
            peak_ranges = ', '.join(f"{p['start']}:00-{p['end']}:00" for p in peak_hours)
            for p in peak_hours:
                start = int(p['start'])
                end = int(p['end'])
                in_peak = (start <= peak_hour < end) if start <= end else (peak_hour >= start or peak_hour < end)
                if in_peak:
                    return (
                        f"Using your appliance heavily during peak rate hours ({peak_ranges}) "
                        f"costs more. Shifting usage to off-peak could reduce your spending by ~15%."
                    )

        period_map = [
            (6, 12, 'morning', 'running high-power tasks later in the day'),
            (12, 18, 'afternoon', 'you likely have solar offset during this time'),
            (18, 23, 'evening', 'shifting high-energy activities to midday'),
            (23, 6, 'overnight', 'checking for devices left on unnecessarily'),
        ]
        for start, end, period, action in period_map:
            if (start <= peak_hour < end) if start <= end else (peak_hour >= start or peak_hour < end):
                return (
                    f"Your highest usage is in the {period} ({peak_kw:.1f} kW at "
                    f"{peak_hour % 12 if peak_hour % 12 != 0 else 12}:00 "
                    f"{'PM' if peak_hour >= 12 else 'AM'}). Better timing could "
                    f"reduce your spending by ~12%."
                )

        return 'Monitoring your usage patterns is the first step to reducing energy costs.'

    def get_behaviour_recs(self, date_str: str, user_id: int = 1):
        session = self.db.get_session()
        try:
            profile = _load_user_profile(session, user_id)
            rate_per_kwh = profile['rate_per_kwh']
            has_tou = profile['has_tou']

            parsed = datetime.strptime(date_str, '%Y-%m-%d').date()
            today_stats = HeatingUsage.get_statistics(session, parsed, user_id=user_id)
            if not today_stats or today_stats.count == 0:
                return []

            today_total_kwh = (today_stats.total or 0) / 1000
            today_records = HeatingUsage.get_by_date(session, parsed, user_id=user_id)
            recs = []

            def hour_in_period(h, periods):
                for p in periods:
                    start = int(p['start'])
                    end = int(p['end'])
                    if start <= end:
                        if start <= h < end:
                            return True
                    else:
                        if h >= start or h < end:
                            return True
                return False

            if has_tou and today_records:
                peak_charge = profile['peak_charge'] or 0
                offpeak_charge = profile['offpeak_charge'] or 0
                shoulder_charge = profile['shoulder_charge'] or 0
                peak_hours = profile['peak_hours']
                offpeak_hours = profile['offpeak_hours']
                shoulder_hours = profile['shoulder_hours']

                peak_kwh = 0
                offpeak_kwh = 0
                shoulder_kwh = 0

                for r in today_records:
                    h = r.timestamp.hour
                    kwh = r.watt_usage / 1000
                    if hour_in_period(h, peak_hours):
                        peak_kwh += kwh
                    elif hour_in_period(h, shoulder_hours):
                        shoulder_kwh += kwh
                    else:
                        offpeak_kwh += kwh

                peak_cost = peak_kwh * peak_charge / 100
                offpeak_cost = offpeak_kwh * offpeak_charge / 100
                shoulder_cost = shoulder_kwh * shoulder_charge / 100
                total_cost = peak_cost + offpeak_cost + shoulder_cost

                if peak_kwh > 0:
                    daily_saving = peak_kwh * (peak_charge - offpeak_charge) / 100
                    yearly_saving = daily_saving * 365
                    recs.append({
                        'type': 'behaviour', 'icon': '\u26a1',
                        'severity': 'warning' if peak_kwh > 2 else 'info',
                        'title': f'Shift peak usage to save',
                        'description': (
                            f"You used {peak_kwh:.1f} kWh during peak hours, costing "
                            f"${peak_cost:.2f}. Shifting this to off-peak could save "
                            f"${daily_saving:.2f}/day (${yearly_saving:.0f}/year)."
                        )
                    })
                    if peak_cost > total_cost * 0.5:
                        recs.append({
                            'type': 'behaviour', 'icon': '\U0001f4a1',
                            'severity': 'warning',
                            'title': 'Majority of cost in peak',
                            'description': (
                                f"Peak hour usage makes up {peak_cost/total_cost*100:.0f}% of "
                                f"today's electricity cost. Consider scheduling high-power "
                                f"appliances to run during off-peak hours."
                            )
                        })
            elif today_records:
                peak_record = max(today_records, key=lambda r: r.watt_usage)
                peak_hour = peak_record.timestamp.hour
                peak_kw = peak_record.watt_usage / 1000
                periods = []
                if 6 <= peak_hour < 12:
                    periods.append('morning')
                elif 12 <= peak_hour < 18:
                    periods.append('afternoon')
                elif 18 <= peak_hour < 23:
                    periods.append('evening')
                else:
                    periods.append('overnight')

                recs.append({
                    'type': 'behaviour', 'icon': '\u23f0',
                    'severity': 'info',
                    'title': f'Highest usage in the {periods[0]}',
                    'description': (
                        f"Your peak usage of {peak_kw:.2f} kW at "
                        f"{peak_hour % 12 if peak_hour % 12 != 0 else 12}:00 "
                        f"{'PM' if peak_hour >= 12 else 'AM'} is during {periods[0]} hours."
                    )
                })

            if today_total_kwh > 0:
                avg_over_24 = today_total_kwh / 24
                high_hours = [r for r in (today_records or [])
                              if r.watt_usage / 1000 > avg_over_24 * 1.5]
                if len(high_hours) > 4:
                    high_total = sum(r.watt_usage for r in high_hours) / 1000
                    high_cost = high_total * rate_per_kwh
                    recs.append({
                        'type': 'behaviour', 'icon': '\U0001f4ca',
                        'severity': 'info',
                        'title': f'{len(high_hours)} hours above average',
                        'description': (
                            f"You had {len(high_hours)} hours where usage was 50%+ above "
                            f"your daily average. Those hours totaled {high_total:.1f} kWh "
                            f"(${high_cost:.2f}). Identifying what runs then could reduce costs."
                        )
                    })

            if not recs:
                recs.append({
                    'type': 'behaviour', 'icon': '\U0001f4a1',
                    'severity': 'info',
                    'title': 'Steady usage pattern',
                    'description': (
                        "Your energy usage is relatively consistent throughout the day. "
                        "Consider if any appliances could be scheduled more efficiently."
                    )
                })

            return recs
        finally:
            session.close()
