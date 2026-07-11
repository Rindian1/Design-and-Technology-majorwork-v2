from functools import wraps

from flask import render_template, jsonify, session
from datetime import datetime

from app.data_manager import EnergyDataManager, GraphDataProcessor, RecommendationEngine

data_manager = EnergyDataManager()
rec_engine = RecommendationEngine()


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


def get_user_id():
    return session.get('user_id', 1)


def register_routes(app):

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/login')
    def login_page():
        return render_template('login.html')

    @app.route('/register')
    def register_page():
        return render_template('register.html')

    @app.route('/api/profile')
    @login_required
    def get_profile():
        user_id = get_user_id()
        profile = data_manager.get_user_profile(user_id)
        return jsonify(profile)

    @app.route('/api/daily-data/<date>')
    @login_required
    def get_daily_data(date):
        user_id = get_user_id()
        if not data_manager.validate_date_range(date, user_id=user_id):
            return jsonify({'error': 'Date out of range'}), 400
        data = data_manager.fetch_daily_data(date, user_id=user_id)
        if not data:
            return jsonify({'error': 'No data found for this date'}), 404
        return jsonify(GraphDataProcessor.format_for_chart(data))

    @app.route('/api/statistics/<date>')
    @login_required
    def get_statistics(date):
        user_id = get_user_id()
        if not data_manager.validate_date_range(date, user_id=user_id):
            return jsonify({'error': 'Date out of range'}), 400
        stats = data_manager.calculate_statistics(date, user_id=user_id)
        if not stats:
            return jsonify({'error': 'No statistics found for this date'}), 404
        return jsonify(stats)

    @app.route('/api/date-range')
    @login_required
    def get_date_range():
        user_id = get_user_id()
        date_range = data_manager.get_available_dates(user_id=user_id)
        if not date_range:
            return jsonify({'error': 'No date range available'}), 404
        return jsonify(date_range)

    @app.route('/api/recommendations/<date>')
    @login_required
    def get_recommendations(date):
        user_id = get_user_id()
        if not data_manager.validate_date_range(date, user_id=user_id):
            return jsonify({'error': 'Date out of range'}), 400
        profile = data_manager.get_user_profile(user_id)
        recs = rec_engine.get_recommendations(date, user_id=user_id)
        return jsonify({
            'date': date,
            'budget_kwh': profile['budget_kwh'],
            'rate_per_kwh': profile['rate_per_kwh'],
            'recommendations': recs
        })

    @app.route('/api/health')
    def health_check():
        return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})
