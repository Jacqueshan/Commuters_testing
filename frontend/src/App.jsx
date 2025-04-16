// frontend/src/App.jsx
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import MapDisplay from './components/MapDisplay';

function App() {
  // --- State Variables ---
  // To store the data fetched from the backend
  const [subwayStatus, setSubwayStatus] = useState(null);
  // To indicate if data is currently being loaded
  const [isLoading, setIsLoading] = useState(true);
  // To store any error messages during fetch
  const [error, setError] = useState(null);
  // ---------------------

  // --- useEffect Hook for Fetching Data ---
  useEffect(() => {
    // Define the function to fetch data
    const fetchSubwayStatus = async () => {
      setIsLoading(true); // Set loading state to true
      setError(null); // Clear previous errors
      try {
        // Make the request to your Flask backend API endpoint
        // IMPORTANT: Use the full URL because frontend (e.g., :5173) and backend (:5000) are on different ports
        const response = await fetch('http://127.0.0.1:5000/api/subway/status'); // Fetches feed '1' by default

        // Check if the request was successful (status code 200-299)
        if (!response.ok) {
          // If not okay, throw an error with the status text
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }

        // Parse the JSON response
        const data = await response.json();
        // Update the state with the fetched data
        setSubwayStatus(data);

      } catch (err) {
        // If an error occurs during fetch or parsing, update the error state
        console.error("Fetch error:", err.message);
        setError(err.message);
      } finally {
        // Regardless of success or error, set loading state to false
        setIsLoading(false);
      }
    };

    fetchSubwayStatus(); // Call the fetch function

    // The empty dependency array [] means this effect runs only once
    // when the component mounts (like componentDidMount in class components)
  }, []);
  // -----------------------------------------

  // --- Component Return (Layout) ---
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header Section */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">NYC Transit Hub</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto p-4">
        <h2 className="text-xl mb-4">Real-time Transit Map</h2>
        <MapDisplay />

        {/* --- Display Fetched Data --- */}
        <div className="mt-4 p-4 bg-white rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Feed Status</h3>
          {/* Show loading message */}
          {isLoading && <p className="text-gray-500">Loading subway status...</p>}

          {/* Show error message if fetch failed */}
          {error && <p className="text-red-600">Error fetching status: {error}</p>}

          {/* Show data if loading is finished and there is no error */}
          {subwayStatus && !isLoading && !error && (
            <div>
              <p>
                <span className="font-medium">Feed Requested:</span> {subwayStatus.feed_id_requested}
              </p>
              <p>
                <span className="font-medium">Feed Timestamp:</span> {
                  /* Convert Unix timestamp to readable date/time */
                  new Date(subwayStatus.feed_timestamp * 1000).toLocaleString()
                }
              </p>
              <p>
                <span className="font-medium">Updates Processed:</span> {subwayStatus.trip_updates_processed}
              </p>
              <p>
                <span className="font-medium">Alerts Processed:</span> {subwayStatus.alerts_processed}
              </p>
              {/* You could add more details here if needed */}
            </div>
          )}
           {/* Handle case where backend returned an error message */}
           {subwayStatus && subwayStatus.error && (
             <p className="text-red-600">Backend error: {subwayStatus.error}</p>
           )}
        </div>
        {/* ----------------------------- */}

      </main>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
        <p>&copy; {new Date().getFullYear()} NYC Transit Hub</p>
      </footer>
    </div>
  );
}

export default App;