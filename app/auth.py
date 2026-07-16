import json
from datetime import datetime

from flask import Blueprint, session, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func

from config import HEATING_DB_PATH
from app.models import User, UserProfile, DatabaseSession
from app.survey_config import SURVEY_QUESTIONS

auth_bp = Blueprint('auth', __name__)
DEMO_USER_ID = 1


@auth_bp.route('/api/survey/questions', methods=['GET'])
def get_survey_questions():
    return jsonify(SURVEY_QUESTIONS)


@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400

    db = DatabaseSession(HEATING_DB_PATH)
    try:
        session_db = db.get_session()
        existing = session_db.query(User).filter(User.email == email).first()
        if existing:
            return jsonify({'error': 'Email already registered'}), 409

        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            created_at=datetime.now(),
        )
        session_db.add(user)
        session_db.commit()

        session['user_id'] = user.id
        session['email'] = user.email

        return jsonify({'user': user.to_dict()}), 201
    finally:
        session_db.close()
        db.close()


@auth_bp.route('/api/auth/survey', methods=['POST'])
def save_survey():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    data = request.get_json()
    if not data or 'survey_data' not in data:
        return jsonify({'error': 'survey_data is required'}), 400

    survey_data = data['survey_data']

    db = DatabaseSession(HEATING_DB_PATH)
    try:
        session_db = db.get_session()
        profile = session_db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile:
            profile.survey_data = json.dumps(survey_data)
        else:
            profile = UserProfile(
                user_id=user_id,
                survey_data=json.dumps(survey_data),
            )
            session_db.add(profile)
        session_db.commit()

        return jsonify({'status': 'ok', 'survey_data': survey_data})
    finally:
        session_db.close()
        db.close()


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    db = DatabaseSession(HEATING_DB_PATH)
    try:
        session_db = db.get_session()
        user = session_db.query(User).filter(User.email == email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid email or password'}), 401

        session['user_id'] = user.id
        session['email'] = user.email

        return jsonify({'user': user.to_dict()})
    finally:
        session_db.close()
        db.close()


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'logged_out'})


@auth_bp.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    db = DatabaseSession(HEATING_DB_PATH)
    try:
        session_db = db.get_session()
        user = session_db.query(User).filter(User.id == user_id).first()
        if not user:
            session.clear()
            return jsonify({'error': 'User not found'}), 404

        profile = session_db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        survey_data = json.loads(profile.survey_data) if profile and profile.survey_data else None

        return jsonify({
            'user': user.to_dict(),
            'survey_data': survey_data,
        })
    finally:
        session_db.close()
        db.close()


@auth_bp.route('/api/auth/demo', methods=['POST'])
def demo_login():
    session['user_id'] = DEMO_USER_ID
    session['email'] = 'demo@example.com'

    db = DatabaseSession(HEATING_DB_PATH)
    try:
        session_db = db.get_session()
        user = session_db.query(User).filter(User.id == DEMO_USER_ID).first()
        if not user:
            user = User(
                id=DEMO_USER_ID,
                email='demo@example.com',
                password_hash=generate_password_hash('demo'),
                created_at=datetime.now(),
            )
            session_db.add(user)
            session_db.flush()

        profile = session_db.query(UserProfile).filter(UserProfile.user_id == DEMO_USER_ID).first()
        if not profile:
            profile = UserProfile(
                user_id=DEMO_USER_ID,
                survey_data=json.dumps({
                    'appliance_type': 'heater',
                    'power_rating': '2400',
                    'appliance_model': 'Dyson Hot+Cool HP07',
                    'knows_plan': 'yes',
                    'plan_type': 'single',
                    'single_usage_charge': '27.5',
                    'intentions': ['reduce_bill', 'monitor'],
                    'monthly_budget_dollars': '150',
                }),
            )
            session_db.add(profile)
        else:
            profile.survey_data = json.dumps({
                'appliance_type': 'heater',
                'power_rating': '2400',
                'appliance_model': 'Dyson Hot+Cool HP07',
                'knows_plan': 'yes',
                'plan_type': 'single',
                'single_usage_charge': '27.5',
                'intentions': ['reduce_bill', 'monitor'],
                'monthly_budget_dollars': '150',
            })
        session_db.commit()

        return jsonify({'user': user.to_dict()})
    finally:
        session_db.close()
        db.close()
