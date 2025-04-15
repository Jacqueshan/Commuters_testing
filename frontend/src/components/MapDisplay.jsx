// frontend/src/components/MapDisplay.jsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

function MapDisplay() {
  // Coordinates for New York City
  const position = [40.7128, -74.0060];
  const zoomLevel = 13; // Initial zoom level (higher means more zoomed in)

  return (
    // MapContainer requires specific dimensions to be visible.
    // We use Tailwind's arbitrary height class h-[500px]. Adjust as needed.
    // You could also use other Tailwind height classes like h-96, h-screen, etc.
    // or apply height via standard CSS if preferred.
    <MapContainer center={position} zoom={zoomLevel} scrollWheelZoom={true} className="h-[500px] w-full rounded shadow">
      <TileLayer
        // Uses OpenStreetMap tiles - free and open source
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* We will add Markers, Polylines (routes), etc. here later */}
    </MapContainer>
  );
}

export default MapDisplay;