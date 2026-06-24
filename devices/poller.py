import asyncio
import signal
import sys
from datetime import datetime
from tapo_manager import TapoPlugManager
from config import PLUGS_CONFIG, POLL_INTERVAL_SECONDS, ELECTRICITY_RATE_CENTS_PER_KWH


class EnergyPoller:
    def __init__(self):
        self.manager = None
        self.running = False
        self.plugs_config = PLUGS_CONFIG
        self.poll_interval = POLL_INTERVAL_SECONDS

    async def initialize(self):
        print("=" * 60)
        print("HOUSE ENERGY BUDGETER - POLLER")
        print("=" * 60)
        self.manager = TapoPlugManager(electricity_rate_cents_per_kwh=ELECTRICITY_RATE_CENTS_PER_KWH)
        if not self.manager.init_database():
            print("Failed to initialise database")
            return False
        await self.manager.connect()
        success_count = 0
        for plug_name, ip_address in self.plugs_config.items():
            if await self.manager.add_plug(plug_name, ip_address):
                success_count += 1
        if success_count == 0:
            print("No plugs were successfully added")
            return False
        print(f"Successfully initialised {success_count} plug(s)")
        return True

    async def poll_once(self):
        current_time = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{current_time}] Polling {len(self.manager.devices)} plug(s)...")
        power_data = await self.manager.get_all_power_with_costs()
        self.manager.print_power_with_costs(power_data)
        db_stats = self.manager.get_db_stats()
        if db_stats:
            print(f"Database: {db_stats['readings_count']} readings, ${db_stats['total_cost']:.6f} total cost")
        return power_data

    async def run_polling_loop(self):
        print(f"\nStarting polling loop ({self.poll_interval}s interval)...")
        print("Press Ctrl+C to stop")
        self.running = True
        try:
            while self.running:
                await self.poll_once()
                await asyncio.sleep(self.poll_interval)
        except KeyboardInterrupt:
            print("\nPolling stopped by user")
        except Exception as e:
            print(f"Polling error: {e}")
        finally:
            self.running = False

    def signal_handler(self, signum, frame):
        print(f"\nReceived signal {signum}, shutting down...")
        self.running = False

    async def cleanup(self):
        if self.manager:
            self.manager.close_database()
        print("Cleanup completed")

    async def run(self, duration_seconds=None):
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        if not await self.initialize():
            return
        try:
            if duration_seconds:
                print(f"Running for {duration_seconds} seconds...")
                start_time = datetime.now()
                while self.running and (datetime.now() - start_time).total_seconds() < duration_seconds:
                    await self.poll_once()
                    await asyncio.sleep(self.poll_interval)
                print(f"Completed {duration_second} second run")
            else:
                await self.run_polling_loop()
        finally:
            await self.cleanup()


async def main():
    poller = EnergyPoller()
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
            print(f"Running for {duration} seconds as requested")
            await poller.run(duration_seconds=duration)
        except ValueError:
            print("Usage: python3 poller.py [duration_in_seconds]")
            print("Running indefinitely...")
            await poller.run()
    else:
        await poller.run()


if __name__ == "__main__":
    asyncio.run(main())
