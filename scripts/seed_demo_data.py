import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import datetime
import random

from config import HEATING_DB_PATH

random.seed(42)

DEMO_USER_ID = 1
START_DATE = datetime.date(2026, 5, 18)
NUM_DAYS = 56

# ── Hourly profiles (24 values, wattage) ──
PROFILES = {
    'always_on': [
        900, 850, 800, 800, 850, 900,
        1200, 1400, 1300, 1100,
        1000, 1000, 1100, 1100,
        1200, 1200, 1300, 1300, 1300,
        1400, 1400, 1300, 1200, 1100,
    ],
    'night_off': [
        200, 150, 100, 100, 150, 200,
        1000, 1200, 1100, 1000,
        900, 900, 1000, 1000,
        1100, 1100, 1100, 1200, 1200,
        1300, 1200, 1100, 1000, 800,
    ],
    'peak_aware': [
        150, 120, 100, 100, 120, 150,
        900, 1000, 1000, 900,
        900, 800, 800, 800,
        700, 600, 500, 500, 500,
        800, 700, 600, 500, 400,
    ],
    'consolidated': [
        100, 80, 60, 60, 80, 100,
        700, 850, 850, 750,
        750, 700, 700, 650,
        450, 350, 250, 250, 350,
        550, 550, 450, 350, 250,
    ],
}

# ── Weekly plan ──
# (week_start_offset, days_in_week, profile_name, target_kwh, appliance_multiplier)
WEEKS = [
    (0,  7, 'always_on',    27.5),    # Week 1: May 18-24
    (7,  7, 'always_on',    27.5),    # Week 2: May 25-31
    (14, 7, 'night_off',    23.0),    # Week 3: Jun 1-7
    (21, 7, 'night_off',    19.0),    # Week 4: Jun 8-14  (appliance upgrade!)
    (28, 7, 'peak_aware',   16.0),    # Week 5: Jun 15-21
    (35, 7, 'peak_aware',   15.0),    # Week 6: Jun 22-28
    (42, 7, 'consolidated', 13.0),    # Week 7: Jun 29 - Jul 5
    (49, 7, 'consolidated', 12.0),    # Week 8: Jul 6-12
]

# ── Relapse days (day offset from START_DATE) ──
# Jun 17 = day 30, Jun 26 = day 39
RELAPSE_DAYS = {30, 39}

# ── Key driver milestones ──
KEY_DRIVERS = {
    14: 'Turned off heater at night',
    21: 'Upgraded to efficient heat pump',
    28: 'Shifted usage away from peak hours',
    42: 'Optimized overall heating schedule',
}

# ── ToU survey data ──
TOU_SURVEY = {
    'appliance_type': 'heater',
    'power_rating': '2400',
    'appliance_model': 'Dyson Hot+Cool HP07',
    'knows_plan': 'yes',
    'plan_type': 'tou',
    'peak_charge': '30',
    'offpeak_charge': '15',
    'shoulder_charge': '20',
    'peak_hours': [{'start': 14, 'end': 20}],
    'offpeak_hours': [{'start': 0, 'end': 6}],
    'shoulder_hours': [{'start': 6, 'end': 14}, {'start': 20, 'end': 24}],
    'intentions': ['reduce_bill', 'monitor'],
    'monthly_budget_dollars': '150',
}

# ── Goal completion data ──
GOAL_SEEDS = [
    {
        'goal_id': 'budget_streak',
        'status': 'completed',
        'current_value': 5,
        'target_value': 5,
        'current_streak': 5,
        'completed': True,
        'timeframe_start': '2026-06-01',
        'last_checked_date': '2026-06-05',
        'streak_start_date': '2026-06-01',
    },
    {
        'goal_id': 'peak_restriction',
        'status': 'completed',
        'current_value': 2,
        'target_value': 2,
        'current_streak': 0,
        'completed': True,
        'timeframe_start': '2026-06-15',
        'last_checked_date': '2026-06-21',
        'streak_start_date': '2026-06-15',
    },
    {
        'goal_id': 'weekly_reduction',
        'status': 'active',
        'current_value': 100,
        'target_value': 100,
        'current_streak': 0,
        'completed': True,
        'timeframe_start': '2026-06-29',
        'last_checked_date': '2026-07-05',
        'streak_start_date': '2026-06-29',
    },
    {
        'goal_id': 'offpeak_shift',
        'status': 'active',
        'current_value': 5,
        'target_value': 5,
        'current_streak': 5,
        'completed': True,
        'timeframe_start': '2026-07-06',
        'last_checked_date': '2026-07-10',
        'streak_start_date': '2026-07-06',
    },
]


def generate_day(profile_name, target_kwh, is_relapse, day_noise):
    profile = PROFILES[profile_name]
    base_sum = sum(profile)
    scale = (target_kwh * 1000) / base_sum if base_sum > 0 else 1
    hours = [v * scale for v in profile]
    for i in range(24):
        noise = random.uniform(1 - day_noise, 1 + day_noise)
        hours[i] = max(0, round(hours[i] * noise))
    if is_relapse:
        for i in range(24):
            if profile_name == 'always_on':
                hours[i] = min(3500, round(hours[i] * random.uniform(1.0, 1.1)))
            else:
                hours[i] = min(3500, round(hours[i] * random.uniform(2.0, 2.5)))
    return hours


def seed_demo_data():
    conn = sqlite3.connect(HEATING_DB_PATH)
    cursor = conn.cursor()

    # Ensure tables exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            key_driver TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, date)
        )
    """)

    # Clear existing data for demo user
    cursor.execute("DELETE FROM heating_usage WHERE user_id = ?", (DEMO_USER_ID,))
    cursor.execute("DELETE FROM daily_drivers WHERE user_id = ?", (DEMO_USER_ID,))
    cursor.execute("DELETE FROM user_goals WHERE user_id = ?", (DEMO_USER_ID,))
    conn.commit()

    # Update user profile to ToU (re-create if missing)
    cursor.execute("SELECT id FROM user_profiles WHERE user_id = ?", (DEMO_USER_ID,))
    if cursor.fetchone():
        cursor.execute(
            "UPDATE user_profiles SET survey_data = ?, points_total = 900 WHERE user_id = ?",
            (json.dumps(TOU_SURVEY), DEMO_USER_ID),
        )
    else:
        cursor.execute(
            "INSERT INTO user_profiles (user_id, survey_data, points_total) VALUES (?, ?, 900)",
            (DEMO_USER_ID, json.dumps(TOU_SURVEY)),
        )

    # Seed goals
    now_str = datetime.datetime.now().isoformat()
    for g in GOAL_SEEDS:
        cursor.execute(
            """INSERT INTO user_goals
               (user_id, goal_id, status, current_value, target_value,
                current_streak, streak_start_date, timeframe_start,
                completed, last_checked_date, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                DEMO_USER_ID,
                g['goal_id'],
                g['status'],
                g['current_value'],
                g['target_value'],
                g['current_streak'],
                g['streak_start_date'],
                g['timeframe_start'],
                1 if g['completed'] else 0,
                g['last_checked_date'],
                now_str,
            ),
        )
    conn.commit()

    # Build day-to-week lookup
    day_to_week = {}
    for offset, count, profile, target in WEEKS:
        for d in range(count):
            day_to_week[offset + d] = (profile, target)

    total_records = 0
    day_stats = []

    for day in range(NUM_DAYS):
        current_date = START_DATE + datetime.timedelta(days=day)
        profile_name, target_kwh = day_to_week[day]
        is_relapse = day in RELAPSE_DAYS
        day_noise = 0.10

        hours = generate_day(profile_name, target_kwh, is_relapse, day_noise)

        for hour, watt_usage in enumerate(hours):
            timestamp = datetime.datetime.combine(current_date, datetime.time(hour))
            cursor.execute(
                "INSERT INTO heating_usage (timestamp, watt_usage, daily_usage_hours, date, user_id) VALUES (?, ?, ?, ?, ?)",
                (timestamp, watt_usage, hour + 1, current_date, DEMO_USER_ID),
            )
            total_records += 1

        # Insert daily driver
        key_driver = KEY_DRIVERS.get(day)
        cursor.execute(
            "INSERT OR IGNORE INTO daily_drivers (user_id, date, key_driver) VALUES (?, ?, ?)",
            (DEMO_USER_ID, current_date, key_driver),
        )

        total_kwh = sum(hours) / 1000
        peak_w = max(hours)
        peak_hour = hours.index(peak_w)
        day_stats.append((current_date, total_kwh, peak_w, peak_hour))

        label = "RELAPSE" if is_relapse else "DRIVER" if key_driver else ""

        driver_info = f" ← {key_driver}" if key_driver else ""
        print(f"  {current_date}  {total_kwh:5.1f} kWh  peak {peak_w:4d}W @ {peak_hour:02d}:00{driver_info}")

    conn.commit()
    conn.close()

    print()
    print(f"  ─────────────────────────────────────────────────────")
    wk1_avg = sum(s[1] for s in day_stats[:7]) / 7
    wk8_avg = sum(s[1] for s in day_stats[-7:]) / 7
    print(f"  Records:     {total_records}")
    print(f"  Range:       {START_DATE} → {START_DATE + datetime.timedelta(days=NUM_DAYS - 1)}")
    print(f"  Days:        {NUM_DAYS}")
    print(f"  Week 1 avg:  {wk1_avg:.1f} kWh")
    print(f"  Week 8 avg:  {wk8_avg:.1f} kWh")
    print(f"  Reduction:   {(1 - wk8_avg/wk1_avg)*100:.0f}%")
    print(f"  Relapses:    {len(RELAPSE_DAYS)}")
    print(f"  Milestones:  {len(KEY_DRIVERS)}")
    print(f"  User ID:     {DEMO_USER_ID}")
    print(f"  Points:      900")
    print(f"  Goals:       4/4 completed")


if __name__ == "__main__":
    seed_demo_data()
