import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import datetime
import random

from config import HEATING_DB_PATH
from app.models import DatabaseSession

random.seed(42)

# ── Constants ──
START_DATE = datetime.date(2026, 4, 1)
NUM_DAYS = 90
TARGET_START_KWH = 28.0
TARGET_END_KWH = 16.0
RELAPSE_DAYS = {68, 76, 83, 88}
DEMO_USER_ID = 1

BEFORE_SHAPE = [
    0.022, 0.022, 0.022, 0.022, 0.022, 0.022,
    0.030, 0.040, 0.030,
    0.012, 0.010, 0.010, 0.010,
    0.012, 0.015, 0.015, 0.012,
    0.030, 0.055, 0.095, 0.085, 0.075, 0.050,
    0.045,
]

AFTER_SHAPE = [
    0.005, 0.005, 0.005, 0.005, 0.005, 0.005,
    0.015, 0.025, 0.020,
    0.035, 0.040, 0.045, 0.050,
    0.065, 0.080, 0.075, 0.060,
    0.050, 0.045, 0.040, 0.035, 0.030, 0.025,
    0.010,
]


def lerp(a, b, t):
    return a + (b - a) * t


def normalise(weights):
    s = sum(weights)
    return [w / s for w in weights] if s > 0 else weights


def interpolate_shape(progress):
    before = normalise(BEFORE_SHAPE)
    after = normalise(AFTER_SHAPE)
    return [lerp(b, a, progress) for b, a in zip(before, after)]


def generate_day_hours(shape, target_total_wh, is_weekend, is_relapse, noise_level):
    hours = list(shape)

    for i in range(24):
        hours[i] *= random.uniform(1 - noise_level, 1 + noise_level)

    if is_weekend:
        for i in range(9, 17):
            hours[i] *= 1.4
        for i in range(17, 23):
            hours[i] *= 0.85

    current_total = sum(hours)
    if current_total > 0:
        scale = target_total_wh / current_total
        hours = [v * scale for v in hours]

    if is_relapse:
        for i in range(17, 23):
            hours[i] *= 2.2
        for i in range(6):
            hours[i] *= 1.8
        hours[7] *= 1.4

    return [max(0, min(3500, int(round(v)))) for v in hours]


def ensure_demo_user():
    """Create demo user + profile if they don't exist."""
    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    session_db = db.get_session()
    try:
        from app.models import User, UserProfile
        from werkzeug.security import generate_password_hash

        user = session_db.query(User).filter(User.id == DEMO_USER_ID).first()
        if not user:
            user = User(
                id=DEMO_USER_ID,
                email='demo@example.com',
                password_hash=generate_password_hash('demo'),
                created_at=datetime.datetime.now(),
            )
            session_db.add(user)
            session_db.flush()

        profile = session_db.query(UserProfile).filter(UserProfile.user_id == DEMO_USER_ID).first()
        if not profile:
            profile = UserProfile(
                user_id=DEMO_USER_ID,
                survey_data=json.dumps({
                    'home_type': 'house',
                    'occupants': 4,
                    'bedrooms': 3,
                    'heating_type': 'electric',
                    'appliances': ['washer', 'dryer', 'dishwasher', 'oven'],
                    'has_tou': 'yes',
                    'daily_budget_kwh': 30,
                    'electricity_rate_cents': 30,
                    'goal': 'save_money',
                }),
            )
            session_db.add(profile)
        session_db.commit()
    finally:
        session_db.close()
        db.close()


def seed_demo_data():
    ensure_demo_user()

    conn = sqlite3.connect(HEATING_DB_PATH)
    cursor = conn.cursor()

    # Ensure heating_usage table has user_id column
    cursor.execute("PRAGMA table_info(heating_usage)")
    cols = [row[1] for row in cursor.fetchall()]
    if 'user_id' not in cols:
        cursor.execute("ALTER TABLE heating_usage ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")

    cursor.execute("DELETE FROM heating_usage")
    conn.commit()

    total_records = 0
    day_stats = []

    for day in range(NUM_DAYS):
        current_date = START_DATE + datetime.timedelta(days=day)
        progress = day / (NUM_DAYS - 1)

        target_kwh = lerp(TARGET_START_KWH, TARGET_END_KWH, progress)
        target_wh = target_kwh * 1000
        shape = interpolate_shape(progress)
        noise_level = lerp(0.18, 0.08, progress)

        is_weekend = current_date.weekday() >= 5
        is_relapse = day in RELAPSE_DAYS

        hours = generate_day_hours(shape, target_wh, is_weekend, is_relapse, noise_level)

        daily_usage_hours = 0
        for hour, watt_usage in enumerate(hours):
            timestamp = datetime.datetime.combine(current_date, datetime.time(hour))
            if watt_usage > 50:
                daily_usage_hours += 1
            cursor.execute(
                "INSERT INTO heating_usage (timestamp, watt_usage, daily_usage_hours, date, user_id) VALUES (?, ?, ?, ?, ?)",
                (timestamp, watt_usage, daily_usage_hours, current_date, DEMO_USER_ID),
            )
            total_records += 1

        total_kwh = sum(hours) / 1000
        peak_w = max(hours)
        peak_hour = hours.index(peak_w)
        day_stats.append((current_date, total_kwh, peak_w, peak_hour, daily_usage_hours))
        label = "RELAPSE" if is_relapse else ("WEEKEND" if is_weekend else "WEEKDAY")
        print(f"  {current_date} [{label:>7}]  {total_kwh:5.1f} kWh  peak {peak_w:4d}W @ {peak_hour:02d}:00")

    conn.commit()
    conn.close()

    print()
    print(f"  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
    totals = [s[1] for s in day_stats]
    print(f"  Records:    {total_records}")
    print(f"  Range:      {START_DATE} \u2192 {START_DATE + datetime.timedelta(days=NUM_DAYS - 1)}")
    print(f"  Days:       {NUM_DAYS}")
    print(f"  kWh range:  {min(totals):.1f} \u2192 {max(totals):.1f}")
    print(f"  kWh avg:    {sum(totals)/len(totals):.1f}")
    print(f"  Relapses:   {len(RELAPSE_DAYS)} days ({', '.join(str(d+1) for d in sorted(RELAPSE_DAYS))})")
    print(f"  User ID:    {DEMO_USER_ID}")


if __name__ == "__main__":
    seed_demo_data()
