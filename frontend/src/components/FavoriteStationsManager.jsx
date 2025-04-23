    // frontend/src/components/FavoriteStationsManager.jsx
    import React, { useState, useEffect, useCallback } from 'react';
    import { getIdToken } from "firebase/auth";

    function FavoriteStationsManager({ currentUser }) {
      const [favoriteStations, setFavoriteStations] = useState([]);
      const [newFavoriteStation, setNewFavoriteStation] = useState('');
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState(null);
      const [addError, setAddError] = useState(null);
      const [removeError, setRemoveError] = useState(null);

      // Function to fetch favorite stations
      const fetchFavoriteStations = useCallback(async () => {
        if (!currentUser) return;

        setIsLoading(true);
        setError(null);
        setRemoveError(null);
        console.log("Fetching favorite stations...");

        try {
          const token = await getIdToken(currentUser);
          const response = await fetch('http://127.0.0.1:5000/api/user/favorites/stations', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) {}
            throw new Error(errorMsg);
          }

          const data = await response.json();
          setFavoriteStations(Array.isArray(data.favorite_stations) ? data.favorite_stations.sort() : []);
          console.log("Fetched favorite stations:", data.favorite_stations);

        } catch (err) {
          console.error("Error fetching favorite stations:", err);
          setError(err.message || "Failed to load favorite stations.");
        } finally {
          setIsLoading(false);
        }
      }, [currentUser]);

      // useEffect to fetch stations on mount/user change
      useEffect(() => {
        if (currentUser) {
            fetchFavoriteStations();
        } else {
            setFavoriteStations([]);
            setError(null);
            setIsLoading(false);
        }
      }, [currentUser, fetchFavoriteStations]);

      // Function to handle adding a new favorite station
      const handleAddFavoriteStation = async (e) => {
        e.preventDefault();
        if (!currentUser || !newFavoriteStation.trim()) return;

        setAddError(null);
        setRemoveError(null);
        const stationToAdd = newFavoriteStation.trim(); // Keep original case? Or upper? Let's keep original for now.

        // Optional frontend check for duplicates
        if (favoriteStations.includes(stationToAdd)) {
            setAddError(`Station ID '${stationToAdd}' is already a favorite.`);
            return;
        }

        try {
          const token = await getIdToken(currentUser);
          const response = await fetch('http://127.0.0.1:5000/api/user/favorites/stations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ station_id: stationToAdd }) // Send station_id
          });

          const data = await response.json();

          if (!response.ok) {
             if (response.status === 409) { setAddError(data.message || "Station already favorited."); }
             else { throw new Error(data.message || `HTTP error ${response.status}`); }
          } else {
             console.log("Added favorite station:", data.favorite);
             setFavoriteStations(prevStations => [...prevStations, data.favorite.station_id].sort());
             setNewFavoriteStation('');
          }

        } catch (err) {
          console.error("Error adding favorite station:", err);
          setAddError(err.message || "Failed to add favorite station.");
        }
      };

      // Function to handle removing a favorite station
      const handleRemoveFavoriteStation = async (stationIdToRemove) => {
        if (!currentUser) return;

        setRemoveError(null);
        setAddError(null);
        console.log(`Attempting to remove favorite station: ${stationIdToRemove}`);

        try {
          const token = await getIdToken(currentUser);
          const response = await fetch(`http://127.0.0.1:5000/api/user/favorites/stations/${stationIdToRemove}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
             let errorMsg = `HTTP error ${response.status}`;
             try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) {}
             throw new Error(errorMsg);
          }

          console.log(`Successfully removed favorite station: ${stationIdToRemove}`);
          setFavoriteStations(prevStations => prevStations.filter(stationId => stationId !== stationIdToRemove));

        } catch (err) {
          console.error("Error removing favorite station:", err);
          setRemoveError(err.message || "Failed to remove favorite station.");
        }
      };

      // --- Render Logic ---
      return (
        <div className="mt-6 p-4 bg-white rounded shadow">
          <h3 className="text-lg font-semibold mb-3">My Favorite Stations</h3>

          {isLoading && <p className="text-gray-500 italic">Loading favorite stations...</p>}
          {error && <p className="text-red-600">Error loading stations: {error}</p>}
          {removeError && <p className="text-red-600 text-sm mt-2">Remove error: {removeError}</p>}

          {!isLoading && !error && favoriteStations.length > 0 && (
            <ul className="list-none mb-4 space-y-2">
              {favoriteStations.map(stationId => (
                <li key={stationId} className="flex justify-between items-center border-b pb-1">
                  <span>
                    Station ID: <span className="font-mono bg-gray-200 px-2 py-0.5 rounded">{stationId}</span>
                    {/* TODO: Look up station name from static data if available */}
                  </span>
                  <button
                    onClick={() => handleRemoveFavoriteStation(stationId)}
                    className="ml-4 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                    aria-label={`Remove favorite station ${stationId}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && !error && favoriteStations.length === 0 && (
            <p className="text-gray-600 mb-4 italic">You haven't added any favorite stations yet.</p>
          )}

          {/* Add Favorite Station Form */}
          <form onSubmit={handleAddFavoriteStation} className="flex items-center space-x-2">
            <input
              type="text"
              value={newFavoriteStation}
              onChange={(e) => setNewFavoriteStation(e.target.value)}
              placeholder="Add Station ID (e.g., 123)"
              className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
              maxLength="10" // Match backend validation roughly
              required
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline whitespace-nowrap transition duration-150 ease-in-out"
            >
              Add Favorite
            </button>
          </form>
          {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}

        </div>
      );
    }

    FavoriteStationsManager.defaultProps = {
        currentUser: null,
    };

    export default FavoriteStationsManager;
    