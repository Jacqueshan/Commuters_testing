# backend/mta_api.py
import requests
from google.transit import gtfs_realtime_pb2
import time
import os
import csv # Import the csv module

# --- Static Stop Data Loading ---

STATION_DATA = {} # Module-level dictionary to hold stop data

def load_stops_data(filepath='backend/stops.txt'):
    """Loads stop data (ID, Name, Lat, Lon) from GTFS stops.txt."""
    stops_dict = {}
    try:
        # Ensure the path is correct relative to the project root if needed
        # Or adjust filepath based on where you run the app from
        full_path = os.path.join(os.path.dirname(__file__), '..', filepath) if '/' in filepath or '\\' in filepath else os.path.join(os.path.dirname(__file__), filepath)

        # If running script directly, __file__ might behave differently, adjust path logic if needed
        # For simplicity assuming stops.txt is in the same 'backend' directory as this script:
        stops_file_path = os.path.join(os.path.dirname(__file__), 'stops.txt')


        if not os.path.exists(stops_file_path):
             print(f"Error: stops.txt not found at {stops_file_path}")
             # Try path relative to project root as fallback (if running flask from root)
             stops_file_path_alt = os.path.join(os.getcwd(), 'backend', 'stops.txt')
             if os.path.exists(stops_file_path_alt):
                  stops_file_path = stops_file_path_alt
             else:
                  print(f"Error: stops.txt also not found at {stops_file_path_alt}")
                  return {} # Return empty if file not found


        print(f"Loading station data from: {stops_file_path}")
        with open(stops_file_path, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            count = 0
            for row in reader:
                # Ensure required fields exist and lat/lon are convertible to float
                if all(k in row for k in ['stop_id', 'stop_name', 'stop_lat', 'stop_lon']):
                    try:
                        stops_dict[row['stop_id']] = {
                            'name': row['stop_name'],
                            'lat': float(row['stop_lat']),
                            'lon': float(row['stop_lon'])
                        }
                        count += 1
                    except ValueError:
                        # Handle cases where lat/lon might not be valid numbers
                        # print(f"Warning: Could not parse lat/lon for stop_id {row['stop_id']}")
                        pass # Skip stops with invalid coordinates
                else:
                    # print(f"Warning: Missing required columns for stop_id {row.get('stop_id', 'UNKNOWN')}")
                    pass # Skip rows with missing essential data
        print(f"Loaded data for {count} stations.")
        return stops_dict
    except FileNotFoundError:
        print(f"Error: Could not find stops.txt at expected location: {stops_file_path}")
        return {}
    except Exception as e:
        print(f"An error occurred loading stops data: {e}")
        return {}

# Load the station data when the module is first imported
STATION_DATA = load_stops_data()

# -----------------------------

# --- Real-time Feed Definitions ---
FEED_URL_1_6_S = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
# ... (other feed URLs remain the same) ...
FEED_URL_SIR = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"
# ----------------------------------


def get_realtime_feed(feed_url):
    """Fetches and parses a GTFS-Realtime feed."""
    # ... (function remains the same as before) ...
    headers = { } # Keys not needed for these RT feeds
    try:
        feed = gtfs_realtime_pb2.FeedMessage()
        response = requests.get(feed_url, headers=headers, timeout=30)
        response.raise_for_status()
        feed.ParseFromString(response.content)
        return feed
    except requests.exceptions.Timeout:
        print(f"Timeout error fetching feed {feed_url}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching feed {feed_url}: {e}")
        return None
    except Exception as e:
        print(f"Error parsing feed {feed_url}: {e}")
        return None


def get_subway_status_updates(feed_id='1'):
    """
    Gets processed trip updates and alerts for a specific feed ID,
    now including coordinates for the first future stop.
    """
    feed_url_map = {
        '1': FEED_URL_1_6_S,
        '26': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
        '16': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
        '21': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
        '31': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
        '36': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
        '51': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-7",
        'si': FEED_URL_SIR,
        # Add BDFM if needed: 'bdfm': FEED_URL_B_D_F_M
    }
    feed_url = feed_url_map.get(str(feed_id).lower())
    if not feed_url:
        print(f"Invalid or unmapped feed ID: {feed_id}")
        return {"error": "Invalid feed ID"}

    feed_message = get_realtime_feed(feed_url)
    if not feed_message:
        return {"error": f"Could not fetch or parse feed for ID {feed_id}"}

    updates = []
    alerts = []
    current_time = time.time()
    header_time = feed_message.header.timestamp

    for entity in feed_message.entity:
        if entity.HasField('trip_update'):
            route_id = entity.trip_update.trip.route_id
            first_future_stop_info = None # Renamed variable

            for stop_time_update in entity.trip_update.stop_time_update:
                event_time = None
                stop_id = stop_time_update.stop_id # Get stop_id

                if stop_time_update.HasField('arrival') and stop_time_update.arrival.time > 0:
                    event_time = stop_time_update.arrival.time
                elif stop_time_update.HasField('departure') and stop_time_update.departure.time > 0:
                    event_time = stop_time_update.departure.time

                if event_time and event_time > current_time:
                    # --- Look up coordinates ---
                    stop_details = STATION_DATA.get(stop_id) # Use .get() for safety
                    # --------------------------
                    first_future_stop_info = {
                        "stop_id": stop_id,
                        "time": event_time
                    }
                    # --- Add coordinates if found ---
                    if stop_details:
                        first_future_stop_info['stop_name'] = stop_details.get('name', 'Unknown Station')
                        first_future_stop_info['latitude'] = stop_details.get('lat')
                        first_future_stop_info['longitude'] = stop_details.get('lon')
                    # -----------------------------
                    break # Found the first future stop

            update_info = {
                "trip_id": entity.trip_update.trip.trip_id,
                "route_id": route_id,
                "start_time": entity.trip_update.trip.start_time,
                "start_date": entity.trip_update.trip.start_date,
                "direction": entity.trip_update.trip.direction_id if entity.trip_update.trip.HasField('direction_id') else None,
                "first_future_stop": first_future_stop_info # Use the new variable name
            }
            updates.append(update_info)

        elif entity.HasField('alert'):
            # ... (alert processing remains the same) ...
             alert_info = {
                 "header": entity.alert.header_text.translation[0].text if entity.alert.header_text.translation else "N/A",
                 "description": entity.alert.description_text.translation[0].text if entity.alert.description_text.translation else "N/A",
                 "active_period": [(p.start, p.end) for p in entity.alert.active_period] if entity.alert.active_period else [],
                 "informed_entities": [{"route_id": ie.route_id, "stop_id": ie.stop_id} for ie in entity.alert.informed_entity] if entity.alert.informed_entity else [],
             }
             alerts.append(alert_info)

    return {
        "feed_id_requested": feed_id,
        "feed_timestamp": header_time,
        "current_processing_time": int(current_time),
        "trip_updates": updates,
        "alerts": alerts,
    }