from flask import render_template, jsonify
from datetime import datetime

from app.data_manager import EnergyDataManager, GraphDataProcessor, RecommendationEngine

data_manager = EnergyDataManager()
rec_engine = RecommendationEngine()


def register_routes(app):

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/api/daily-data/<date>')
    def get_daily_data(date):
        if not data_manager.validate_date_range(date):
            return jsonify({'error': 'Date out of range'}), 400
        data = data_manager.fetch_daily_data(date)
        if not data:
            return jsonify({'error': 'No data found for this date'}), 404
        return jsonify(GraphDataProcessor.format_for_chart(data))

    @app.route('/api/statistics/<date>')
    def get_statistics(date):
        if not data_manager.validate_date_range(date):
            return jsonify({'error': 'Date out of range'}), 400
        stats = data_manager.calculate_statistics(date)
        if not stats:
            return jsonify({'error': 'No statistics found for this date'}), 404
        return jsonify(stats)

    @app.route('/api/date-range')
    def get_date_range():
        date_range = data_manager.get_available_dates()
        if not date_range:
            return jsonify({'error': 'No date range available'}), 404
        return jsonify(date_range)

    @app.route('/api/recommendations/<date>')
    def get_recommendations(date):
        if not data_manager.validate_date_range(date):
            return jsonify({'error': 'Date out of range'}), 400
        recs = rec_engine.get_recommendations(date)
        return jsonify({
            'date': date,
            'budget_kwh': 30,
            'rate_per_kwh': 0.30,
            'recommendations': recs
        })

    @app.route('/api/health')
    def health_check():
        return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})
