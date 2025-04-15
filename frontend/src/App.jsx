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
  // (We will display the fetched data below in the next step)
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
        {/* We'll add data display here in Step 6 */}
      </main>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
        <p>&copy; {new Date().getFullYear()} NYC Transit Hub</p> {/* Dynamic year */}
      </footer>
    </div>
  );
}

export default App;