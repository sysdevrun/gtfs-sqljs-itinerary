import * as Comlink from 'comlink';
import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder, type ScheduledJourney } from '../../src/graph-builder';

export interface Stop {
  stop_id: string;
  stop_name: string;
  parent_station?: string;
}

export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color?: string;
  route_text_color?: string;
}

export interface ItineraryRequest {
  fromStopId: string;
  toStopId: string;
  date: string;
  departureTime: number;
  minTransferDuration?: number;
  maxPaths?: number;
  journeysCount?: number;
}

/**
 * Convert https URL to proxy URL for CORS bypass
 * Only processes URLs starting with https://, leaves relative paths unchanged
 */
function getProxyUrl(url: string): string {
  if (!url.startsWith('https://')) {
    // Return as-is for relative paths or non-https URLs
    return url;
  }
  // Remove https:// prefix and prepend proxy URL
  const withoutProtocol = url.substring(8);
  return `https://gtfs-proxy.sys-dev-run.re/proxy/${withoutProtocol}`;
}

class GTFSWorker {
  private gtfs: GtfsSqlJs | null = null;
  private graphBuilder: GraphBuilder | null = null;
  private isInitialized = false;

  async initialize(gtfsUrl: string, onProgress?: (progress: number) => void): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Report initial progress
    if (onProgress) {
      onProgress(0.1);
    }

    // Use proxy for https URLs, leave relative paths unchanged
    const sourceUrl = getProxyUrl(gtfsUrl);

    // Load GTFS from ZIP URL with locateFile configuration for sql.js WASM
    this.gtfs = await GtfsSqlJs.fromZip(sourceUrl, {
      locateFile: (filename: string) => {
        // Return path to WASM file in public directory
        // In development: /sql-wasm.wasm
        // In production: /gtfs-sqljs-itinerary/sql-wasm.wasm (based on vite.config.ts base)
        const base = import.meta.env.BASE_URL || '/';
        return `${base}${filename}`;
      }
    });

    if (onProgress) {
      onProgress(1.0);
    }

    this.isInitialized = true;
  }

  getStops(): Stop[] {
    if (!this.gtfs) {
      throw new Error('GTFS not initialized');
    }

    const stops = this.gtfs.getStops();
    return stops || [];
  }

  getRoutes(): Route[] {
    if (!this.gtfs) {
      throw new Error('GTFS not initialized');
    }

    const routes = this.gtfs.getRoutes();
    return routes || [];
  }

  async findItineraries(request: ItineraryRequest): Promise<ScheduledJourney[]> {
    if (!this.gtfs) {
      throw new Error('GTFS not initialized');
    }

    // Build graph with all routes for the given date
    this.graphBuilder = new GraphBuilder(this.gtfs);
    const routes = this.getRoutes();

    for (const route of routes) {
      this.graphBuilder.buildGraphForRoute(route.route_id, request.date);
    }

    // Find paths
    const paths = this.graphBuilder.findAllPaths(
      request.fromStopId,
      request.toStopId,
      request.maxPaths || 10, // maxPaths (default 10)
      3   // maxTransfers
    );

    if (paths.length === 0) {
      return [];
    }

    // Find scheduled trips for each path
    const journeys: ScheduledJourney[] = [];
    for (const path of paths) {
      const pathJourneys = GraphBuilder.findScheduledTrips(
        this.gtfs,
        path,
        request.date,
        request.departureTime,
        request.minTransferDuration || 300,
        request.journeysCount || 3 // Default to 3 journeys per path
      );

      journeys.push(...pathJourneys);
    }

    // Sort by departure time
    journeys.sort((a, b) => a.departureTime - b.departureTime);

    return journeys;
  }
}

const worker = new GTFSWorker();
Comlink.expose(worker);
