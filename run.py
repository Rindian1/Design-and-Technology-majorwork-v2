from dotenv import load_dotenv

load_dotenv()

from app import create_app
from config import FLASK_HOST, FLASK_PORT, FLASK_DEBUG

app = create_app()

if __name__ == '__main__':
    print(f"Starting Energy Dashboard server on http://{FLASK_HOST}:{FLASK_PORT}")
    app.run(debug=FLASK_DEBUG, host=FLASK_HOST, port=FLASK_PORT)
