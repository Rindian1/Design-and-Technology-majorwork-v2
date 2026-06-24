from datetime import datetime, timedelta, date
from sqlalchemy import func

from app.models import HeatingUsage, DatabaseSession
from config import HEATING_DB_PATH, TWO_WEEK_DAYS


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
            today = date.today()
            two_weeks_ago = today - timedelta(days=TWO_WEEK_DAYS)
            return two_weeks_ago <= target <= today
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
