import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import datetime
import random

from config import HEATING_DB_PATH


def get_base_usage(hour):
    if 18 <= hour <= 23:
        return random.randint(1500, 2000)
    elif 0 <= hour <= 6:
        return random.randint(1000, 1500)
    else:
        return random.randint(0, 500)


def apply_variation(base_usage):
    variation_factor = random.uniform(0.8, 1.2)
    varied_usage = int(base_usage * variation_factor)
    return min(varied_usage, 2000)


def seed_heating_data():
    conn = sqlite3.connect(HEATING_DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS heating_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            watt_usage INTEGER NOT NULL,
            daily_usage_hours REAL NOT NULL,
            date DATE NOT NULL
        )
    ''')
    conn.commit()

    cursor.execute("DELETE FROM heating_usage")
    conn.commit()

    start_date = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for day in range(14):
        current_date = start_date + datetime.timedelta(days=day)
        daily_usage_hours = 0
        for hour in range(24):
            timestamp = current_date + datetime.timedelta(hours=hour)
            base_usage = get_base_usage(hour)
            watt_usage = apply_variation(base_usage)
            if watt_usage > 0:
                daily_usage_hours += 1
            cursor.execute(
                "INSERT INTO heating_usage (timestamp, watt_usage, daily_usage_hours, date) VALUES (?, ?, ?, ?)",
                (timestamp, watt_usage, daily_usage_hours, current_date.date()),
            )
        print(f"Seeded data for {current_date.date()} - {daily_usage_hours} hours of usage")

    conn.commit()
    conn.close()
    print(f"\nData generation completed. 336 records written to {HEATING_DB_PATH}")


if __name__ == "__main__":
    seed_heating_data()
