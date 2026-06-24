from flask import Flask
from flask_cors import CORS
from pathlib import Path


def create_app():
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

    app = Flask(
        __name__,
        template_folder=str(frontend_dir / "templates"),
        static_folder=str(frontend_dir / "static"),
    )

    from config import HEATING_DB_PATH, FLASK_HOST, FLASK_PORT, FLASK_DEBUG
    app.config['DATABASE_PATH'] = HEATING_DB_PATH
    app.config['DEBUG'] = FLASK_DEBUG

    CORS(app)

    from app.routes import register_routes
    register_routes(app)

    return app
