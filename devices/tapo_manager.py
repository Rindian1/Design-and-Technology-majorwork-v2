import asyncio
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from tapo import ApiClient
from tapo.requests import PowerDataInterval, EnergyDataInterval

from config import ENERGY_DB_PATH, TAPO_USERNAME, TAPO_PASSWORD, ELECTRICITY_RATE_CENTS_PER_KWH

load_dotenv()


class TapoPlugManager:
    def __init__(self, username=None, password=None, electricity_rate_cents_per_kwh=ELECTRICITY_RATE_CENTS_PER_KWH):
        self.username = username or TAPO_USERNAME
        self.password = password or TAPO_PASSWORD
        self.client = None
        self.devices = {}
        self.electricity_rate_cents_per_kwh = electricity_rate_cents_per_kwh
        self.daily_cost_totals = {}
        self.last_reading_time = {}
        self.db_conn = None

        if not self.username or not self.password:
            raise ValueError("TAPO_USERNAME and TAPO_PASSWORD must be set in .env file or passed as parameters")

        print(f"Electricity rate set to {self.electricity_rate_cents_per_kwh} cents/kWh (${self.electricity_rate_cents_per_kwh/100:.2f}/kWh)")

    def init_database(self):
        try:
            self.db_conn = sqlite3.connect(ENERGY_DB_PATH)
            cursor = self.db_conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plug_name TEXT NOT NULL,
                    watts REAL NOT NULL,
                    cost_increment REAL NOT NULL,
                    timestamp DATETIME NOT NULL,
                    date TEXT NOT NULL
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS daily_totals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plug_name TEXT NOT NULL,
                    date TEXT NOT NULL,
                    total_cost_dollars REAL NOT NULL,
                    total_energy_kwh REAL DEFAULT 0,
                    last_updated DATETIME NOT NULL,
                    UNIQUE(plug_name, date)
                )
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_readings_plug_timestamp
                ON readings (plug_name, timestamp)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_readings_date
                ON readings (date)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_daily_totals_plug_date
                ON daily_totals (plug_name, date)
            ''')

            self.db_conn.commit()
            print(f"Database initialised at {ENERGY_DB_PATH}")
            return True
        except Exception as e:
            print(f"Failed to initialise database: {e}")
            return False

    def get_db_stats(self):
        if not self.db_conn:
            return None
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM readings")
            count = cursor.fetchone()[0]
            cursor.execute("SELECT COALESCE(SUM(cost_increment), 0) FROM readings")
            total_cost = cursor.fetchone()[0]
            return {'readings_count': count, 'total_cost': total_cost}
        except Exception as e:
            print(f"Failed to get DB stats: {e}")
            return None

    def close_database(self):
        if self.db_conn:
            self.db_conn.close()
            self.db_conn = None
            print("Database connection closed")

    def _store_reading(self, plug_name, watts, cost_increment):
        if not self.db_conn:
            return
        try:
            now = datetime.now()
            cursor = self.db_conn.cursor()
            cursor.execute(
                "INSERT INTO readings (plug_name, watts, cost_increment, timestamp, date) VALUES (?, ?, ?, ?, ?)",
                (plug_name, watts, cost_increment, now.strftime('%Y-%m-%d %H:%M:%S'), now.strftime('%Y-%m-%d')),
            )

            today = now.strftime('%Y-%m-%d')
            cursor.execute(
                "SELECT total_cost_dollars, total_energy_kwh FROM daily_totals WHERE plug_name = ? AND date = ?",
                (plug_name, today),
            )
            row = cursor.fetchone()
            if row:
                new_cost = row[0] + cost_increment
                new_energy = row[1] + (watts / 1000) * (10 / 3600)
                cursor.execute(
                    "UPDATE daily_totals SET total_cost_dollars = ?, total_energy_kwh = ?, last_updated = ? WHERE plug_name = ? AND date = ?",
                    (new_cost, new_energy, now, plug_name, today),
                )
            else:
                cursor.execute(
                    "INSERT INTO daily_totals (plug_name, date, total_cost_dollars, total_energy_kwh, last_updated) VALUES (?, ?, ?, ?, ?)",
                    (plug_name, today, cost_increment, (watts / 1000) * (10 / 3600), now),
                )

            self.db_conn.commit()
        except Exception as e:
            print(f"Failed to store reading: {e}")

    async def connect(self):
        try:
            self.client = ApiClient(self.username, self.password)
            print("TAPO API client initialised successfully")
        except Exception as e:
            raise ConnectionError(f"Failed to initialise TAPO client: {e}")

    async def add_plug(self, name, ip_address):
        if not self.client:
            await self.connect()
        try:
            device = await self.client.p110(ip_address)
            self.devices[name] = {'device': device, 'ip': ip_address, 'name': name}
            print(f"Added plug '{name}' at {ip_address}")
            return True
        except Exception as e:
            print(f"Failed to add plug '{name}' at {ip_address}: {e}")
            return False

    async def get_current_power(self, plug_name):
        if plug_name not in self.devices:
            raise ValueError(f"Plug '{plug_name}' not found")
        try:
            device = self.devices[plug_name]['device']
            current_power = await device.get_current_power()
            return current_power.current_power
        except Exception as e:
            print(f"Error reading power from '{plug_name}': {e}")
            return None

    async def get_energy_usage(self, plug_name):
        if plug_name not in self.devices:
            raise ValueError(f"Plug '{plug_name}' not found")
        try:
            device = self.devices[plug_name]['device']
            energy_usage = await device.get_energy_usage()
            return {
                'current_power': energy_usage.current_power,
                'today_energy': energy_usage.today_energy,
                'month_energy': energy_usage.month_energy,
                'today_runtime': energy_usage.today_runtime,
            }
        except Exception as e:
            print(f"Error reading energy usage from '{plug_name}': {e}")
            return None

    async def get_device_usage(self, plug_name):
        if plug_name not in self.devices:
            raise ValueError(f"Plug '{plug_name}' not found")
        try:
            device = self.devices[plug_name]['device']
            device_usage = await device.get_device_usage()
            return {
                'power_usage_today': device_usage.power_usage.today,
                'power_usage_past7': device_usage.power_usage.past7,
                'power_usage_past30': device_usage.power_usage.past30,
                'saved_power_today': device_usage.saved_power.today,
                'time_usage_today': device_usage.time_usage.today,
            }
        except Exception as e:
            print(f"Error reading device usage from '{plug_name}': {e}")
            return None

    async def get_power_history(self, plug_name, hours=2):
        if plug_name not in self.devices:
            raise ValueError(f"Plug '{plug_name}' not found")
        try:
            device = self.devices[plug_name]['device']
            now = datetime.now(timezone.utc)
            power_data = await device.get_power_data(
                PowerDataInterval.Every5Minutes,
                now - timedelta(hours=hours),
                now,
            )
            return [{'timestamp': entry.start_date_time, 'power': entry.power} for entry in power_data.entries]
        except Exception as e:
            print(f"Error reading power history from '{plug_name}': {e}")
            return []

    async def get_daily_summary(self, plug_name, days=7):
        if plug_name not in self.devices:
            raise ValueError(f"Plug '{plug_name}' not found")
        try:
            device = self.devices[plug_name]['device']
            today = datetime.now(timezone.utc)
            start_date = today - timedelta(days=days)
            energy_data_daily = await device.get_energy_data(EnergyDataInterval.Daily, start_date)
            daily_totals = {}
            for entry in energy_data_daily.entries:
                date_str = entry.start_date_time.strftime("%Y-%m-%d")
                day_name = entry.start_date_time.strftime("%A")
                if date_str not in daily_totals:
                    daily_totals[date_str] = {'day_name': day_name, 'energy': 0}
                daily_totals[date_str]['energy'] += entry.energy
            return dict(sorted(daily_totals.items()))
        except Exception as e:
            print(f"Error reading daily summary from '{plug_name}': {e}")
            return {}

    async def get_all_current_power(self):
        results = {}
        for plug_name in self.devices:
            power = await self.get_current_power(plug_name)
            results[plug_name] = power
        return results

    def calculate_cost_increment(self, watts, seconds_elapsed):
        rate_per_kwh_dollars = self.electricity_rate_cents_per_kwh / 100
        kw = watts / 1000
        hours = seconds_elapsed / 3600
        return kw * hours * rate_per_kwh_dollars

    def calculate_cost_from_kwh(self, kwh):
        rate_per_kwh_dollars = self.electricity_rate_cents_per_kwh / 100
        return kwh * rate_per_kwh_dollars

    def set_electricity_rate(self, cents_per_kwh):
        self.electricity_rate_cents_per_kwh = cents_per_kwh
        print(f"Electricity rate updated to {cents_per_kwh} cents/kWh (${cents_per_kwh/100:.2f}/kWh)")

    def reset_daily_totals(self):
        self.daily_cost_totals.clear()
        print("Daily cost totals reset")

    def get_daily_total(self, plug_name):
        return self.daily_cost_totals.get(plug_name, 0.0)

    async def update_daily_cost(self, plug_name):
        current_time = datetime.now(timezone.utc)
        current_power = await self.get_current_power(plug_name)
        if current_power is None:
            return None, None, self.get_daily_total(plug_name)
        if plug_name not in self.daily_cost_totals:
            self.daily_cost_totals[plug_name] = 0.0
        cost_increment = 0.0
        if plug_name in self.last_reading_time:
            seconds_elapsed = (current_time - self.last_reading_time[plug_name]).total_seconds()
            cost_increment = self.calculate_cost_increment(current_power, seconds_elapsed)
            self.daily_cost_totals[plug_name] += cost_increment
        self.last_reading_time[plug_name] = current_time
        daily_total = self.daily_cost_totals[plug_name]
        self._store_reading(plug_name, current_power, cost_increment)
        return current_power, cost_increment, daily_total

    async def get_all_power_with_costs(self):
        results = {}
        for plug_name in self.devices:
            current_power, cost_increment, daily_total = await self.update_daily_cost(plug_name)
            if current_power is not None:
                results[plug_name] = {'power_watts': current_power, 'daily_total_dollars': daily_total, 'status': 'online'}
            else:
                results[plug_name] = {'power_watts': 0.0, 'daily_total_dollars': self.get_daily_total(plug_name), 'status': 'offline'}
        return results

    def print_power_with_costs(self, power_data):
        current_time = datetime.now().strftime("%H:%M:%S")
        for plug_name, data in power_data.items():
            if data['status'] == 'online':
                print(f"[{current_time}] {plug_name:<15} | {data['power_watts']:<7.1f}W | Today: ${data['daily_total_dollars']:.3f}")
            else:
                print(f"[{current_time}] {plug_name:<15} | {'--':<7}W | Today: ${data['daily_total_dollars']:.3f} (offline: skipped)")

    def list_plugs(self):
        print("Managed Plugs:")
        for name, info in self.devices.items():
            print(f"  - {name}: {info['ip']}")
        return list(self.devices.keys())

    async def print_full_report(self, plug_name):
        print(f"\n{'='*50}")
        print(f"COMPREHENSIVE REPORT: {plug_name.upper()}")
        print(f"{'='*50}")
        current_power = await self.get_current_power(plug_name)
        if current_power is not None:
            print(f"Current Power: {current_power}W")
        energy_usage = await self.get_energy_usage(plug_name)
        if energy_usage:
            today_cost = self.calculate_cost_from_kwh(energy_usage['today_energy'])
            month_cost = self.calculate_cost_from_kwh(energy_usage['month_energy'])
            print(f"Today's Usage: {energy_usage['today_energy']} kWh (${today_cost:.2f})")
            print(f"This Month: {energy_usage['month_energy']} kWh (${month_cost:.2f})")
            print(f"Today's Runtime: {energy_usage['today_runtime']} minutes")
        device_usage = await self.get_device_usage(plug_name)
        if device_usage:
            print(f"Power Usage Today: {device_usage['power_usage_today']}W")
            print(f"Power Usage Past 7 Days: {device_usage['power_usage_past7']}W")
            print(f"Power Usage Past 30 Days: {device_usage['power_usage_past30']}W")
            print(f"Saved Power Today: {device_usage['saved_power_today']}W")
            print(f"Time Usage Today: {device_usage['time_usage_today']} minutes")
        print(f"\nPower Usage History (Last 2 Hours):")
        power_history = await self.get_power_history(plug_name)
        if power_history:
            print(f"Found {len(power_history)} readings:")
            for entry in power_history[-10:]:
                timestamp = entry['timestamp'].strftime("%H:%M")
                print(f"  {timestamp}: {entry['power']}W")
        else:
            print("No historical data available")
        print(f"\nDaily Power Usage Summary (Past Week):")
        daily_summary = await self.get_daily_summary(plug_name)
        if daily_summary:
            print(f"{'Date':<12} {'Day':<10} {'Energy (kWh)':<15} {'Cost':<10}")
            print("-" * 52)
            total_weekly_energy = 0
            total_weekly_cost = 0
            for date_str, data in list(daily_summary.items())[-7:]:
                energy = data['energy']
                day_name = data['day_name']
                cost = self.calculate_cost_from_kwh(energy)
                print(f"{date_str:<12} {day_name:<10} {energy:<15.3f} ${cost:<9.2f}")
                total_weekly_energy += energy
                total_weekly_cost += cost
            print("-" * 52)
            print(f"{'Weekly Total:':<22} {total_weekly_energy:<15.3f} kWh ${total_weekly_cost:<9.2f}")
        else:
            print("No daily energy data available for the past week")


async def main():
    manager = TapoPlugManager(electricity_rate_cents_per_kwh=30)
    manager.init_database()
    await manager.add_plug("living_room_plug", "192.168.0.181")
    manager.list_plugs()
    print("\n" + "="*60)
    print("COST CALCULATION DEMONSTRATION")
    print("="*60)
    print("Getting power readings with cost tracking...")
    power_data = await manager.get_all_power_with_costs()
    manager.print_power_with_costs(power_data)
    print("\nWaiting 5 seconds to show cost accumulation...")
    await asyncio.sleep(5)
    power_data = await manager.get_all_power_with_costs()
    manager.print_power_with_costs(power_data)
    print(f"\nDaily Cost Totals:")
    for plug_name in manager.devices:
        daily_total = manager.get_daily_total(plug_name)
        print(f"  {plug_name}: ${daily_total:.6f}")
    print(f"\nCost Calculation Formula:")
    print(f"  Rate: ${manager.electricity_rate_cents_per_kwh/100:.2f}/kWh")
    print(f"  Formula: cost = (watts / 1000) * (seconds_elapsed / 3600) * rate_per_kwh")
    print("\n" + "="*60)
    await manager.print_full_report("living_room_plug")
    manager.close_database()


if __name__ == "__main__":
    asyncio.run(main())
