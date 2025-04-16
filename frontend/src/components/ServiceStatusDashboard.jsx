// frontend/src/components/ServiceStatusDashboard.jsx
import React from 'react';

function ServiceStatusDashboard({ alerts, isLoading, error }) {

  // Handle loading state
  if (isLoading) {
    return (
      <div className="p-4 border rounded bg-gray-50 text-gray-500 italic">
        Loading service status...
      </div>
    );
  }

  // Handle fetch error state
  if (error) {
    return (
      <div className="p-4 border rounded bg-red-50 text-red-700">
        Error loading service status: {error}
      </div>
    );
  }

  // Handle state where alerts data might not be available yet or backend error
  if (!alerts || alerts.error) {
      return (
         <div className="p-4 border rounded bg-yellow-50 text-yellow-700">
           Service status currently unavailable. {alerts?.error}
         </div>
       );
  }

  // Handle case with no active alerts
  if (alerts.length === 0) {
    return (
      <div className="p-4 border rounded bg-green-50 text-green-700">
        No active service alerts reported in this feed. Services appear to be running normally.
      </div>
    );
  }

  // Display active alerts
  return (
    <div className="p-4 border rounded border-orange-300 bg-orange-50">
      <h4 className="font-semibold mb-2 text-orange-800">Active Service Alerts:</h4>
      <ul className="list-disc list-inside text-sm space-y-2">
        {alerts.map((alert, index) => (
          <li key={index} className="text-orange-900">
            <strong className="font-medium">{alert.header}</strong>: {alert.description}
            {/* Optionally display affected routes/stops if needed */}
            {/* {alert.informed_entities && alert.informed_entities.length > 0 && (
              <span className="text-xs italic ml-2">
                (Affects: {alert.informed_entities.map(ie => ie.route_id || ie.stop_id).join(', ')})
              </span>
            )} */}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Default props for safety
ServiceStatusDashboard.defaultProps = {
    alerts: null, // Start as null to differentiate from empty array
    isLoading: true,
    error: null,
};

export default ServiceStatusDashboard;