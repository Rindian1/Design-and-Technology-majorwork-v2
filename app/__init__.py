from flask import Flask
from flask_cors import CORS
from pathlib import Path

from app.models import DatabaseSession


def create_app():
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

    app = Flask(
        __name__,
        template_folder=str(frontend_dir / "templates"),
        static_folder=str(frontend_dir / "static"),
    )

    from config import HEATING_DB_PATH, FLASK_HOST, FLASK_PORT, FLASK_DEBUG, SECRET_KEY
    app.config['DATABASE_PATH'] = HEATING_DB_PATH
    app.config['DEBUG'] = FLASK_DEBUG
    app.config['SECRET_KEY'] = SECRET_KEY
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

    CORS(app, supports_credentials=True)

    db = DatabaseSession(HEATING_DB_PATH)
    db.create_tables()
    db.close()

    from app.routes import register_routes
    register_routes(app)

    from app.auth import auth_bp
    app.register_blueprint(auth_bp)

    from app.plug_routes import plug_bp
    app.register_blueprint(plug_bp)

    from app.plug_scheduler import start_scheduler
    start_scheduler()

    return app
