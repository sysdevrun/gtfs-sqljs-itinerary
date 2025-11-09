import { useEffect, useRef, useState, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { Stop, Route, ItineraryRequest } from './gtfs.worker';
import type { ScheduledJourney } from '../../src/graph-builder';

type GTFSWorkerType = {
  initialize: (gtfsUrl: string, onProgress?: (progress: number) => void) => Promise<void>;
  getStops: () => Promise<Stop[]>;
  getRoutes: () => Promise<Route[]>;
  findItineraries: (request: ItineraryRequest) => Promise<ScheduledJourney[]>;
};

interface UseGTFSWorkerOptions {
  gtfsUrl: string;
}

export function useGTFSWorker({ gtfsUrl }: UseGTFSWorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const workerApiRef = useRef<GTFSWorkerType | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Cleanup worker
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      workerApiRef.current = null;
    }
  }, []);

  // Initialize worker with given GTFS URL
  const initializeWorker = useCallback(async (url: string) => {
    setIsInitializing(true);
    setIsReady(false);
    setError(null);
    setInitProgress(0);

    // Cleanup existing worker
    cleanup();

    try {
      // Create new worker
      workerRef.current = new Worker(
        new URL('./gtfs.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Wrap with Comlink
      workerApiRef.current = Comlink.wrap<GTFSWorkerType>(workerRef.current);

      // Initialize GTFS data
      await workerApiRef.current.initialize(
        url,
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
  }, [cleanup]);

  // Reinitialize when GTFS URL changes
  useEffect(() => {
    initializeWorker(gtfsUrl);

    // Cleanup on unmount
    return cleanup;
  }, [gtfsUrl, initializeWorker, cleanup]);

  return {
    worker: workerApiRef.current,
    isInitializing,
    isReady,
    initProgress,
    error,
    reinitialize: initializeWorker
  };
}
