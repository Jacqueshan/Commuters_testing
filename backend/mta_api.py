# backend/mta_api.py
import requests
from google.transit import gtfs_realtime_pb2
import time
import os
import csv

# --- Static Stop Data Loading ---
STATION_DATA = {}
def load_stops_data(filepath='stops.txt'):
    """Loads stop data (ID, Name, Lat, Lon) from GTFS stops.txt."""
    stops_dict = {}
    stops_file_path = os.path.join(os.path.dirname(__file__), filepath)
    try:
        print(f"Loading station data from: {stops_file_path}")
        with open(stops_file_path, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            count = 0
            for row in reader:
                if all(k in row for k in ['stop_id', 'stop_name', 'stop_lat', 'stop_lon']):
                    try:
                        lat = float(row['stop_lat'])
                        lon = float(row['stop_lon'])
                        stops_dict[row['stop_id']] = {'name': row['stop_name'], 'lat': lat, 'lon': lon}
                        count += 1
                    except (ValueError, TypeError): pass
                else: pass
        print(f"Loaded data for {count} stations.")
        return stops_dict
    except FileNotFoundError:
        print(f"Error: Could not find stops.txt at expected location: {stops_file_path}")
        alt_path = os.path.join(os.getcwd(), 'backend', filepath)
        if os.path.exists(alt_path) and stops_file_path != alt_path:
             print(f"Attempting fallback path: {alt_path}")
             return load_stops_data(os.path.basename(filepath))
        return {}
    except Exception as e:
        print(f"An error occurred loading stops data: {e}")
        return {}

STATION_DATA = load_stops_data()
# -----------------------------

# --- Real-time Feed Definitions ---
FEED_URL_1_6_S = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
FEED_URL_A_C_E = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace"
FEED_URL_N_Q_R_W = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
FEED_URL_B_D_F_M = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
FEED_URL_L = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
FEED_URL_J_Z = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
FEED_URL_G = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
FEED_URL_7 = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-7"
FEED_URL_SIR = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"
# ----------------------------------

# --- Accessibility Feed Definition (Corrected URL) ---
ELEVATOR_ESCALATOR_OUTAGES_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json"
# -----------------------------------------------------


def get_realtime_feed(feed_url):
    """Fetches and parses a GTFS-Realtime feed."""
    headers = {}
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
        print(f"Error parsing GTFS-RT feed {feed_url}: {e}")
        return None


def get_subway_status_updates(feed_id='1'):
    """
    Gets processed trip updates and alerts for a specific feed ID,
    including coordinates for the first future stop.
    """
    # ... (function remains the same) ...
    feed_url_map = {
        '1': FEED_URL_1_6_S, '26': FEED_URL_A_C_E, '16': FEED_URL_L,
        '21': FEED_URL_N_Q_R_W, '31': FEED_URL_G, '36': FEED_URL_J_Z,
        '51': FEED_URL_7, 'si': FEED_URL_SIR,
    }
    feed_url = feed_url_map.get(str(feed_id).lower())
    if not feed_url: return {"error": "Invalid feed ID"}
    feed_message = get_realtime_feed(feed_url)
    if not feed_message: return {"error": f"Could not fetch/parse feed ID {feed_id}"}

    updates = []
    alerts = []
    current_time = time.time()
    header_time = feed_message.header.timestamp

    for entity in feed_message.entity:
        if entity.HasField('trip_update'):
            # ... (trip update processing logic remains the same) ...
             route_id = entity.trip_update.trip.route_id
             first_future_stop_info = None
             for stop_time_update in entity.trip_update.stop_time_update:
                 event_time = None; stop_id = stop_time_update.stop_id
                 if stop_time_update.HasField('arrival') and stop_time_update.arrival.time > 0: event_time = stop_time_update.arrival.time
                 elif stop_time_update.HasField('departure') and stop_time_update.departure.time > 0: event_time = stop_time_update.departure.time
                 if event_time and event_time > current_time:
                     stop_details = STATION_DATA.get(stop_id)
                     first_future_stop_info = {"stop_id": stop_id, "time": event_time}
                     if stop_details:
                         first_future_stop_info['stop_name'] = stop_details.get('name', 'Unknown')
                         first_future_stop_info['latitude'] = stop_details.get('lat')
                         first_future_stop_info['longitude'] = stop_details.get('lon')
                     break
             update_info = {
                 "trip_id": entity.trip_update.trip.trip_id, "route_id": route_id,
                 "start_time": entity.trip_update.trip.start_time, "start_date": entity.trip_update.trip.start_date,
                 "direction": entity.trip_update.trip.direction_id if entity.trip_update.trip.HasField('direction_id') else None,
                 "first_future_stop": first_future_stop_info
             }
             updates.append(update_info)
        elif entity.HasField('alert'):
            # ... (alert processing logic remains the same) ...
            try:
                 header_text = entity.alert.header_text.translation[0].text if entity.alert.header_text.translation else "N/A"
                 description_text = entity.alert.description_text.translation[0].text if entity.alert.description_text.translation else "N/A"
                 alert_info = {
                     "header": header_text, "description": description_text,
                     "active_period": [(p.start, p.end) for p in entity.alert.active_period if p.HasField('start') or p.HasField('end')] if entity.alert.active_period else [],
                     "informed_entities": [{"route_id": ie.route_id, "stop_id": ie.stop_id} for ie in entity.alert.informed_entity] if entity.alert.informed_entity else [],
                 }
                 alerts.append(alert_info)
            except IndexError:
                 print(f"Warning: Could not parse alert translation for entity {entity.id}")
                 alerts.append({"header": "Alert Parsing Error", "description": "Could not read alert details."})

    return {
        "feed_id_requested": feed_id, "feed_timestamp": header_time,
        "current_processing_time": int(current_time),
        "trip_updates": updates, "alerts": alerts,
    }

# --- UPDATED: Function to get Elevator/Escalator Outages ---
def get_elevator_escalator_outages():
    """Fetches current elevator and escalator outages from the MTA API."""
    api_key = os.getenv('MTA_API_KEY')
    # Note: Based on the URL structure (Dataservice/mtagtfsfeeds/...), this feed
    # might *not* require an API key, similar to the GTFS-RT feeds.
    # We'll try without the key first. If it fails with 401/403, we'll add the key logic back.
    headers = {}
    # if api_key:
    #     headers['x-api-key'] = api_key # Or appropriate header name
    # else:
    #     print("Warning: MTA_API_KEY not found, attempting access without key.")
    #     # Decide if you want to return an error immediately or try without key
    #     # return {"error": "Server configuration error: Missing MTA API Key"}

    try:
        print(f"Fetching Elevator/Escalator outages from: {ELEVATOR_ESCALATOR_OUTAGES_URL}")
        response = requests.get(ELEVATOR_ESCALATOR_OUTAGES_URL, headers=headers, timeout=20)
        response.raise_for_status()

        outage_data = response.json()
        # Assuming the JSON structure is a list of outage objects directly
        # Adjust parsing if it's nested under a key like 'entity'
        print(f"Successfully fetched {len(outage_data)} outage records.")
        return outage_data # Return the list directly

    except requests.exceptions.Timeout:
        print(f"Timeout error fetching elevator/escalator outages.")
        return {"error": "Timeout fetching accessibility data"}
    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response is not None else 'N/A'
        print(f"Error fetching elevator/escalator outages: {status_code} - {e}")
        error_detail = e.response.text if e.response else str(e)
        if status_code == 401 or status_code == 403:
             # If we get 401/403, it likely DOES need the key
             print("Authorization error received. MTA_API_KEY might be required for this feed.")
             return {"error": f"Authorization error ({status_code}) fetching accessibility data. API Key may be required."}
        return {"error": f"HTTP error ({status_code}) fetching accessibility data."}
    except ValueError as e: # Catches JSON decoding errors
        print(f"Error decoding JSON from elevator/escalator outages response: {e}")
        return {"error": "Invalid format received for accessibility data"}
    except Exception as e:
        print(f"An unexpected error occurred fetching elevator/escalator outages: {e}")
        return {"error": "Unexpected error fetching accessibility data"}
# --------------------------------------------------------
