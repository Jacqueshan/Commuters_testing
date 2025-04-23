// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import MapDisplay from './components/MapDisplay';
import ServiceStatusDashboard from './components/ServiceStatusDashboard';
import AuthPage from './components/auth/AuthPage';
import FavoriteRoutesManager from './components/FavoriteRoutesManager';
import FavoriteStationsManager from './components/FavoriteStationsManager';
import AccessibilityInfo from './components/AccessibilityInfo'; // Import AccessibilityInfo
import { auth } from './firebaseConfig';
import { onAuthStateChanged, signOut, getIdToken } from "firebase/auth"; // Keep getIdToken

function App() {
  // --- State ---
  // MTA Status Data (Trip Updates, Alerts)
  const [subwayStatus, setSubwayStatus] = useState(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true); // Loading state for subway status
  const [statusError, setStatusError] = useState(null);       // Error state for subway status
  // Accessibility Data (Elevator/Escalator Outages)
  const [accessData, setAccessData] = useState(null);
  const [isAccessLoading, setIsAccessLoading] = useState(true); // Loading state for accessibility
  const [accessError, setAccessError] = useState(null);       // Error state for accessibility
  // Authentication
  const [currentUser, setCurrentUser] = useState(null); // Stores logged-in user object or null
  const [authLoading, setAuthLoading] = useState(true); // Tracks if Firebase is still checking auth state
  // --- End State ---


  // --- useEffect Hook for Fetching MTA Status Data with Polling ---
  useEffect(() => {
    const fetchSubwayStatus = async () => {
      setIsStatusLoading(true); // Indicate loading MTA status data
      // Don't clear previous error here, clear only on success
      try {
        // Fetch subway status data from the backend API
        const response = await fetch('http://127.0.0.1:5000/api/subway/status'); // Defaulting to feed '1'
        if (!response.ok) {
          const errorData = await response.text(); // Try to get error text from response
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText} - ${errorData}`);
        }
        const data = await response.json();
        setSubwayStatus(data); // Update state with fetched data
        setStatusError(null); // Clear status error on successful fetch
      } catch (err) {
        console.error("Fetch subway status error:", err.message);
        setStatusError(err.message); // Set status error state
      } finally {
        setIsStatusLoading(false); // Finished fetching status data (success or fail)
      }
    };

    fetchSubwayStatus(); // Fetch immediately when component mounts
    // Set up polling: fetch status data every 60 seconds
    const intervalId = setInterval(fetchSubwayStatus, 60000);
    // Cleanup function: clear the interval when the component unmounts
    return () => {
      clearInterval(intervalId);
      console.log("Cleared subway status polling interval.");
    };
  }, []); // Empty dependency array means this effect runs only once on mount

  // --- useEffect for Fetching Accessibility Data ---
  useEffect(() => {
    const fetchAccessData = async () => {
      setIsAccessLoading(true); // Indicate loading accessibility data
      setAccessError(null);     // Clear previous accessibility errors
      console.log("Fetching accessibility outages...");
      try {
        // Fetch accessibility outage data from the backend API
        const response = await fetch('http://127.0.0.1:5000/api/accessibility/outages');
        if (!response.ok) {
          const errorData = await response.text(); // Try to get error text
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText} - ${errorData}`);
        }
        const data = await response.json();
        setAccessData(data); // Store the fetched outage data in state
        console.log("Fetched accessibility data:", data);
      } catch (err) {
        console.error("Fetch accessibility error:", err.message);
        setAccessError(err.message); // Set accessibility error state
      } finally {
        setIsAccessLoading(false); // Finished fetching accessibility data
      }
    };
    fetchAccessData(); // Fetch accessibility data once when component mounts
    // No polling is set up for accessibility data currently
  }, []); // Empty dependency array means this effect runs only once on mount
  // --------------------------------------------------

  // --- useEffect for Firebase Auth State Listener ---
  useEffect(() => {
    // onAuthStateChanged listens for changes in the user's login state
    // It returns an unsubscribe function to clean up the listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. User:", user ? user.uid : null);
      setCurrentUser(user); // Update state with the user object (or null if logged out)
      setAuthLoading(false); // Indicate that the initial auth check is complete
    });
    // Cleanup function: Unsubscribe from the listener when the component unmounts
    return () => {
      console.log("Unsubscribing from auth state changes.");
      unsubscribe();
    };
  }, []); // Empty dependency array means this effect runs only once on mount

  // --- Handle Logout Function ---
  const handleLogout = async () => {
    try {
      // Use Firebase SDK to sign the user out
      await signOut(auth);
      console.log("User signed out successfully via button.");
      // Optionally reset other states on logout if desired
      // setSubwayStatus(null);
      // setAccessData(null);
    } catch (err) {
      console.error("Logout error:", err);
      // Optionally display a logout error message to the user
    }
  };
  // ---------------------

  // --- Component Return (Main Layout & Conditional Rendering) ---
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 font-sans"> {/* Added default font */}
      {/* Header Section */}
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10"> {/* Made header sticky */}
         <h1 className="text-xl sm:text-2xl font-bold">NYC Transit Hub</h1>
          {/* Authentication Status Display */}
          <div>
            {authLoading ? (
              // Show loading indicator while checking auth
              <span className="text-sm italic">Loading User...</span>
             ) : currentUser ? (
              // Show welcome message and logout button if user is logged in
              <div className="flex items-center space-x-2">
                 <span className="text-sm hidden sm:inline">Welcome, {currentUser.email || 'User'}!</span> {/* Hide email on very small screens */}
                 <button
                    onClick={handleLogout} // Attach logout handler
                    className="bg-red-500 hover:bg-red-700 text-white py-1 px-3 rounded text-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-300"
                 >
                   Logout
                 </button>
              </div>
            ) : (
              // Show placeholder text if user is logged out (Login/Sign Up handled by AuthPage)
              <span className="text-sm italic">Please Login or Sign Up</span>
            )}
          </div>
      </header>

      {/* Main Content Area: Conditionally renders AuthPage or main app content */}
      <main className="flex-grow container mx-auto p-4 w-full max-w-7xl"> {/* Constrained width */}
        {authLoading ? (
          // Show loading indicator while initial auth check is happening
          <p className="text-center text-gray-500 mt-10 text-lg">Checking authentication status...</p>
        ) : currentUser ? (
          // --- Logged-in User View ---
          // Render the main application components when user is logged in
          <>
            {/* Grid for Status and Accessibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"> {/* Increased bottom margin */}
                {/* Service Status Dashboard (Alerts) */}
                <ServiceStatusDashboard
                    alerts={subwayStatus?.alerts ?? []} // Pass alerts data safely
                    isLoading={isStatusLoading}        // Pass status loading state
                    error={statusError}              // Pass status error state
                />
                {/* Accessibility Info (Outages) */}
                <AccessibilityInfo
                    outages={accessData}             // Pass accessibility data
                    isLoading={isAccessLoading}      // Pass accessibility loading state
                    error={accessError}              // Pass accessibility error state
                />
            </div>

            {/* Map Section */}
            <h2 className="text-xl font-semibold mb-3">Real-time Transit Map</h2>
            <div className="mb-6"> {/* Added margin-bottom */}
                <MapDisplay tripUpdates={subwayStatus?.trip_updates} />
            </div>

            {/* Favorites Management Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <FavoriteRoutesManager currentUser={currentUser} />
                <FavoriteStationsManager currentUser={currentUser} />
            </div>

             {/* Raw Feed Status Summary (Optional Display) */}
             {/* Consider removing or collapsing this section in final UI */}
            <div className="mt-4 p-4 bg-gray-200 rounded shadow text-xs">
              <h3 className="text-sm font-semibold mb-2">Feed Status Details (Feed ID: {subwayStatus?.feed_id_requested ?? 'N/A'})</h3>
               {/* Loading/Error specifically for MTA data */}
               {isStatusLoading && <p className="text-gray-500">Loading subway status...</p>}
               {statusError && <p className="text-red-600">Error fetching status: {statusError}</p>}
               {/* Display Feed Summary Info */}
               {subwayStatus && !isStatusLoading && !statusError && !subwayStatus.error && (
                 <div className="mb-2 pb-2 border-b border-gray-400">
                    <p>
                     <span className="font-medium">Feed Timestamp:</span> {
                       subwayStatus.feed_timestamp ?
                       new Date(subwayStatus.feed_timestamp * 1000).toLocaleString() : 'N/A'
                     } ({subwayStatus.trip_updates?.length ?? 0} updates, {subwayStatus.alerts?.length ?? 0} alerts)
                   </p>
                 </div>
               )}
               {/* Display Some Trip Updates */}
               {subwayStatus && subwayStatus.trip_updates && subwayStatus.trip_updates.length > 0 && !isStatusLoading && !statusError && (
                  <div className="mb-2 pb-2 border-b border-gray-400">
                     <h4 className="font-semibold mb-1">Upcoming Trips (Sample):</h4>
                     <ul className="list-disc list-inside space-y-1">
                         {subwayStatus.trip_updates.slice(0, 3).map((update, index) => ( // Show fewer samples here
                            <li key={update.trip_id ? `${update.trip_id}-${index}` : `trip-${index}`}>
                              Route <span className="font-bold">{update.route_id || 'N/A'}</span>
                              {update.first_future_stop ?
                                ` -> ${update.first_future_stop.stop_name || update.first_future_stop.stop_id} @ ${new Date(update.first_future_stop.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                                :
                                ' (No future stop info)'}
                            </li>
                         ))}
                     </ul>
                     {subwayStatus.trip_updates.length > 3 && <p className="italic mt-1">...and more.</p>}
                  </div>
               )}
               {/* Handle Backend Error in subwayStatus */}
               {subwayStatus && subwayStatus.error && (
                 <p className="text-red-600">Backend error: {subwayStatus.error}</p>
               )}
               {/* Handle No Updates/Alerts case */}
               {subwayStatus && !isStatusLoading && !statusError && !subwayStatus.error && (!subwayStatus.trip_updates || subwayStatus.trip_updates.length === 0) && (!subwayStatus.alerts || subwayStatus.alerts.length === 0) && (
                 <p className="text-gray-600 italic">No active trip updates or alerts found in this feed currently.</p>
               )}
            </div>
          </>
          // --------------------------
        ) : (
          // --- Logged-out User View ---
          // Render the AuthPage component for Login/Sign Up
          <AuthPage />
          // --------------------------
        )}
      </main>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
        <p>&copy; {new Date().getFullYear()} NYC Transit Hub</p>
      </footer>
    </div>
  );
}

export default App;
