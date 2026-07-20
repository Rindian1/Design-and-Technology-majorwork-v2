from app.models import DatabaseSession, UserPlug
from config import HEATING_DB_PATH


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
