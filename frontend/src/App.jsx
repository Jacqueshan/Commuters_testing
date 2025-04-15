// frontend/src/App.jsx
import React from 'react';
import MapDisplay from './components/MapDisplay'; // <-- IMPORT THE NEW COMPONENT

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header Section */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">NYC Transit Hub</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto p-4">
        <h2 className="text-xl mb-4">Real-time Transit Map</h2>

        {/* Replace the placeholder div with the MapDisplay component */}
        <MapDisplay /> {/* <--- USE THE MAP COMPONENT HERE */}

      </main>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
        <p>&copy; 2025 NYC Transit Hub</p> {/* Updated year based on current date */}
      </footer>
    </div>
  );
}

export default App;