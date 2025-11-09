import type { ScheduledJourney } from '../../../src/graph-builder';
import type { Route, Stop } from '../gtfs.worker';

interface ItineraryResultsProps {
  journeys: ScheduledJourney[];
  routes: Route[];
  stops: Stop[];
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

function getStopName(stopId: string, stops: Stop[]): string {
  const stop = stops.find(s => s.stop_id === stopId);
  return stop?.stop_name || stopId;
}

export function ItineraryResults({ journeys, routes, stops }: ItineraryResultsProps) {
  if (journeys.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 text-center">
          No itineraries found. Try different stops or times.
        </p>
      </div>
    );
  }

  // Sort journeys by arrival time (earliest first)
  const sortedJourneys = [...journeys].sort((a, b) => a.arrivalTime - b.arrivalTime);

  // Find minimum duration and minimum transfers
  const minDuration = Math.min(...sortedJourneys.map(j => j.totalDuration));
  const minTransfers = Math.min(...sortedJourneys.map(j => j.legs.length - 1));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">
        Found {sortedJourneys.length} {sortedJourneys.length === 1 ? 'itinerary' : 'itineraries'}
      </h2>

      {sortedJourneys.map((journey, journeyIdx) => {
        const isFastest = journey.totalDuration === minDuration;
        const hasMinTransfers = (journey.legs.length - 1) === minTransfers;

        return (
        <div key={journeyIdx} className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Journey Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-2xl font-bold">
                    {formatTime(journey.departureTime)} → {formatTime(journey.arrivalTime)}
                  </div>
                </div>
                <div className="text-blue-100 text-sm">
                  Duration: {formatDuration(journey.totalDuration)}
                </div>
                {/* Badges */}
                {(isFastest || hasMinTransfers) && (
                  <div className="flex gap-2 mt-2">
                    {isFastest && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        Fastest
                      </span>
                    )}
                    {hasMinTransfers && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                        </svg>
                        Fewest Transfers
                      </span>
                    )}
                  </div>
                )}
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

              // Calculate transfer time if not first leg
              const transferTime = legIdx > 0
                ? leg.departureTime - journey.legs[legIdx - 1].arrivalTime
                : 0;

              return (
                <div key={legIdx}>
                  {legIdx > 0 && (
                    <div className="flex items-center my-4">
                      <div className="flex-1 border-t-2 border-dashed border-gray-300"></div>
                      <div className="px-4 text-sm font-medium text-gray-500">
                        Transfer ({formatDuration(transferTime)})
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
                          <div className="font-medium text-gray-900">{getStopName(leg.startStop, stops)}</div>
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
                          <div className="font-medium text-gray-900">{getStopName(leg.endStop, stops)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
