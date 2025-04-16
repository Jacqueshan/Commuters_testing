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
    // Define the function to fetch data (same as before)
    const fetchSubwayStatus = async () => {
      // Don't set isLoading to true here if you want seamless updates,
      // only set it on the initial load maybe? Or handle it differently.
      // Let's keep it simple for now and set it each time.
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('http://127.0.0.1:5000/api/subway/status'); // Fetches feed '1'
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setSubwayStatus(data);
      } catch (err) {
        console.error("Fetch error:", err.message);
        setError(err.message);
        // Optional: Clear status on error? Or leave stale data?
        // setSubwayStatus(null);
      } finally {
        setIsLoading(false);
      }
    };

    // --- Polling Implementation ---
    // 1. Fetch data immediately when the component mounts
    fetchSubwayStatus();

    // 2. Set up an interval to fetch data periodically
    // Fetch every 60 seconds (60000 milliseconds). Adjust as needed.
    // Be mindful of MTA API rate limits on your backend if polling too frequently.
    const intervalId = setInterval(fetchSubwayStatus, 60000);

    // 3. Cleanup function: Clear the interval when the component unmounts
    // This is crucial to prevent memory leaks!
    return () => {
      clearInterval(intervalId);
      console.log("Cleared subway status polling interval.");
    };
    // --------------------------

  }, []); // Still use empty dependency array - the effect setup runs only once
  // -----------------------------------------

  // --- Component Return (Layout) ---
  // Replace the existing return statement in frontend/src/App.jsx with this:
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

        {/* --- Display Fetched Data (Updated) --- */}
        <div className="mt-4 p-4 bg-white rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Feed Status (Feed ID: {subwayStatus?.feed_id_requested ?? 'N/A'})</h3>

          {/* Loading Indicator */}
          {isLoading && <p className="text-gray-500">Loading subway status...</p>}

          {/* Fetch Error Indicator */}
          {error && <p className="text-red-600">Error fetching status: {error}</p>}

          {/* Display Feed Summary Info (if data exists, not loading, no fetch error, no backend error) */}
          {subwayStatus && !isLoading && !error && !subwayStatus.error && (
            <div className="mb-4 pb-4 border-b">
               <p>
                <span className="font-medium">Feed Timestamp:</span> {
                  subwayStatus.feed_timestamp ? // Check if timestamp exists
                  new Date(subwayStatus.feed_timestamp * 1000).toLocaleString() : 'N/A'
                } ({subwayStatus.trip_updates?.length ?? 0} updates, {subwayStatus.alerts?.length ?? 0} alerts)
              </p>
            </div>
          )}

          {/* Display Some Trip Updates (Example: First 5) */}
          {subwayStatus && subwayStatus.trip_updates && subwayStatus.trip_updates.length > 0 && !isLoading && !error && (
             <div className="mb-4 pb-4 border-b">
                <h4 className="font-semibold mb-1">Upcoming Trips (Sample):</h4>
                <ul className="list-disc list-inside text-sm space-y-1"> {/* Added space-y-1 for better spacing */}
                    {subwayStatus.trip_updates.slice(0, 5).map((update, index) => (
                       <li key={update.trip_id || index}> {/* Use trip_id if available, otherwise index */}
                         Route <span className="font-bold">{update.route_id || 'N/A'}</span>
                         {update.first_future_stop ?
                           ` approaching Stop ${update.first_future_stop.stop_id} around ${new Date(update.first_future_stop.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` // Format time only
                           :
                           ' (No future stop info)'}
                       </li>
                    ))}
                </ul>
                {subwayStatus.trip_updates.length > 5 && <p className="text-xs italic mt-1">...and more.</p>}
             </div>
          )}

          {/* Display Alerts (Example: First 2) */}
           {subwayStatus && subwayStatus.alerts && subwayStatus.alerts.length > 0 && !isLoading && !error && (
             <div>
                <h4 className="font-semibold mb-1 text-orange-700">Active Alerts (Sample):</h4>
                 <ul className="list-disc list-inside text-sm space-y-1"> {/* Added space-y-1 */}
                     {subwayStatus.alerts.slice(0, 2).map((alert, index) => (
                        <li key={index} className="mb-1">
                            <span className="font-bold">{alert.header}</span>: {alert.description}
                        </li>
                     ))}
                 </ul>
                 {subwayStatus.alerts.length > 2 && <p className="text-xs italic mt-1">...and more alerts.</p>}
             </div>
           )}

           {/* Handle case where backend returned an error message inside the data */}
           {subwayStatus && subwayStatus.error && (
             <p className="text-red-600">Backend error: {subwayStatus.error}</p>
           )}

           {/* Handle case where data loaded successfully but there were no updates/alerts */}
           {subwayStatus && !isLoading && !error && !subwayStatus.error && (!subwayStatus.trip_updates || subwayStatus.trip_updates.length === 0) && (!subwayStatus.alerts || subwayStatus.alerts.length === 0) && (
             <p className="text-gray-600 italic">No active trip updates or alerts found in this feed currently.</p>
           )}

        </div>
        {/* ----------------------------- */}

      </main>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
        {/* Updated year dynamically */}
        <p>&copy; {new Date().getFullYear()} NYC Transit Hub</p>
      </footer>
    </div>
  );
}

export default App;