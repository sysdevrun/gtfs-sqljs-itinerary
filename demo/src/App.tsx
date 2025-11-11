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
    maxTransfers: number;
    journeysCount: number;
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 py-8">
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

      <footer className="bg-gray-800 text-white py-8 md:py-6 min-h-[300px] md:min-h-[150px]">
        <div className="container mx-auto px-4 max-w-5xl h-full flex flex-col justify-center">
          <div className="text-center space-y-4 md:space-y-2">
            <p className="text-lg md:text-base font-semibold">
              GTFS Itinerary Planner
            </p>
            <p className="text-sm md:text-xs text-gray-300">
              Built with{' '}
              <a
                href="https://github.com/sysdevrun/gtfs-sqljs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                gtfs-sqljs
              </a>
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-sm md:text-xs">
              <a
                href="https://github.com/sysdevrun/gtfs-sqljs-itinerary"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Project Repository
              </a>
              <a
                href="https://github.com/sysdevrun/gtfs-sqljs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                gtfs-sqljs Module
              </a>
            </div>
            <p className="text-xs text-gray-400 pt-2">
              &copy; {new Date().getFullYear()} sysdevrun
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
