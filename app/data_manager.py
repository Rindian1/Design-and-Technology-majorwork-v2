from datetime import datetime, timedelta, date
from sqlalchemy import func

from app.models import HeatingUsage, DatabaseSession
from config import HEATING_DB_PATH, TWO_WEEK_DAYS, ELECTRICITY_RATE_CENTS_PER_KWH

RATE_PER_KWH = ELECTRICITY_RATE_CENTS_PER_KWH / 100
BUDGET_KWH = 30

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


class EnergyDataManager:
    def __init__(self, db_path: str = HEATING_DB_PATH):
        self.db = DatabaseSession(db_path)

    def fetch_daily_data(self, target_date: str):
        session = self.db.get_session()
        try:
            parsed = datetime.strptime(target_date, '%Y-%m-%d').date()
            records = HeatingUsage.get_by_date(session, parsed)
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

    def calculate_statistics(self, target_date: str):
        session = self.db.get_session()
        try:
            parsed = datetime.strptime(target_date, '%Y-%m-%d').date()
            result = HeatingUsage.get_statistics(session, parsed)
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

    def get_available_dates(self):
        session = self.db.get_session()
        try:
            result = HeatingUsage.get_date_range(session)
            if result and result.earliest and result.latest:
                latest = result.latest
                earliest = max(result.earliest, latest - timedelta(days=TWO_WEEK_DAYS))
                return {
                    'earliest': earliest.isoformat(),
                    'latest': latest.isoformat(),
                }
            return None
        finally:
            session.close()

    def validate_date_range(self, date_str: str):
        try:
            target = datetime.strptime(date_str, '%Y-%m-%d').date()
            dr = self.get_available_dates()
            if not dr:
                return False
            earliest = datetime.strptime(dr['earliest'], '%Y-%m-%d').date()
            latest = datetime.strptime(dr['latest'], '%Y-%m-%d').date()
            return earliest <= target <= latest
        except ValueError:
            return False


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

    def get_recommendations(self, date_str: str):
        session = self.db.get_session()
        try:
            parsed = datetime.strptime(date_str, '%Y-%m-%d').date()
            today_stats = HeatingUsage.get_statistics(session, parsed)
            if not today_stats or today_stats.count == 0:
                return []

            today_total_kwh = (today_stats.total or 0) / 1000
            today_records = HeatingUsage.get_by_date(session, parsed)
            recs = []

            # 1. Comparison with yesterday
            yesterday = parsed - timedelta(days=1)
            yesterday_stats = HeatingUsage.get_statistics(session, yesterday)
            if yesterday_stats and yesterday_stats.count > 0:
                yest_total_kwh = (yesterday_stats.total or 0) / 1000
                diff_pct = ((today_total_kwh - yest_total_kwh) / yest_total_kwh) * 100
                cost_diff = abs(today_total_kwh - yest_total_kwh) * RATE_PER_KWH
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
            lw_stats = HeatingUsage.get_statistics(session, last_week)
            if lw_stats and lw_stats.count > 0:
                lw_total_kwh = (lw_stats.total or 0) / 1000
                diff_pct = ((today_total_kwh - lw_total_kwh) / lw_total_kwh) * 100
                cost_diff = abs(today_total_kwh - lw_total_kwh) * RATE_PER_KWH
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
            budget_pct = (today_total_kwh / BUDGET_KWH) * 100
            if budget_pct > 100:
                over_pct = budget_pct - 100
                over_cost = (today_total_kwh - BUDGET_KWH) * RATE_PER_KWH
                recs.append({
                    'type': 'budget', 'icon': '\U0001f3af',
                    'severity': 'danger',
                    'title': f'{over_pct:.0f}% over budget',
                    'description': (
                        f"Today's usage ({today_total_kwh:.1f} kWh) exceeded your "
                        f"{BUDGET_KWH} kWh budget by {over_pct:.0f}%. "
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
                        f"{budget_pct:.0f}% of your {BUDGET_KWH} kWh budget."
                    )
                })
            else:
                remaining = BUDGET_KWH - today_total_kwh
                recs.append({
                    'type': 'budget', 'icon': '\U0001f3af',
                    'severity': 'info',
                    'title': f'{budget_pct:.0f}% of budget used',
                    'description': (
                        f"Today's usage ({today_total_kwh:.1f} kWh) is well within "
                        f"your {BUDGET_KWH} kWh budget. You have {remaining:.1f} kWh to spare."
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
                s = HeatingUsage.get_statistics(session, d)
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
            # Conditional tip based on peak period
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

            # Overnight-specific tip
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

            # Static tip (rotated by day of year for variety)
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
