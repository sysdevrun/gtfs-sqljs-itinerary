import { useCallback, useEffect, useState } from 'react';
import { useGTFSWorker } from './useGTFSWorker';
import { ItineraryForm } from './components/ItineraryForm';
import { ItineraryResults } from './components/ItineraryResults';
import type { Stop, Route } from './gtfs.worker';
import type { ScheduledJourney } from '../../src/graph-builder';

function App() {
  const [gtfsUrl, setGtfsUrl] = useState(`${import.meta.env.BASE_URL}car-jaune.gtfs.zip`);
  const [gtfsUrlInput, setGtfsUrlInput] = useState(gtfsUrl);
  const [showUrlConfig, setShowUrlConfig] = useState(false);

  const { worker, isInitializing, isReady, initProgress, error } = useGTFSWorker({ gtfsUrl });
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [journeys, setJourneys] = useState<ScheduledJourney[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Clear data when URL changes
  useEffect(() => {
    setStops([]);
    setRoutes([]);
    setJourneys([]);
    setSearchError(null);
  }, [gtfsUrl]);

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
    maxPaths: number;
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

  const handleLoadGtfs = () => {
    setGtfsUrl(gtfsUrlInput);
    setShowUrlConfig(false);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 text-xl font-bold mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setShowUrlConfig(true)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Change GTFS Source
          </button>
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
          <p className="text-gray-500 text-sm text-center mt-2">
            Loading from: {gtfsUrl}
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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                GTFS Itinerary Planner
              </h1>
              <p className="text-gray-600">
                Plan your journey with transit networks
              </p>
            </div>
            <button
              onClick={() => setShowUrlConfig(!showUrlConfig)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              {showUrlConfig ? 'Hide' : 'Change GTFS Source'}
            </button>
          </div>

          {showUrlConfig && (
            <div className="mt-4 bg-white rounded-lg shadow-md p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GTFS ZIP URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gtfsUrlInput}
                  onChange={(e) => setGtfsUrlInput(e.target.value)}
                  placeholder="https://example.com/gtfs.zip"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleLoadGtfs}
                  disabled={!gtfsUrlInput || gtfsUrlInput === gtfsUrl}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Current: {gtfsUrl}
              </p>
            </div>
          )}
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

        <ItineraryResults journeys={journeys} routes={routes} stops={stops} />
      </div>
    </div>
  );
}

export default App;
