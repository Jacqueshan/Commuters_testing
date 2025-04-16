// frontend/src/components/MapDisplay.jsx
import React from 'react';
// Import Marker and Popup
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

// Accept tripUpdates as a prop
function MapDisplay({ tripUpdates }) {
  const position = [40.7128, -74.0060]; // NYC Coordinates
  const zoomLevel = 13;

  // Filter updates to only include those with valid coordinates for the next stop
  const updatesWithCoords = (tripUpdates || []).filter(update =>
    update.first_future_stop &&
    update.first_future_stop.latitude != null && // Check for null or undefined
    update.first_future_stop.longitude != null
  );

  // --- DEBUGGING: Log the filtered updates to the console ---
  // console.log("Updates with Coords:", updatesWithCoords);
  // ---------------------------------------------------------

  return (
    <MapContainer center={position} zoom={zoomLevel} scrollWheelZoom={true} className="h-[500px] w-full rounded shadow">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* --- Render Markers --- */}
      {updatesWithCoords.map(update => (
        <Marker
          // Use a unique key for each marker
          key={update.trip_id}
          // Set marker position using latitude and longitude from the update
          position={[
            update.first_future_stop.latitude,
            update.first_future_stop.longitude
          ]}
        >
          <Popup>
            {/* Display useful info in the popup */}
            <b>Route: {update.route_id || 'N/A'}</b><br />
            Stop: {update.first_future_stop.stop_name || `ID ${update.first_future_stop.stop_id}`}<br />
            ETA: {new Date(update.first_future_stop.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}<br />
            Trip ID: {update.trip_id}
          </Popup>
        </Marker>
      ))}
      {/* -------------------- */}

    </MapContainer>
  );
}

// Add defaultProps for safety in case the prop isn't passed
MapDisplay.defaultProps = {
    tripUpdates: []
};


export default MapDisplay;