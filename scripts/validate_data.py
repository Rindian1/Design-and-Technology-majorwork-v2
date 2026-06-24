import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
from collections import defaultdict

from config import HEATING_DB_PATH


def validate_heating_data():
    conn = sqlite3.connect(HEATING_DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM heating_usage")
    total_records = cursor.fetchone()[0]
    print(f"Total records: {total_records}")
    print(f"Expected records: 336")
    print(f"Record count validation: {'PASS' if total_records == 336 else 'FAIL'}")

    cursor.execute("SELECT MIN(timestamp), MAX(timestamp) FROM heating_usage")
    min_time, max_time = cursor.fetchone()
    print(f"\nDate range: {min_time} to {max_time}")

    cursor.execute("SELECT MIN(watt_usage), MAX(watt_usage) FROM heating_usage")
    min_watts, max_watts = cursor.fetchone()
    print(f"Watt usage range: {min_watts}W - {max_watts}W")
    print(f"Watt range validation: {'PASS' if 0 <= min_watts and max_watts <= 2000 else 'FAIL'}")

    cursor.execute("""
        SELECT date, COUNT(*) as hourly_records,
               AVG(watt_usage) as avg_watts,
               MAX(daily_usage_hours) as max_daily_hours
        FROM heating_usage
        GROUP BY date
        ORDER BY date
    """)
    daily_stats = cursor.fetchall()
    print(f"\nDaily Statistics:")
    for date, hourly_records, avg_watts, max_hours in daily_stats:
        print(f"  {date}: {hourly_records} records, avg {avg_watts:.1f}W, max {max_hours:.1f} hours")

    cursor.execute("""
        SELECT
            CASE
                WHEN CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 18 AND 23 THEN 'Evening (6PM-11PM)'
                WHEN CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 0 AND 6 THEN 'Overnight (11PM-6AM)'
                ELSE 'Daytime (6AM-6PM)'
            END as time_period,
            AVG(watt_usage) as avg_watts,
            COUNT(*) as record_count
        FROM heating_usage
        GROUP BY time_period
        ORDER BY avg_watts DESC
    """)
    period_stats = cursor.fetchall()
    print(f"\nTime Period Analysis:")
    for period, avg_watts, count in period_stats:
        print(f"  {period}: avg {avg_watts:.1f}W ({count} records)")

    cursor.execute("""
        SELECT timestamp, COUNT(*) as count
        FROM heating_usage
        GROUP BY timestamp
        HAVING COUNT(*) > 1
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        print(f"\nWARNING: Found {len(duplicates)} duplicate timestamps")
        for timestamp, count in duplicates:
            print(f"  {timestamp}: {count} records")
    else:
        print(f"\nDuplicate timestamp check: PASS")

    cursor.execute("""
        SELECT
            COUNT(*) as total_readings,
            AVG(watt_usage) as avg_watts,
            MAX(watt_usage) as max_watts,
            MIN(watt_usage) as min_watts,
            AVG(daily_usage_hours) as avg_daily_hours
        FROM heating_usage
    """)
    summary = cursor.fetchone()
    print(f"\nSummary Statistics:")
    print(f"  Total readings: {summary[0]}")
    print(f"  Average watt usage: {summary[1]:.1f}W")
    print(f"  Maximum watt usage: {summary[2]}W")
    print(f"  Minimum watt usage: {summary[3]}W")
    print(f"  Average daily usage hours: {summary[4]:.1f}")

    conn.close()

    validation_passed = (total_records == 336 and 0 <= min_watts and max_watts <= 2000 and len(duplicates) == 0)
    print(f"\nOverall Validation: {'PASS' if validation_passed else 'FAIL'}")
    return validation_passed


if __name__ == "__main__":
    validate_heating_data()
