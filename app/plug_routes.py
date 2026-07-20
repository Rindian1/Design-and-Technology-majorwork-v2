import asyncio
from functools import wraps

from flask import Blueprint, render_template, jsonify, session, request
from tapo import ApiClient

from app.models import DatabaseSession, UserPlug, TapoCredentials
from config import HEATING_DB_PATH

plug_bp = Blueprint('plugs', __name__)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


def get_user_id():
    return session.get('user_id', 1)


def get_db():
    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    sess = db.get_session()
    return db, sess


def close_db(db, sess):
    sess.close()
    db.close()


@plug_bp.route('/plugs')
@login_required
def plugs_page():
    return render_template('plugs.html')


@plug_bp.route('/api/plugs', methods=['GET'])
@login_required
def list_plugs():
    user_id = get_user_id()
    db, sess = get_db()
    try:
        plugs = sess.query(UserPlug).filter(UserPlug.user_id == user_id).all()

        tapo_email = session.get('tapo_email')
        tapo_password = session.get('tapo_password')
        has_creds = bool(tapo_email and tapo_password)

        if not has_creds:
            creds = sess.query(TapoCredentials).filter(TapoCredentials.user_id == user_id).first()
            if creds:
                tapo_email = creds.email

        results = []
        for plug in plugs:
            status = None
            if has_creds:
                try:
                    client = ApiClient(tapo_email, tapo_password)
                    device = await_async(client.p110(plug.ip_address))
                    info = await_async(device.get_device_info())
                    status = info.device_on
                except Exception:
                    status = None

            d = plug.to_dict()
            d['status'] = status
            results.append(d)

        return jsonify({
            'plugs': results,
            'credentials_ok': has_creds,
            'email_known': bool(tapo_email),
        })
    finally:
        close_db(db, sess)


@plug_bp.route('/api/plugs', methods=['POST'])
@login_required
def add_plug():
    user_id = get_user_id()
    data = request.get_json(silent=True) or {}

    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()
    ip_address = (data.get('ip_address') or '').strip()
    model = (data.get('model') or '').strip()
    name = (data.get('name') or '').strip()

    if not email or not password:
        return jsonify({'error': 'TAPO email and password are required'}), 400
    if not ip_address:
        return jsonify({'error': 'Plug IP address is required'}), 400
    if not name:
        return jsonify({'error': 'Plug name is required'}), 400

    try:
        client = ApiClient(email, password)
        device = await_async(client.p110(ip_address))
        await_async(device.get_device_info())
    except Exception as e:
        return jsonify({'error': f'Failed to connect to plug: {e}'}), 400

    db, sess = get_db()
    try:
        existing = sess.query(UserPlug).filter(
            UserPlug.user_id == user_id,
            UserPlug.name == name
        ).first()
        if existing:
            return jsonify({'error': 'A plug with this name already exists'}), 409

        plug = UserPlug(name=name, ip_address=ip_address, model=model or None, user_id=user_id)
        sess.add(plug)

        creds = sess.query(TapoCredentials).filter(TapoCredentials.user_id == user_id).first()
        if creds:
            creds.email = email
        else:
            creds = TapoCredentials(user_id=user_id, email=email)
            sess.add(creds)

        sess.commit()

        session['tapo_email'] = email
        session['tapo_password'] = password

        return jsonify(plug.to_dict()), 201
    except Exception as e:
        sess.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        close_db(db, sess)


@plug_bp.route('/api/plugs/<name>', methods=['DELETE'])
@login_required
def remove_plug(name):
    user_id = get_user_id()
    db, sess = get_db()
    try:
        plug = sess.query(UserPlug).filter(
            UserPlug.user_id == user_id,
            UserPlug.name == name
        ).first()
        if not plug:
            return jsonify({'error': 'Plug not found'}), 404
        sess.delete(plug)
        sess.commit()
        return jsonify({'success': True})
    except Exception as e:
        sess.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        close_db(db, sess)


@plug_bp.route('/api/plugs/<name>/toggle', methods=['POST'])
@login_required
def toggle_plug(name):
    user_id = get_user_id()
    tapo_email = session.get('tapo_email')
    tapo_password = session.get('tapo_password')

    if not tapo_email or not tapo_password:
        return jsonify({'error': 'TAPO credentials not found. Please re-add your plug.'}), 401

    db, sess = get_db()
    try:
        plug = sess.query(UserPlug).filter(
            UserPlug.user_id == user_id,
            UserPlug.name == name
        ).first()
        if not plug:
            return jsonify({'error': 'Plug not found'}), 404

        try:
            client = ApiClient(tapo_email, tapo_password)
            device = await_async(client.p110(plug.ip_address))
            info = await_async(device.get_device_info())

            if info.device_on:
                await_async(device.off())
                new_status = False
            else:
                await_async(device.on())
                new_status = True

            return jsonify({'status': new_status})
        except Exception as e:
            return jsonify({'error': f'Failed to toggle plug: {e}'}), 502
    finally:
        close_db(db, sess)


@plug_bp.route('/api/plugs/credentials', methods=['GET'])
@login_required
def get_credentials():
    user_id = get_user_id()
    email = session.get('tapo_email')
    if email:
        return jsonify({'email': email, 'has_password': bool(session.get('tapo_password'))})
    db, sess = get_db()
    try:
        creds = sess.query(TapoCredentials).filter(TapoCredentials.user_id == user_id).first()
        if creds:
            return jsonify({'email': creds.email, 'has_password': bool(session.get('tapo_password'))})
        return jsonify({'email': '', 'has_password': False})
    finally:
        close_db(db, sess)


@plug_bp.route('/api/plugs/credentials', methods=['POST'])
@login_required
def save_credentials():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user_id = get_user_id()
    db, sess = get_db()
    try:
        # Soft validate — try connecting but don't block on network failures
        plug = sess.query(UserPlug).filter(UserPlug.user_id == user_id).first()
        if plug:
            try:
                client = ApiClient(email, password)
                device = await_async(client.p110(plug.ip_address))
                await_async(device.get_device_info())
            except Exception:
                pass

        session['tapo_email'] = email
        session['tapo_password'] = password

        creds = sess.query(TapoCredentials).filter(TapoCredentials.user_id == user_id).first()
        if creds:
            creds.email = email
        else:
            creds = TapoCredentials(user_id=user_id, email=email)
            sess.add(creds)
        sess.commit()

        return jsonify({'success': True})
    finally:
        close_db(db, sess)


@plug_bp.route('/api/plugs/<name>/schedule', methods=['GET'])
@login_required
def get_plug_schedule(name):
    user_id = get_user_id()
    from app.plug_scheduler import get_schedule as fetch_schedule
    data = fetch_schedule(name, user_id)
    if data is None:
        return jsonify({'error': 'Plug not found'}), 404
    return jsonify(data)


@plug_bp.route('/api/plugs/<name>/schedule', methods=['POST'])
@login_required
def save_plug_schedule(name):
    user_id = get_user_id()
    data = request.get_json(silent=True) or {}
    time_on = data.get('time_on')
    time_off = data.get('time_off')

    from app.plug_scheduler import save_schedule as persist_schedule
    ok = persist_schedule(name, user_id, time_on, time_off)
    if not ok:
        return jsonify({'error': 'Plug not found'}), 404
    return jsonify({'success': True})


def await_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
