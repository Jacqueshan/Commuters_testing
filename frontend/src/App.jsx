// frontend/src/App.jsx
import React from 'react'; // Make sure React is imported

function App() {
  return (
    // Use flexbox to make the app take full height of the screen
    <div className="flex flex-col min-h-screen bg-gray-100">

      {/* Header Section */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">NYC Transit Hub</h1>
        {/* Navigation items can go here later */}
      </header>

      {/* Main Content Area */}
      {/* 'flex-grow' makes this section take up available space */}
      <main className="flex-grow container mx-auto p-4">
        <h2 className="text-xl mb-4">Real-time Transit Map</h2>
        {/* Map Component will go here */}
        <div className="bg-white p-6 rounded shadow">
          <p className="text-gray-700">Map placeholder...</p>
          {/* We will replace this div with the actual map component soon */}
        </div>
      </main>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
        <p>&copy; 2025 NYC Transit Hub</p>
      </footer>

    </div>
  );
}

export default App;