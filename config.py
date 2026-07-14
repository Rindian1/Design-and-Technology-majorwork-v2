import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).parent

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

HEATING_DB_PATH = str(DATA_DIR / "heating_data.db")
ENERGY_DB_PATH = str(DATA_DIR / "energy.db")
FRONTEND_DIR = BASE_DIR / "frontend"

FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5005"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"

SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))

POLL_INTERVAL_SECONDS = 10
ELECTRICITY_RATE_CENTS_PER_KWH = 30
TWO_WEEK_DAYS = 0  # 0 = show all available dates (no rolling-window cap)

PLUGS_CONFIG = {
    "living_room_plug": "192.168.0.181",
}

TAPO_USERNAME = os.getenv("TAPO_USERNAME")
TAPO_PASSWORD = os.getenv("TAPO_PASSWORD")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
