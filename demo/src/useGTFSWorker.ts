import { useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { Stop, Route, ItineraryRequest } from './gtfs.worker';
import type { ScheduledJourney } from '../../src/graph-builder';

type GTFSWorkerType = {
  initialize: (gtfsUrl: string, onProgress?: (progress: number) => void) => Promise<void>;
  getStops: () => Promise<Stop[]>;
  getRoutes: () => Promise<Route[]>;
  findItineraries: (request: ItineraryRequest) => Promise<ScheduledJourney[]>;
};

export function useGTFSWorker() {
  const workerRef = useRef<Worker | null>(null);
  const workerApiRef = useRef<GTFSWorkerType | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('./gtfs.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Wrap with Comlink
    workerApiRef.current = Comlink.wrap<GTFSWorkerType>(workerRef.current);

    // Initialize GTFS data
    const initialize = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        const gtfsUrl = `${import.meta.env.BASE_URL}car-jaune.gtfs.zip`;
        await workerApiRef.current!.initialize(
          gtfsUrl,
          Comlink.proxy((progress: number) => {
            setInitProgress(progress);
          })
        );
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize GTFS');
        console.error('Failed to initialize GTFS:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();

    // Cleanup
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return {
    worker: workerApiRef.current,
    isInitializing,
    isReady,
    initProgress,
    error
  };
}
