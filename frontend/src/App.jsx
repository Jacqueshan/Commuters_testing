// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import MapDisplay from './components/MapDisplay';
import ServiceStatusDashboard from './components/ServiceStatusDashboard';
import AuthPage from './components/auth/AuthPage'; // Import the AuthPage
import { auth } from './firebaseConfig'; // Import auth instance
import { onAuthStateChanged, signOut } from "firebase/auth"; // Import listener and signOut
import { getIdToken } from "firebase/auth";

function App() {
  // State for MTA Data
  const [subwayStatus, setSubwayStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // For MTA data
  const [error, setError] = useState(null);       // For MTA data

  // State for Authentication
  const [currentUser, setCurrentUser] = useState(null); // Stores logged-in user object or null
  const [authLoading, setAuthLoading] = useState(true); // Tracks if Firebase is still checking auth state

  // --- useEffect Hook for Fetching MTA Data with Polling ---
  useEffect(() => {
    const fetchSubwayStatus = async () => {
      // Only set loading true initially, perhaps not on subsequent polls?
      // Or maybe track MTA loading state separately from initial auth loading
      // Let's keep original logic for now: sets loading true on each fetch
      setIsLoading(true);
      // setError(null); // Clear previous MTA errors? Maybe not on polls.

      try {
        const response = await fetch('http://127.0.0.1:5000/api/subway/status');
        if (!response.ok) {
          // Handle non-2xx responses specifically if needed
          const errorData = await response.text(); // Try to get error text
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText} - ${errorData}`);
        }
        const data = await response.json();
        setSubwayStatus(data);
        setError(null); // Clear error on successful fetch
      } catch (err) {
        console.error("Fetch error:", err.message);
        setError(err.message); // Set MTA fetch error state
      } finally {
        setIsLoading(false); // Finished MTA fetch attempt
      }
    };

    // Fetch immediately on mount only if user is logged in (or fetch always?)
    // Let's fetch always for now, can refine later
    fetchSubwayStatus();

    // Set up polling interval
    const intervalId = setInterval(fetchSubwayStatus, 60000); // Poll every 60 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
      console.log("Cleared subway status polling interval.");
    };
  }, []); // Empty dependency array: run polling setup once on mount

  // --- useEffect for Firebase Auth State Listener ---
  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. User:", user ? user.uid : null);
      setCurrentUser(user); // Update currentUser state (will be null if logged out)
      setAuthLoading(false); // Auth check is complete
    });

    // Cleanup: Unsubscribe from the listener when the component unmounts
    return () => {
      console.log("Unsubscribing from auth state changes.");
      unsubscribe();
    };
  }, []); // Empty dependency array: run listener setup once on mount

  // --- Handle Logout Function ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Sign-out successful. onAuthStateChanged listener above will set currentUser to null
      console.log("User signed out successfully via button.");
      // Clear subway status? Optional, maybe user wants to see last known status briefly
      // setSubwayStatus(null);
    } catch (err) {
      console.error("Logout error:", err);
      // Optionally: display error message to user
      // setError("Failed to log out. Please try again.");
    }
  };
  
  // --- Function to Test Protected Route ---
  const fetchUserProfile = async () => {
    if (!currentUser) {
        console.log("Not logged in, cannot fetch profile.");
        return;
    }

    console.log("Attempting to fetch user profile...");
    try {
        // Get the Firebase ID token
        const token = await getIdToken(currentUser); // Pass the currentUser object

        // Make the fetch request with the Authorization header
        const response = await fetch('http://127.0.0.1:5000/api/user/profile', {
            method: 'GET', // Explicitly state method (optional for GET)
            headers: {
                'Authorization': `Bearer ${token}` // Include the token here
            }
        });

        const data = await response.json(); // Always try to parse JSON

        if (!response.ok) {
           // Handle HTTP errors (like 401 Unauthorized from our decorator)
           console.error(`Error fetching profile: ${response.status}`, data.message || 'Unknown error');
           alert(`Error fetching profile: ${data.message || response.statusText}`); // Show error to user
        } else {
           // Success! Display the protected data
           console.log("Protected profile data:", data);
           alert(`Successfully fetched profile! Your UID is: ${data.user_uid}`); // Show success
        }

    } catch (err) {
        console.error("Error getting ID token or fetching profile:", err);
        alert("An error occurred while fetching profile.");
    }
};
// ---------------------------------------

  // --- Component Return (Main Layout) ---
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header Section */}
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold">NYC Transit Hub</h1>
        {/* Auth Status Area */}
        <div>
          {authLoading ? (
            <span className="text-sm italic">Loading User...</span>
          ) : currentUser ? (
            // Logged In View - ADDED TEST BUTTON HERE
            <div className="flex items-center space-x-2">
               <span className="text-sm">Welcome, {currentUser.email || 'User'}!</span>
               {/* Test Button to call protected backend route */}
               <button
                  onClick={fetchUserProfile} // Make sure fetchUserProfile function exists above
                  className="bg-yellow-500 hover:bg-yellow-600 text-black py-1 px-3 rounded text-sm transition duration-150 ease-in-out"
                >
                  Test Profile Fetch
               </button>
               <button
                  onClick={handleLogout} // Make sure handleLogout function exists above
                  className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm transition duration-150 ease-in-out"
               >
                 Logout
               </button>
            </div>
          ) : (
            // Logged Out View
             <span className="text-sm italic">Please Login or Sign Up</span>
          )}
        </div>
      </header>

      {/* Main Content Area: Show AuthPage or App Content */}
      <main className="flex-grow container mx-auto p-4">
        {authLoading ? (
          // Show global loading indicator while checking auth
          <p className="text-center text-gray-500 mt-10">Checking authentication status...</p>
        ) : currentUser ? (
          // --- Logged-in User View ---
          // Render the main application components
          <>
            <div className="mb-4">
              <ServiceStatusDashboard
                alerts={subwayStatus?.alerts ?? []}
                isLoading={isLoading} // Use MTA loading state
                error={error}       // Use MTA error state
              />
            </div>
            <h2 className="text-xl mb-4">Real-time Transit Map</h2>
            <MapDisplay tripUpdates={subwayStatus?.trip_updates} />
            <div className="mt-4 p-4 bg-white rounded shadow">
              <h3 className="text-lg font-semibold mb-2">Feed Status (Feed ID: {subwayStatus?.feed_id_requested ?? 'N/A'})</h3>
               {/* Loading/Error specifically for MTA data */}
               {isLoading && <p className="text-gray-500">Loading subway status...</p>}
               {error && <p className="text-red-600">Error fetching status: {error}</p>}
               {/* Display Feed Summary Info */}
               {subwayStatus && !isLoading && !error && !subwayStatus.error && (
                 <div className="mb-4 pb-4 border-b">
                    <p>
                     <span className="font-medium">Feed Timestamp:</span> {
                       subwayStatus.feed_timestamp ?
                       new Date(subwayStatus.feed_timestamp * 1000).toLocaleString() : 'N/A'
                     } ({subwayStatus.trip_updates?.length ?? 0} updates, {subwayStatus.alerts?.length ?? 0} alerts)
                   </p>
                 </div>
               )}
               {/* Display Some Trip Updates */}
               {subwayStatus && subwayStatus.trip_updates && subwayStatus.trip_updates.length > 0 && !isLoading && !error && (
                  <div className="mb-4 pb-4 border-b">
                     <h4 className="font-semibold mb-1">Upcoming Trips (Sample):</h4>
                     <ul className="list-disc list-inside text-sm space-y-1">
                         {subwayStatus.trip_updates.slice(0, 5).map((update, index) => (
                            <li key={update.trip_id || index}>
                              Route <span className="font-bold">{update.route_id || 'N/A'}</span>
                              {update.first_future_stop ?
                                ` approaching Stop ${update.first_future_stop.stop_name || update.first_future_stop.stop_id} around ${new Date(update.first_future_stop.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                                :
                                ' (No future stop info)'}
                            </li>
                         ))}
                     </ul>
                     {subwayStatus.trip_updates.length > 5 && <p className="text-xs italic mt-1">...and more.</p>}
                  </div>
               )}
               {/* Handle Backend Error in subwayStatus */}
               {subwayStatus && subwayStatus.error && (
                 <p className="text-red-600">Backend error: {subwayStatus.error}</p>
               )}
               {/* Handle No Updates/Alerts case */}
               {subwayStatus && !isLoading && !error && !subwayStatus.error && (!subwayStatus.trip_updates || subwayStatus.trip_updates.length === 0) && (!subwayStatus.alerts || subwayStatus.alerts.length === 0) && (
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