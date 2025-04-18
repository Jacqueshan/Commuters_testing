# backend/app.py
import os
import csv # Ensure csv is imported if used elsewhere, like in mta_api potentially
from functools import wraps # Import wraps for decorator
from flask import Flask, jsonify, request, g # Import request and g for decorator
from flask_cors import CORS
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
import firebase_admin
from firebase_admin import credentials, auth # Import auth for decorator

# Import the mta_api module directly (assuming it's in the same 'backend' folder)
import mta_api

load_dotenv()

app = Flask(__name__)

# --- Explicit CORS Configuration ---
CORS(app, resources={
    # Apply CORS to all routes starting with /api/
    r"/api/*": {
        # Allow requests only from your frontend origin
        "origins": "http://localhost:5173", # Or your specific frontend port
        # Allow common methods plus OPTIONS for preflight
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        # Allow necessary headers for requests
        "allow_headers": ["Content-Type", "Authorization"],
        # Allow credentials if you use cookies/sessions later (optional for now)
        # "supports_credentials": True
    }
})
# ---------------------------------

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
# -----------------------------

# --- Database Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    firebase_uid = db.Column(db.String(128), unique=True, nullable=False)
    favorite_routes = db.relationship('FavoriteRoute', backref='user', lazy=True, cascade="all, delete-orphan")
    favorite_stations = db.relationship('FavoriteStation', backref='user', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<User {self.firebase_uid}>'

class FavoriteRoute(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    route_id = db.Column(db.String(10), nullable=False)

    def __repr__(self):
        return f'<FavoriteRoute {self.route_id} for User {self.user_id}>'

class FavoriteStation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    station_id = db.Column(db.String(10), nullable=False)

    def __repr__(self):
        return f'<FavoriteStation {self.station_id} for User {self.user_id}>'
# ----------------------

# --- Firebase Admin SDK Initialization ---
cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
firebase_app_initialized = False
if cred_path:
    # Construct path relative to the app.py file's directory
    full_cred_path = os.path.join(os.path.dirname(__file__), cred_path)
    if os.path.exists(full_cred_path):
        try:
            cred = credentials.Certificate(full_cred_path)
            if not firebase_admin._apps:
                 firebase_admin.initialize_app(cred)
                 print("Firebase Admin SDK initialized successfully.")
                 firebase_app_initialized = True
            else:
                 print("Firebase Admin SDK already initialized.")
                 firebase_app_initialized = True
        except Exception as e:
            print(f"Error initializing Firebase Admin SDK: {e}")
    else:
        print(f"Firebase Admin SDK credentials file not found at calculated path: {full_cred_path}")
else:
    print("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. SDK not initialized.")
# ---------------------------------------

# --- Authentication Decorator (Corrected Logic) ---
def token_required(f):
    """Decorator to verify Firebase ID token in Authorization header."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        # Skip token verification logic for OPTIONS preflight requests
        if request.method != 'OPTIONS':
            # Ensure Firebase Admin SDK was initialized before proceeding
            if not firebase_app_initialized:
                 print("Error: Firebase Admin SDK not initialized, cannot verify token.")
                 return jsonify({"message": "Firebase Admin SDK not initialized on server!"}), 500

            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split('Bearer ')[1]

            if not token:
                print("Token verification failed: Token missing")
                return jsonify({"message": "Authentication Token is missing!"}), 401 # Unauthorized

            try:
                # Verify the token using Firebase Admin SDK
                decoded_token = auth.verify_id_token(token)
                # Store user's Firebase UID in Flask's global context 'g' for this request
                g.current_user_uid = decoded_token['uid']
                print(f"Token verified for UID: {g.current_user_uid}") # Server log

                # Optional: Check/create user in local DB
                # Use app_context for database operations within decorator if needed
                with app.app_context():
                    user = User.query.filter_by(firebase_uid=g.current_user_uid).first()
                    if not user:
                         print(f"First time seeing user {g.current_user_uid}, adding to local DB.")
                         new_user = User(firebase_uid=g.current_user_uid)
                         db.session.add(new_user)
                         db.session.commit()
                         g.user_db_id = new_user.id # Store new user's local DB ID
                    else:
                         g.user_db_id = user.id # Store existing user's local DB ID

            except auth.ExpiredIdTokenError:
                 print("Token verification failed: Expired")
                 return jsonify({"message": "Token has expired!"}), 401 # Unauthorized
            except auth.InvalidIdTokenError as e:
                 print(f"Token verification failed: Invalid ({e})")
                 return jsonify({"message": "Token is invalid!"}), 401 # Unauthorized
            except Exception as e:
                # Catch any other unexpected errors during verification
                print(f"Token verification failed: Unexpected error - {e}")
                return jsonify({"message": "Token verification failed!"}), 500 # Internal Server Error

        # Call the actual route function (for both OPTIONS and verified requests)
        # Flask-CORS should handle adding headers to the OPTIONS response path
        return f(*args, **kwargs)
    return decorated_function
# -----------------------------

# --- Basic Routes (Public) ---
@app.route('/')
def home():
    return "Hello from NYC Transit Hub Backend!"

@app.route('/api/test')
def api_test():
    return jsonify({"message": "API is working!"})
# ---------------------------

# --- MTA Data API Endpoint (Public) ---
@app.route('/api/subway/status', methods=['GET'])
@app.route('/api/subway/status/<feed_id>', methods=['GET'])
def get_subway_status(feed_id='1'):
    """API endpoint to get subway status updates for a given feed."""
    status_data = mta_api.get_subway_status_updates(feed_id)
    if status_data is None or "error" in status_data:
         error_message = status_data.get("error", "Failed to retrieve subway status.") if status_data else "Failed to retrieve subway status."
         return jsonify({"error": error_message}), 500
    return jsonify(status_data)
# -----------------------------------

# --- Protected Route Example (Decorator Re-enabled) ---
@app.route('/api/user/profile', methods=['GET', 'OPTIONS']) # Keep OPTIONS here
@token_required # <-- DECORATOR IS NOW ACTIVE
def get_user_profile():
    """Protected route example. Returns the verified user's UID."""
    # If the code reaches here via GET, the token was valid and g.current_user_uid is set
    uid = g.current_user_uid # Use the UID set by the decorator
    user_db_id = g.user_db_id # Get local DB ID set by decorator

    print(f"Successfully accessed protected profile route for UID: {uid}") # Log success

    return jsonify({
        "message": "Successfully accessed protected profile route.",
        "user_uid": uid,
        "user_db_id": user_db_id # Return local DB ID as well
    })
# -----------------------------

# --- API Endpoints for Favorites (To be added later) ---
# ... (placeholder comments) ...
# -----------------------------------------------------


if __name__ == '__main__':
    # Create database tables if they don't exist
    with app.app_context():
         db.create_all()
         print("Database tables checked/created.")

    # Run the Flask development server
    app.run(debug=True)