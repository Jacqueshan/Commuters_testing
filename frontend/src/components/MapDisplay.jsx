    // frontend/src/components/MapDisplay.jsx
    import React from 'react';
    import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

    function MapDisplay({ tripUpdates }) {
      const position = [40.7128, -74.0060]; // NYC Coordinates
      const zoomLevel = 13;

      const updatesWithCoords = (tripUpdates || []).filter(update =>
        update.first_future_stop &&
        update.first_future_stop.latitude != null &&
        update.first_future_stop.longitude != null
      );

      // console.log("Updates with Coords:", updatesWithCoords);

      return (
        <MapContainer center={position} zoom={zoomLevel} scrollWheelZoom={true} className="h-[500px] w-full rounded shadow">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render Markers with improved key */}
          {updatesWithCoords.map((update, index) => ( // Get the index from map
            <Marker
              // Use trip_id combined with index if available, otherwise route_id and index
              key={update.trip_id ? `${update.trip_id}-${index}` : `marker-${update.route_id || 'unknown'}-${index}`}
              position={[
                update.first_future_stop.latitude,
                update.first_future_stop.longitude
              ]}
            >
              <Popup>
                <b>Route: {update.route_id || 'N/A'}</b><br />
                Stop: {update.first_future_stop.stop_name || 'Unknown'} (ID: <span className="font-mono">{update.first_future_stop.stop_id}</span>)<br />
                ETA: {new Date(update.first_future_stop.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}<br />
                Trip ID: {update.trip_id}
              </Popup>
            </Marker>
          ))}

        </MapContainer>
      );
    }

    MapDisplay.defaultProps = {
        tripUpdates: []
    };

    export default MapDisplay;
    