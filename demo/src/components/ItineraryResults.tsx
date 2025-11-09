import type { ScheduledJourney } from '../../../src/graph-builder';
import type { Route } from '../gtfs.worker';

interface ItineraryResultsProps {
  journeys: ScheduledJourney[];
  routes: Route[];
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

function getRouteInfo(routeShortName: string, routes: Route[]) {
  const route = routes.find(r => r.route_short_name === routeShortName);
  if (!route) {
    return { backgroundColor: '#666666', textColor: '#FFFFFF' };
  }

  return {
    backgroundColor: route.route_color ? `#${route.route_color}` : '#666666',
    textColor: route.route_text_color ? `#${route.route_text_color}` : '#FFFFFF'
  };
}

export function ItineraryResults({ journeys, routes }: ItineraryResultsProps) {
  if (journeys.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 text-center">
          No itineraries found. Try different stops or times.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">
        Found {journeys.length} {journeys.length === 1 ? 'itinerary' : 'itineraries'}
      </h2>

      {journeys.map((journey, journeyIdx) => (
        <div key={journeyIdx} className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Journey Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-2xl font-bold">
                  {formatTime(journey.departureTime)} → {formatTime(journey.arrivalTime)}
                </div>
                <div className="text-blue-100 text-sm">
                  Duration: {formatDuration(journey.totalDuration)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-100">
                  {journey.legs.length} {journey.legs.length === 1 ? 'leg' : 'legs'}
                </div>
                {journey.legs.length > 1 && (
                  <div className="text-sm text-blue-100">
                    {journey.legs.length - 1} {journey.legs.length === 2 ? 'transfer' : 'transfers'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Journey Legs */}
          <div className="p-6">
            {journey.legs.map((leg, legIdx) => {
              const routeInfo = getRouteInfo(leg.routeShortName, routes);

              return (
                <div key={legIdx}>
                  {legIdx > 0 && (
                    <div className="flex items-center my-4">
                      <div className="flex-1 border-t-2 border-dashed border-gray-300"></div>
                      <div className="px-4 text-sm font-medium text-gray-500">
                        Transfer
                      </div>
                      <div className="flex-1 border-t-2 border-dashed border-gray-300"></div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    {/* Route Badge */}
                    <div className="flex-shrink-0">
                      <div
                        className="w-16 h-16 rounded-lg flex items-center justify-center font-bold text-lg shadow-md"
                        style={{
                          backgroundColor: routeInfo.backgroundColor,
                          color: routeInfo.textColor
                        }}
                      >
                        {leg.routeShortName}
                      </div>
                    </div>

                    {/* Leg Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                          style={{
                            backgroundColor: routeInfo.backgroundColor,
                            color: routeInfo.textColor
                          }}
                        >
                          {leg.tripShortName || leg.tripId}
                        </div>
                      </div>

                      {/* Departure */}
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 w-16 font-bold text-gray-700">
                          {formatTime(leg.departureTime)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{leg.startStop}</div>
                        </div>
                      </div>

                      {/* Travel Time */}
                      <div className="flex items-center gap-3 mb-2 ml-16">
                        <div className="h-8 w-0.5 bg-gray-300"></div>
                        <div className="text-sm text-gray-500">
                          {formatDuration(leg.arrivalTime - leg.departureTime)}
                        </div>
                      </div>

                      {/* Arrival */}
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-16 font-bold text-gray-700">
                          {formatTime(leg.arrivalTime)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{leg.endStop}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
