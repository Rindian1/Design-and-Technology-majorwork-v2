import asyncio
import logging
import threading
import time
from datetime import datetime

from tapo import ApiClient

from app.models import DatabaseSession, UserPlug, TapoCredentials
from config import HEATING_DB_PATH

log = logging.getLogger(__name__)

_scheduler_thread = None
_last_toggled = {}


def get_recommendations(plug_name, user_id):
    suggested_on = '06:00'
    suggested_off = '22:00'

    name_lower = (plug_name or '').lower()

    if 'fridge' in name_lower or 'refrigerator' in name_lower:
        suggested_on = '00:00'
        suggested_off = '23:59'
    elif 'heater' in name_lower or 'heating' in name_lower or 'radiator' in name_lower:
        suggested_on = '06:00'
        suggested_off = '09:00'
    elif 'light' in name_lower or 'lamp' in name_lower:
        suggested_on = '07:00'
        suggested_off = '23:00'
    elif 'tv' in name_lower or 'television' in name_lower or 'monitor' in name_lower:
        suggested_on = '18:00'
        suggested_off = '23:00'

    return {'suggested_on': suggested_on, 'suggested_off': suggested_off}


def get_schedule(plug_name, user_id):
    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    sess = db.get_session()
    try:
        plug = sess.query(UserPlug).filter(
            UserPlug.user_id == user_id,
            UserPlug.name == plug_name
        ).first()
        if not plug:
            return None

        recs = get_recommendations(plug_name, user_id)

        return {
            'time_on': plug.time_on,
            'time_off': plug.time_off,
            'suggested_on': recs['suggested_on'],
            'suggested_off': recs['suggested_off'],
        }
    finally:
        sess.close()
        db.close()


def save_schedule(plug_name, user_id, time_on, time_off):
    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    sess = db.get_session()
    try:
        plug = sess.query(UserPlug).filter(
            UserPlug.user_id == user_id,
            UserPlug.name == plug_name
        ).first()
        if not plug:
            return False

        plug.time_on = time_on
        plug.time_off = time_off
        sess.commit()
        return True
    except Exception:
        sess.rollback()
        return False
    finally:
        sess.close()
        db.close()


def _await_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _check_schedules():
    global _last_toggled
    now = datetime.now()
    current_time = now.strftime('%H:%M')
    today_key = now.strftime('%Y-%m-%d')

    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    sess = db.get_session()
    try:
        plugs = sess.query(UserPlug).filter(
            (UserPlug.time_on.isnot(None)) | (UserPlug.time_off.isnot(None))
        ).all()

        for plug in plugs:
            creds = sess.query(TapoCredentials).filter(
                TapoCredentials.user_id == plug.user_id
            ).first()
            if not creds or not creds.password:
                continue

            toggle_key = f'{plug.id}'

            if plug.time_on and current_time == plug.time_on:
                if _last_toggled.get(toggle_key) != f'{today_key}-on':
                    try:
                        client = ApiClient(creds.email, creds.password)
                        device = _await_async(client.p110(plug.ip_address))
                        info = _await_async(device.get_device_info())
                        if not info.device_on:
                            _await_async(device.on())
                            log.info(f'Schedule ON: {plug.name} at {current_time}')
                        _last_toggled[toggle_key] = f'{today_key}-on'
                    except Exception as e:
                        log.warning(f'Schedule ON failed for {plug.name}: {e}')

            if plug.time_off and current_time == plug.time_off:
                if _last_toggled.get(toggle_key) != f'{today_key}-off':
                    try:
                        client = ApiClient(creds.email, creds.password)
                        device = _await_async(client.p110(plug.ip_address))
                        info = _await_async(device.get_device_info())
                        if info.device_on:
                            _await_async(device.off())
                            log.info(f'Schedule OFF: {plug.name} at {current_time}')
                        _last_toggled[toggle_key] = f'{today_key}-off'
                    except Exception as e:
                        log.warning(f'Schedule OFF failed for {plug.name}: {e}')
    finally:
        sess.close()
        db.close()


def _scheduler_loop():
    while True:
        try:
            _check_schedules()
        except Exception as e:
            log.error(f'Scheduler error: {e}')
        time.sleep(30)


def start_scheduler():
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    log.info('Plug scheduler started (checks every 30s)')
