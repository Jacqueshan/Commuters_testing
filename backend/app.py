# backend/app.py
import os
import csv
from functools import wraps # Import wraps for decorator
from flask import Flask, jsonify, request, g # Import request and g for decorator
from flask_cors import CORS
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
import firebase_admin
from firebase_admin import credentials, auth # Import auth for decorator

# Import the mta_api module directly (assuming it's in the same 'backend' folder)
import mta_api

# Load environment variables from .env file in the backend directory
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# --- Explicit CORS Configuration ---
# Configure Cross-Origin Resource Sharing (CORS) to allow requests
# from the frontend development server.
CORS(app, resources={
    # Apply CORS rules to all routes starting with /api/
    r"/api/*": {
        # Allow requests specifically from the frontend origin (adjust port if needed)
        "origins": "http://localhost:5173",
        # Allow standard HTTP methods plus OPTIONS for preflight requests
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        # Allow necessary headers for requests, including Authorization for tokens
        "allow_headers": ["Content-Type", "Authorization"],
    }
})
# ---------------------------------

# --- Database Configuration ---
# Set the database URI. Uses DATABASE_URL environment variable if set,
# otherwise defaults to a local SQLite file named 'app.db' inside an 'instance' folder.
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///app.db'
# Disable modification tracking for SQLAlchemy, as it's not needed and uses extra memory
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Initialize the SQLAlchemy database extension
db = SQLAlchemy(app)
# -----------------------------

# --- Database Models ---
# Defines the structure of the database tables using SQLAlchemy ORM

class User(db.Model):
    """Represents a user in the local database, linked to Firebase Auth."""
    id = db.Column(db.Integer, primary_key=True) # Local primary key
    firebase_uid = db.Column(db.String(128), unique=True, nullable=False) # Firebase unique ID
    # Define relationships to favorite routes and stations
    # 'backref' allows accessing the user from a favorite record (e.g., fav_route.user)
    # 'lazy=True' means related objects are loaded only when accessed
    # 'cascade="all, delete-orphan"' means favorites are deleted if the user is deleted
    favorite_routes = db.relationship('FavoriteRoute', backref='user', lazy=True, cascade="all, delete-orphan")
    favorite_stations = db.relationship('FavoriteStation', backref='user', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        # String representation for debugging
        return f'<User {self.firebase_uid}>'

class FavoriteRoute(db.Model):
    """Represents a user's favorited route."""
    id = db.Column(db.Integer, primary_key=True)
    # Foreign key linking to the User table's primary key (user.id)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    route_id = db.Column(db.String(10), nullable=False) # e.g., '1', 'A', 'L', 'SIR'

    def __repr__(self):
        return f'<FavoriteRoute {self.route_id} for User {self.user_id}>'

class FavoriteStation(db.Model):
    """Represents a user's favorited station."""
    id = db.Column(db.Integer, primary_key=True)
    # Foreign key linking to the User table's primary key (user.id)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    station_id = db.Column(db.String(10), nullable=False) # MTA station ID (often a number)

    def __repr__(self):
        return f'<FavoriteStation {self.station_id} for User {self.user_id}>'
# ----------------------

# --- Firebase Admin SDK Initialization ---
# Load Firebase credentials and initialize the Admin SDK
cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY') # Get path from .env
firebase_app_initialized = False
if cred_path:
    # Construct the full path relative to this app.py file
    full_cred_path = os.path.join(os.path.dirname(__file__), cred_path)
    if os.path.exists(full_cred_path):
        try:
            cred = credentials.Certificate(full_cred_path)
            # Initialize only if no Firebase app has been initialized yet
            if not firebase_admin._apps:
                 firebase_admin.initialize_app(cred)
                 print("Firebase Admin SDK initialized successfully.")
                 firebase_app_initialized = True
            else:
                 print("Firebase Admin SDK already initialized.")
                 firebase_app_initialized = True # Treat as success if already done
        except Exception as e:
            print(f"Error initializing Firebase Admin SDK: {e}")
            # Consider how to handle this failure - app might not work fully
    else:
        print(f"Firebase Admin SDK credentials file not found at calculated path: {full_cred_path}")
else:
    print("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. SDK not initialized.")
# ---------------------------------------

# --- Authentication Decorator ---
def token_required(f):
    """
    Decorator function to verify Firebase ID token present in the
    Authorization header of incoming requests. Protects Flask routes.
    """
    @wraps(f) # Preserves original function metadata
    def decorated_function(*args, **kwargs):
        # Handle CORS preflight (OPTIONS) requests explicitly
        if request.method == 'OPTIONS':
            # Create an empty successful response (204 No Content is suitable)
            # Flask-CORS will add the necessary Access-Control-* headers based on config.
            response = app.make_response(('', 204))
            print("Handled OPTIONS request in decorator.")
            return response # Return immediately, skipping token checks

        # --- Token Verification Logic (Only run for non-OPTIONS requests) ---
        token = None
        # Check if Firebase Admin SDK was initialized successfully
        if not firebase_app_initialized:
             print("Error: Firebase Admin SDK not initialized, cannot verify token.")
             return jsonify({"message": "Firebase Admin SDK not initialized on server!"}), 500

        # Extract token from 'Authorization: Bearer <token>' header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split('Bearer ')[1]

        # If no token found, return 401 Unauthorized
        if not token:
            print("Token verification failed: Token missing")
            return jsonify({"message": "Authentication Token is missing!"}), 401

        try:
            # Verify the ID token using the Firebase Admin SDK.
            # This checks signature, expiration, and issuer.
            decoded_token = auth.verify_id_token(token)

            # Store the verified user's Firebase UID in Flask's request context (g)
            # 'g' is a temporary storage space available only during the current request.
            g.current_user_uid = decoded_token['uid']
            print(f"Token verified for UID: {g.current_user_uid}")

            # Check if the user exists in our local database. If not, create them.
            # This links the Firebase user to our application's database records.
            user = User.query.filter_by(firebase_uid=g.current_user_uid).first()
            if not user:
                 print(f"First time user {g.current_user_uid}, adding to DB.")
                 # Need app context for DB operations outside request context if decorator runs early
                 with app.app_context():
                    new_user = User(firebase_uid=g.current_user_uid)
                    db.session.add(new_user)
                    db.session.commit()
                    g.user_db_id = new_user.id # Store the new local DB ID
            else:
                 g.user_db_id = user.id # Store the existing local DB ID

        # Handle specific Firebase token verification errors
        except auth.ExpiredIdTokenError:
             print("Token verification failed: Expired")
             return jsonify({"message": "Token has expired!"}), 401
        except auth.InvalidIdTokenError as e:
             print(f"Token verification failed: Invalid ({e})")
             return jsonify({"message": "Token is invalid!"}), 401
        # Catch any other unexpected errors during verification or DB check
        except Exception as e:
             print(f"Token verification or DB check failed: Unexpected error - {type(e).__name__}: {e}")
             # Rollback any potential partial DB changes
             db.session.rollback()
             return jsonify({"message": "Token verification or user setup failed!"}), 500
        # ---------------------------------------------------------

        # If token verification and user setup were successful, call the original route function
        return f(*args, **kwargs)
    return decorated_function
# -----------------------------

# --- Basic Routes (Public) ---
@app.route('/')
def home():
    """Simple route for the homepage."""
    return "Hello from NYC Transit Hub Backend!"

@app.route('/api/test')
def api_test():
    """Simple test route to confirm the API is running."""
    return jsonify({"message": "API is working!"})
# ---------------------------

# --- MTA Data API Endpoint (Public) ---
@app.route('/api/subway/status', methods=['GET'])
@app.route('/api/subway/status/<feed_id>', methods=['GET'])
def get_subway_status(feed_id='1'):
    """
    API endpoint to get subway status updates (trip updates, alerts)
    for a given MTA real-time feed ID. Publicly accessible.
    """
    status_data = mta_api.get_subway_status_updates(feed_id)
    # Handle potential errors returned from the mta_api module
    if status_data is None or "error" in status_data:
         error_message = status_data.get("error", "Failed to retrieve subway status.") if status_data else "Failed to retrieve subway status."
         return jsonify({"error": error_message}), 500 # Internal Server Error
    # Return the successfully fetched data
    return jsonify(status_data), 200
# -----------------------------------

# --- Accessibility API Endpoint (Public) ---
@app.route('/api/accessibility/outages', methods=['GET'])
def get_accessibility_outages():
    """
    API endpoint to get current elevator/escalator outages.
    Publicly accessible.
    """
    outage_data = mta_api.get_elevator_escalator_outages()
    # Handle potential errors returned from the mta_api module
    if isinstance(outage_data, dict) and "error" in outage_data:
        return jsonify(outage_data), 500 # Internal Server Error
    # Return the successfully fetched data
    return jsonify(outage_data), 200
# ----------------------------------------------------

# --- Protected User Profile Route ---
@app.route('/api/user/profile', methods=['GET', 'OPTIONS']) # Allow GET and OPTIONS
@token_required # Apply the authentication decorator
def get_user_profile():
    """
    Protected route example. Fetches basic info for the authenticated user.
    Requires a valid Firebase ID token in the Authorization header.
    """
    # The decorator ensures g.current_user_uid and g.user_db_id are set if we reach here
    uid = g.current_user_uid
    user_db_id = g.user_db_id
    print(f"Successfully accessed protected profile route for UID: {uid}")
    # Return the user's Firebase UID and local database ID
    return jsonify({
        "message": "Successfully accessed protected profile route.",
        "user_uid": uid,
        "user_db_id": user_db_id
    }), 200
# -----------------------------

# --- API Endpoints for Favorite Routes (Protected) ---

@app.route('/api/user/favorites/routes', methods=['GET', 'OPTIONS'])
@token_required # Protect this route
def get_favorite_routes():
    """Fetches the favorite route IDs for the authenticated user."""
    # OPTIONS is handled by the decorator now
    user_db_id = g.user_db_id # Get local DB ID from decorator context
    try:
        # Query the database for FavoriteRoute records matching the user's ID
        favorite_routes = FavoriteRoute.query.filter_by(user_id=user_db_id).all()
        # Extract just the route IDs into a list
        route_ids = [fav.route_id for fav in favorite_routes]
        print(f"Fetched favorite routes for user {user_db_id}: {route_ids}")
        return jsonify({"favorite_routes": route_ids}), 200
    except Exception as e:
        # Log error and return a generic server error message
        print(f"Error fetching favorite routes for user {user_db_id}: {e}")
        return jsonify({"message": "Error fetching favorites"}), 500

@app.route('/api/user/favorites/routes', methods=['POST', 'OPTIONS'])
@token_required # Protect this route
def add_favorite_route():
    """Adds a route to the authenticated user's favorites."""
    # OPTIONS is handled by the decorator
    user_db_id = g.user_db_id
    data = request.get_json() # Get JSON data from request body

    # Basic input validation
    if not data or 'route_id' not in data:
        return jsonify({"message": "Missing 'route_id' in request body"}), 400 # Bad Request
    route_id_to_add = data['route_id']
    if not isinstance(route_id_to_add, str) or len(route_id_to_add) > 10: # Example validation
         return jsonify({"message": "Invalid 'route_id' format"}), 400

    try:
        # Check if the route is already favorited by this user to prevent duplicates
        existing_fav = FavoriteRoute.query.filter_by(user_id=user_db_id, route_id=route_id_to_add).first()
        if existing_fav:
            # Return 409 Conflict if already exists
            return jsonify({"message": f"Route '{route_id_to_add}' is already a favorite"}), 409

        # Create a new FavoriteRoute record
        new_fav = FavoriteRoute(user_id=user_db_id, route_id=route_id_to_add)
        # Add to the database session and commit
        db.session.add(new_fav)
        db.session.commit()

        print(f"Added favorite route '{route_id_to_add}' for user {user_db_id}")
        # Return success message and the created object
        return jsonify({
            "message": f"Route '{route_id_to_add}' added to favorites",
            "favorite": {"id": new_fav.id, "route_id": new_fav.route_id}
        }), 201 # 201 Created status code
    except Exception as e:
        db.session.rollback() # Rollback DB changes if an error occurs
        print(f"Error adding favorite route '{route_id_to_add}' for user {user_db_id}: {e}")
        return jsonify({"message": "Error adding favorite"}), 500

@app.route('/api/user/favorites/routes/<string:route_id>', methods=['DELETE', 'OPTIONS'])
@token_required # Protect this route
def remove_favorite_route(route_id):
    """Removes a specific route from the authenticated user's favorites."""
    # OPTIONS is handled by the decorator
    user_db_id = g.user_db_id
    route_id_to_delete = route_id # Get route ID from the URL path parameter

    try:
        # Find the specific favorite record for this user and route
        fav_to_delete = FavoriteRoute.query.filter_by(
            user_id=user_db_id,
            route_id=route_id_to_delete
        ).first()

        # If the favorite doesn't exist, return 404 Not Found
        if not fav_to_delete:
            return jsonify({"message": f"Favorite route '{route_id_to_delete}' not found"}), 404

        # Delete the record from the database session and commit
        db.session.delete(fav_to_delete)
        db.session.commit()

        print(f"Removed favorite route '{route_id_to_delete}' for user {user_db_id}")
        # Return success message
        return jsonify({"message": f"Route '{route_id_to_delete}' removed from favorites"}), 200 # 200 OK
    except Exception as e:
        db.session.rollback() # Rollback DB changes on error
        print(f"Error removing favorite route '{route_id_to_delete}' for user {user_db_id}: {e}")
        return jsonify({"message": "Error removing favorite"}), 500
# ---------------------------------------

# --- API Endpoints for Favorite Stations (Protected) ---

@app.route('/api/user/favorites/stations', methods=['GET', 'OPTIONS'])
@token_required # Protect this route
def get_favorite_stations():
    """Fetches the favorite station IDs for the authenticated user."""
    # OPTIONS is handled by the decorator
    user_db_id = g.user_db_id
    try:
        # Query the database for FavoriteStation records matching the user's ID
        favorite_stations = FavoriteStation.query.filter_by(user_id=user_db_id).all()
        # Extract just the station IDs into a list
        station_ids = [fav.station_id for fav in favorite_stations]
        print(f"Fetched favorite stations for user {user_db_id}: {station_ids}")
        return jsonify({"favorite_stations": station_ids}), 200
    except Exception as e:
        print(f"Error fetching favorite stations for user {user_db_id}: {e}")
        return jsonify({"message": "Error fetching favorite stations"}), 500

@app.route('/api/user/favorites/stations', methods=['POST', 'OPTIONS'])
@token_required # Protect this route
def add_favorite_station():
    """Adds a station to the authenticated user's favorites."""
    # OPTIONS is handled by the decorator
    user_db_id = g.user_db_id
    data = request.get_json()

    # Basic input validation
    if not data or 'station_id' not in data:
        return jsonify({"message": "Missing 'station_id' in request body"}), 400
    station_id_to_add = data['station_id']
    if not isinstance(station_id_to_add, str) or len(station_id_to_add) > 10:
         return jsonify({"message": "Invalid 'station_id' format"}), 400

    try:
        # Check if the station is already favorited by this user
        existing_fav = FavoriteStation.query.filter_by(user_id=user_db_id, station_id=station_id_to_add).first()
        if existing_fav:
            return jsonify({"message": f"Station '{station_id_to_add}' is already a favorite"}), 409 # Conflict

        # Create and save the new favorite station
        new_fav = FavoriteStation(user_id=user_db_id, station_id=station_id_to_add)
        db.session.add(new_fav)
        db.session.commit()

        print(f"Added favorite station '{station_id_to_add}' for user {user_db_id}")
        # Return success message and the created object
        return jsonify({
            "message": f"Station '{station_id_to_add}' added to favorites",
            "favorite": {"id": new_fav.id, "station_id": new_fav.station_id}
        }), 201 # Created
    except Exception as e:
        db.session.rollback()
        print(f"Error adding favorite station '{station_id_to_add}' for user {user_db_id}: {e}")
        return jsonify({"message": "Error adding favorite station"}), 500

@app.route('/api/user/favorites/stations/<string:station_id>', methods=['DELETE', 'OPTIONS'])
@token_required # Protect this route
def remove_favorite_station(station_id):
    """Removes a specific station from the authenticated user's favorites."""
    # OPTIONS is handled by the decorator
    user_db_id = g.user_db_id
    station_id_to_delete = station_id # Get station ID from URL path

    try:
        # Find the specific favorite record for this user and station
        fav_to_delete = FavoriteStation.query.filter_by(
            user_id=user_db_id,
            station_id=station_id_to_delete
        ).first()

        # If not found, return 404
        if not fav_to_delete:
            return jsonify({"message": f"Favorite station '{station_id_to_delete}' not found"}), 404

        # Delete the record and commit
        db.session.delete(fav_to_delete)
        db.session.commit()

        print(f"Removed favorite station '{station_id_to_delete}' for user {user_db_id}")
        # Return success message
        return jsonify({"message": f"Station '{station_id_to_delete}' removed from favorites"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error removing favorite station '{station_id_to_delete}' for user {user_db_id}: {e}")
        return jsonify({"message": "Error removing favorite station"}), 500
# -----------------------------------------

# --- Main Execution Block ---
if __name__ == '__main__':
    # Create database tables if they don't exist when the app starts
    # This is convenient for development. Use migrations (e.g., Flask-Migrate) for production.
    with app.app_context():
         db.create_all()
         print("Database tables checked/created.")

    # Run the Flask development server
    # debug=True enables auto-reloading on code changes and provides detailed error pages
    app.run(debug=True)
# --------------------------
