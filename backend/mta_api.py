# backend/mta_api.py
import requests
from google.transit import gtfs_realtime_pb2
import time
import os # Import os to potentially use environment variables for URLs later

# Define the feed URLs (get these from https://api.mta.info/#/subwayRealTimeFeeds)
# Example: Feed for 1, 2, 3, 4, 5, 6, S (42 St Shuttle) lines
# Using the direct endpoint link structure seems more reliable
FEED_URL_1_6_S = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
FEED_URL_A_C_E = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace"
FEED_URL_N_Q_R_W = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
FEED_URL_B_D_F_M = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
FEED_URL_L = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
FEED_URL_J_Z = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
FEED_URL_G = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
FEED_URL_7 = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-7"
FEED_URL_SIR = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si" # Staten Island Railway

# Consider making these configurable via environment variables if needed

def get_realtime_feed(feed_url):
    """Fetches and parses a GTFS-Realtime feed."""
    headers = {
        # Although keys are not required per docs, sometimes APIs change.
        # If you *did* have a key, it would go here:
        # 'x-api-key': os.getenv('MTA_API_KEY')
    }
    try:
        feed = gtfs_realtime_pb2.FeedMessage()
        # Add a timeout to prevent hanging indefinitely
        response = requests.get(feed_url, headers=headers, timeout=30)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        feed.ParseFromString(response.content)
        return feed
    except requests.exceptions.Timeout:
        print(f"Timeout error fetching feed {feed_url}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching feed {feed_url}: {e}")
        return None
    except Exception as e:
        # Catch potential parsing errors too
        print(f"Error parsing feed {feed_url}: {e}")
        return None

def get_subway_status_updates(feed_id='1'):
    """
    Gets processed trip updates for a specific feed ID.
    """
    # Map feed IDs (used in API route) to the actual MTA feed URLs
    feed_url_map = {
        '1': FEED_URL_1_6_S,
        '26': FEED_URL_A_C_E, # Corresponds to A, C, E, H, S lines
        '16': FEED_URL_L,
        '21': FEED_URL_N_Q_R_W, # Corresponds to N, Q, R, W, S lines
        '1': FEED_URL_1_6_S,  # Also 1, 2, 3, 4, 5, 6, S
        '31': FEED_URL_G,
        '36': FEED_URL_J_Z,
        '51': FEED_URL_7,
        'si': FEED_URL_SIR, # Use 'si' for Staten Island Railway? Check API docs convention
        # You might need to refine these IDs based on how you want to query
    }

    feed_url = feed_url_map.get(str(feed_id).lower()) # Handle potential integer input, make case-insensitive
    if not feed_url:
        print(f"Invalid or unmapped feed ID: {feed_id}")
        return {"error": "Invalid feed ID"}

    feed_message = get_realtime_feed(feed_url)
    if not feed_message:
        # Error messages are printed within get_realtime_feed
        return {"error": f"Could not fetch or parse feed for ID {feed_id}"}

    updates = []
    alerts = []
    current_time = time.time()
    header_time = feed_message.header.timestamp

    for entity in feed_message.entity:
        # --- Process Trip Update ---
        if entity.HasField('trip_update'):
            # Basic extraction (can be expanded significantly)
            route_id = entity.trip_update.trip.route_id
            first_future_stop = None

            for stop_time_update in entity.trip_update.stop_time_update:
                event_time = None
                if stop_time_update.HasField('arrival') and stop_time_update.arrival.time > 0:
                    event_time = stop_time_update.arrival.time
                elif stop_time_update.HasField('departure') and stop_time_update.departure.time > 0:
                    event_time = stop_time_update.departure.time

                if event_time and event_time > current_time:
                    first_future_stop = {
                        "stop_id": stop_time_update.stop_id,
                        "time": event_time
                    }
                    break # Found the first future stop

            update_info = {
                "trip_id": entity.trip_update.trip.trip_id,
                "route_id": route_id,
                "start_time": entity.trip_update.trip.start_time,
                "start_date": entity.trip_update.trip.start_date,
                "direction": entity.trip_update.trip.direction_id,
                "first_future_stop": first_future_stop,
                # Add more relevant fields as needed
            }
            updates.append(update_info)
        # --- Process Alert ---
        elif entity.HasField('alert'):
             alert_info = {
                 # Extract relevant alert information
                 # Example: Check for header_text, description_text, informed_entity
                 "header": entity.alert.header_text.translation[0].text if entity.alert.header_text.translation else "N/A",
                 "description": entity.alert.description_text.translation[0].text if entity.alert.description_text.translation else "N/A",
                 "active_period": [(p.start, p.end) for p in entity.alert.active_period] if entity.alert.active_period else [],
                 "informed_entities": [{"route_id": ie.route_id, "stop_id": ie.stop_id} for ie in entity.alert.informed_entity] if entity.alert.informed_entity else [],
             }
             alerts.append(alert_info)

    # Return a structured dictionary
    return {
        "feed_id_requested": feed_id,
        "feed_timestamp": header_time,
        "current_processing_time": int(current_time),
        "trip_updates": updates,
        "alerts": alerts,
    }
    # NOTE: This is still a basic parser. A production app would need
    # more robust error handling, data validation, and likely aggregation
    # logic (e.g., summarizing status per line).