// frontend/src/components/FavoriteRoutesManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getIdToken } from "firebase/auth";

function FavoriteRoutesManager({ currentUser }) {
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [newFavoriteRoute, setNewFavoriteRoute] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addError, setAddError] = useState(null);
  const [removeError, setRemoveError] = useState(null); // State for remove errors

  // Function to fetch favorites (memoized with useCallback)
  const fetchFavorites = useCallback(async () => {
    if (!currentUser) return; // Don't fetch if not logged in

    setIsLoading(true);
    setError(null);
    setRemoveError(null); // Clear remove errors on fetch
    console.log("Fetching favorite routes...");

    try {
      const token = await getIdToken(currentUser);
      const response = await fetch('http://127.0.0.1:5000/api/user/favorites/routes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Try to parse error message from backend
        let errorMsg = `HTTP error ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
        } catch (parseError) {
            // Ignore if response body isn't JSON
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      // Ensure data is an array before setting state
      setFavoriteRoutes(Array.isArray(data.favorite_routes) ? data.favorite_routes.sort() : []);
      console.log("Fetched favorites:", data.favorite_routes);

    } catch (err) {
      console.error("Error fetching favorites:", err);
      setError(err.message || "Failed to load favorites.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]); // Dependency: re-run if currentUser changes

  // useEffect to fetch favorites when the component mounts or user changes
  useEffect(() => {
    if (currentUser) { // Only fetch if user is logged in
        fetchFavorites();
    } else {
        // Clear favorites if user logs out
        setFavoriteRoutes([]);
        setError(null);
        setIsLoading(false);
    }
  }, [currentUser, fetchFavorites]); // Dependencies: currentUser and fetchFavorites function

  // Function to handle adding a new favorite
  const handleAddFavorite = async (e) => {
    e.preventDefault(); // Prevent form submission page reload
    if (!currentUser || !newFavoriteRoute.trim()) return; // Need user and input

    setAddError(null); // Clear previous add errors
    setRemoveError(null); // Clear remove errors
    const routeToAdd = newFavoriteRoute.trim().toUpperCase(); // Normalize input

    // Basic frontend validation (optional, backend also validates)
    if (favoriteRoutes.includes(routeToAdd)) {
        setAddError(`Route '${routeToAdd}' is already a favorite.`);
        return;
    }

    try {
      const token = await getIdToken(currentUser);
      const response = await fetch('http://127.0.0.1:5000/api/user/favorites/routes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' // Specify JSON body
        },
        body: JSON.stringify({ route_id: routeToAdd }) // Send route_id in body
      });

      const data = await response.json(); // Always try to parse response

      if (!response.ok) {
         // Handle specific errors like 409 Conflict (already exists)
         if (response.status === 409) {
             setAddError(data.message || "Route already favorited.");
         } else {
             throw new Error(data.message || `HTTP error ${response.status}`);
         }
      } else {
         // Success! Add to local state and clear input
         console.log("Added favorite:", data.favorite);
         // Update state immutably and sort
         setFavoriteRoutes(prevRoutes => [...prevRoutes, data.favorite.route_id].sort());
         setNewFavoriteRoute(''); // Clear the input field
      }

    } catch (err) {
      console.error("Error adding favorite:", err);
      setAddError(err.message || "Failed to add favorite.");
    }
  };

  // Function to handle removing a favorite
  const handleRemoveFavorite = async (routeIdToRemove) => {
    if (!currentUser) return;

    setRemoveError(null); // Clear previous remove errors
    setAddError(null); // Clear add errors
    console.log(`Attempting to remove favorite route: ${routeIdToRemove}`);

    try {
      const token = await getIdToken(currentUser);
      const response = await fetch(`http://127.0.0.1:5000/api/user/favorites/routes/${routeIdToRemove}`, {
        method: 'DELETE', // Use DELETE method
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Check status code directly for success (200 or 204 common for DELETE)
      if (!response.ok) {
         let errorMsg = `HTTP error ${response.status}`;
         try {
             const errorData = await response.json();
             errorMsg = errorData.message || errorMsg;
         } catch (parseError) { /* Ignore */ }
         throw new Error(errorMsg);
      }

      // Success! Remove from local state
      console.log(`Successfully removed favorite: ${routeIdToRemove}`);
      // Update state immutably by filtering out the removed route
      setFavoriteRoutes(prevRoutes => prevRoutes.filter(routeId => routeId !== routeIdToRemove));

    } catch (err) {
      console.error("Error removing favorite:", err);
      setRemoveError(err.message || "Failed to remove favorite.");
    }
  };
  // ----------------------------------------------------

  // --- Render Logic ---
  return (
    <div className="mt-6 p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold mb-3">My Favorite Routes</h3>

      {/* Loading State */}
      {isLoading && <p className="text-gray-500 italic">Loading favorites...</p>}

      {/* Fetch Error State */}
      {error && <p className="text-red-600">Error loading favorites: {error}</p>}

      {/* Remove Error State */}
      {removeError && <p className="text-red-600 text-sm mt-2">Remove error: {removeError}</p>}

      {/* Display Favorites List */}
      {!isLoading && !error && favoriteRoutes.length > 0 && (
        <ul className="list-none mb-4 space-y-2"> {/* Changed to list-none */}
          {favoriteRoutes.map(routeId => ( // Already sorted when fetched/added
            <li key={routeId} className="flex justify-between items-center border-b pb-1">
              <span> {/* Wrap text in span */}
                Route <span className="font-bold bg-gray-200 px-2 py-0.5 rounded">{routeId}</span>
              </span>
              {/* --- ADDED REMOVE BUTTON --- */}
              <button
                onClick={() => handleRemoveFavorite(routeId)} // Call handler with routeId
                className="ml-4 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                aria-label={`Remove favorite route ${routeId}`}
              >
                Remove
              </button>
              {/* ------------------------- */}
            </li>
          ))}
        </ul>
      )}

      {/* No Favorites Message */}
      {!isLoading && !error && favoriteRoutes.length === 0 && (
        <p className="text-gray-600 mb-4 italic">You haven't added any favorite routes yet.</p>
      )}

      {/* Add Favorite Form */}
      <form onSubmit={handleAddFavorite} className="flex items-center space-x-2">
         <input
              type="text"
              value={newFavoriteRoute}
              onChange={(e) => setNewFavoriteRoute(e.target.value)}
              placeholder="Add Route (e.g., L, 1, A)"
              className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300"
              maxLength="10"
              required
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline whitespace-nowrap transition duration-150 ease-in-out"
            >
              Add Favorite
            </button>
      </form>
      {/* Add Error Display */}
      {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}

    </div>
  );
}

// Default props for safety
FavoriteRoutesManager.defaultProps = {
    currentUser: null, // Expect currentUser prop
};

export default FavoriteRoutesManager;
