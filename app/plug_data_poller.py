import asyncio
import json
import logging
import threading
import time
from datetime import datetime

from tapo import ApiClient

from app.models import DatabaseSession, UserPlug, TapoCredentials, UserProfile, Reading, DailyTotal
from config import HEATING_DB_PATH, PLUG_POLL_INTERVAL

log = logging.getLogger(__name__)

_poller_thread = None


def _await_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_rate_for_user(sess, user_id):
    profile = sess.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile and profile.survey_data:
        data = json.loads(profile.survey_data)
        knows_plan = data.get('knows_plan', 'no')
        if knows_plan == 'yes' and data.get('plan_type') == 'tou':
            rate_cents = float(data.get('peak_charge', 30))
        else:
            rate_cents = float(data.get('peak_charge', 27))
        return (rate_cents / 100) or 0.30
    return 0.30


def _poll_once():
    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    sess = db.get_session()
    try:
        plugs = sess.query(UserPlug).all()
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')

        for plug in plugs:
            creds = sess.query(TapoCredentials).filter(
                TapoCredentials.user_id == plug.user_id
            ).first()
            if not creds or not creds.password:
                continue

            rate = _get_rate_for_user(sess, plug.user_id)

            try:
                client = ApiClient(creds.email, creds.password)
                device = _await_async(client.p110(plug.ip_address))

                current_power_mw = None
                try:
                    power_info = _await_async(device.get_current_power())
                    current_power_mw = power_info.current_power
                except Exception as e:
                    print(f"Poll read error for '{plug.name}': {e}")
                    continue

                watts = current_power_mw / 1000 if current_power_mw else 0
                cost_increment = round(watts * rate, 6)

                reading = Reading(
                    plug_name=plug.name,
                    watts=round(watts, 4),
                    cost_increment=cost_increment,
                    timestamp=now,
                    date=today_str,
                )
                sess.add(reading)

                existing = sess.query(DailyTotal).filter(
                    DailyTotal.plug_name == plug.name,
                    DailyTotal.date == today_str,
                ).first()

                if existing:
                    existing.total_cost_dollars = round(existing.total_cost_dollars + cost_increment, 6)
                    existing.total_energy_kwh = round(existing.total_energy_kwh + (watts / 1000), 6)
                    existing.last_updated = now
                else:
                    sess.add(DailyTotal(
                        plug_name=plug.name,
                        date=today_str,
                        total_cost_dollars=cost_increment,
                        total_energy_kwh=watts / 1000,
                        last_updated=now,
                    ))

                sess.commit()
                log.info(f'Poll: {plug.name} = {watts:.1f}W, cost ${cost_increment:.4f}')

            except Exception as e:
                print(f"Poll connection error for '{plug.name}': {e}")
                sess.rollback()
    finally:
        sess.close()
        db.close()


def _poller_loop():
    while True:
        try:
            _poll_once()
        except Exception as e:
            log.error(f'Poller error: {e}')
        time.sleep(PLUG_POLL_INTERVAL)


def start_poller():
    global _poller_thread
    if _poller_thread and _poller_thread.is_alive():
        return
    _poller_thread = threading.Thread(target=_poller_loop, daemon=True)
    _poller_thread.start()
    log.info(f'Plug data poller started (every {PLUG_POLL_INTERVAL}s)')
