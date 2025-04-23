    // frontend/src/components/AccessibilityInfo.jsx
    import React from 'react';

    function AccessibilityInfo({ outages, isLoading, error }) {

      // Helper to format date/time nicely
      const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
          const tsNumber = Number(timestamp);
          // Handle potential date strings directly from API too
          const date = new Date(isNaN(tsNumber) ? timestamp : (tsNumber > 10000000000 ? tsNumber : tsNumber * 1000));
          if (isNaN(date.getTime())) { return timestamp; }
          return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) {
          return timestamp; // Return original if parsing fails
        }
      };

      // Handle Loading State
      if (isLoading) {
        return (
          <div className="p-4 border rounded bg-gray-50 text-gray-500 italic">
            Loading accessibility status...
          </div>
        );
      }

      // Handle Fetch Error State (Error during fetch from frontend to backend)
      if (error) {
        return (
          <div className="p-4 border rounded bg-red-50 text-red-700">
            Error loading accessibility status: {error}
          </div>
        );
      }

      // --- SIMPLIFIED: Handle Backend Error or Invalid Data Structure ---
      let outageList = null;

      // Check 1: Did the backend itself return an error object?
      if (outages && typeof outages === 'object' && !Array.isArray(outages) && outages.error) {
         return (
             <div className="p-4 border rounded bg-yellow-50 text-yellow-700">
               Accessibility status unavailable: {outages.error}
             </div>
           );
      }

      // Check 2: Is the received data directly an array? (Primary expectation)
      if (Array.isArray(outages)) {
          outageList = outages;
      }

      // If we still don't have a valid list after checking for array and error
      if (!outageList) {
           // Log the received data structure for debugging
           console.warn("Accessibility data received in unexpected format:", outages);
           return (
             <div className="p-4 border rounded bg-yellow-50 text-yellow-700">
               Accessibility status received in an unexpected format. Please check console.
             </div>
           );
      }
      // --------------------------------------------------------------

      // Handle Case with No Outages
      if (outageList.length === 0) {
        return (
          <div className="p-4 border rounded bg-green-50 text-green-700">
            No current elevator or escalator outages reported.
          </div>
        );
      }

      // Display Outages
      return (
        <div className="p-4 border rounded border-blue-300 bg-blue-50 max-h-60 overflow-y-auto"> {/* Added max height and scroll */}
          <h4 className="font-semibold mb-2 text-blue-800">Elevator/Escalator Outages ({outageList.length}):</h4> {/* Show count */}
          <ul className="list-none text-sm space-y-2">
            {outageList.map((outage, index) => (
              // Use equipment ID if available and seems unique, otherwise index
              <li key={outage.equipment || `outage-${index}`} className="border-b pb-1 last:border-b-0">
                 <p>
                    <strong className="font-medium">{outage.equipmenttype || 'Equipment'}</strong> at{' '}
                    <strong className="font-medium">{outage.station || 'Unknown Station'}</strong>{' '}
                    ({outage.serving || 'N/A'})
                    {outage.equipment && <span className="text-xs text-gray-600 ml-1">(#{outage.equipment})</span>}
                 </p>
                 <p className="text-xs text-gray-700">
                    Reason: {outage.reason || 'N/A'} | Est. Return: {formatTimestamp(outage.estimatedreturntoservice)}
                 </p>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    AccessibilityInfo.defaultProps = {
        outages: null,
        isLoading: true,
        error: null,
    };

    export default AccessibilityInfo;
    