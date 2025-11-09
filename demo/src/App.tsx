import { useCallback, useEffect, useState } from 'react';
import { useGTFSWorker } from './useGTFSWorker';
import { ItineraryForm } from './components/ItineraryForm';
import { ItineraryResults } from './components/ItineraryResults';
import type { Stop, Route } from './gtfs.worker';
import type { ScheduledJourney } from '../../src/graph-builder';

function App() {
  const { worker, isInitializing, isReady, initProgress, error } = useGTFSWorker();
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [journeys, setJourneys] = useState<ScheduledJourney[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load stops and routes when worker is ready
  useEffect(() => {
    if (isReady && worker) {
      const loadData = async () => {
        try {
          const [stopsData, routesData] = await Promise.all([
            worker.getStops(),
            worker.getRoutes()
          ]);
          setStops(stopsData);
          setRoutes(routesData);
        } catch (err) {
          console.error('Failed to load GTFS data:', err);
        }
      };
      loadData();
    }
  }, [isReady, worker]);

  const handleSearch = useCallback(async (params: {
    fromStopId: string;
    toStopId: string;
    date: string;
    departureTime: number;
  }) => {
    if (!worker) return;

    setIsSearching(true);
    setSearchError(null);
    setJourneys([]);

    try {
      const results = await worker.findItineraries({
        ...params,
        minTransferDuration: 300 // 5 minutes
      });
      setJourneys(results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [worker]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 text-xl font-bold mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading GTFS Data</h2>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${initProgress * 100}%` }}
            ></div>
          </div>
          <p className="text-gray-600 text-center">
            {Math.round(initProgress * 100)}%
          </p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Car Jaune Itinerary Planner
          </h1>
          <p className="text-gray-600">
            Plan your journey with the Car Jaune transit network
          </p>
        </header>

        <ItineraryForm
          stops={stops}
          onSearch={handleSearch}
          isSearching={isSearching}
        />

        {searchError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">{searchError}</p>
          </div>
        )}

        <ItineraryResults journeys={journeys} routes={routes} />
      </div>
    </div>
  );
}

export default App;
