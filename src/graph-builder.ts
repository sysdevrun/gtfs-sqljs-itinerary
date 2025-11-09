import { Graph } from 'graphlib';
import type { GtfsSqlJs } from 'gtfs-sqljs';

/**
 * Represents an edge in the transit graph
 */
export interface TransitEdge {
  routeId: string;
  directionId: number;
}

/**
 * Represents a path segment in the transit network
 */
export interface PathSegment {
  startStop: string;
  routeId: string;
  directionId: number;
  endStop: string;
}

/**
 * Represents a simplified trip (consecutive segments on same route/direction)
 */
export interface SimplifiedTrip {
  startStop: string;
  endStop: string;
  routeId: string;
  directionId: number;
  intermediateStops: string[];
}

/**
 * Represents a leg with transfer information
 */
export interface TripLeg {
  startStop: string;
  endStop: string;
  routeId: string;
  directionId: number;
}

/**
 * Represents a scheduled trip match for a leg
 */
export interface ScheduledLeg {
  tripId: string;
  tripShortName: string;
  routeShortName: string;
  startStop: string;
  endStop: string;
  departureTime: number; // seconds since midnight
  arrivalTime: number; // seconds since midnight
}

/**
 * Represents a complete scheduled journey
 */
export interface ScheduledJourney {
  legs: ScheduledLeg[];
  totalDuration: number; // in seconds
  departureTime: number; // seconds since midnight
  arrivalTime: number; // seconds since midnight
}

/**
 * Builds and manages a directed graph of transit connections
 */
export class GraphBuilder {
  private graph: Graph;
  private gtfs: GtfsSqlJs;

  constructor(gtfs: GtfsSqlJs) {
    this.gtfs = gtfs;
    this.graph = new Graph({ directed: true, multigraph: true });
  }

  /**
   * Recursively finds the grandest parent stop
   * @param stopId The stop ID to find the parent for
   * @returns The ID of the grandest parent stop
   */
  private findGrandestParent(stopId: string): string {
    const stops = this.gtfs.getStops({ stopId });
    if (!stops || stops.length === 0) {
      return stopId;
    }

    const stop = stops[0];

    // If no parent station, this is the grandest parent
    if (!stop.parent_station) {
      return stopId;
    }

    // Recursively find the parent's parent
    return this.findGrandestParent(stop.parent_station);
  }

  /**
   * Adds a stop node to the graph if it doesn't exist
   * @param stopId The stop ID to add
   */
  private addStopNode(stopId: string): void {
    const parentStopId = this.findGrandestParent(stopId);

    if (!this.graph.hasNode(parentStopId)) {
      this.graph.setNode(parentStopId);
    }
  }

  /**
   * Adds an edge between two stops with route and direction information
   * @param fromStopId The origin stop ID
   * @param toStopId The destination stop ID
   * @param routeId The route ID
   * @param directionId The direction ID (0 or 1)
   */
  private addTransitEdge(
    fromStopId: string,
    toStopId: string,
    routeId: string,
    directionId: number
  ): void {
    const fromParent = this.findGrandestParent(fromStopId);
    const toParent = this.findGrandestParent(toStopId);

    // Add nodes if they don't exist
    this.addStopNode(fromStopId);
    this.addStopNode(toStopId);

    // Add edge with route and direction info
    const edgeData: TransitEdge = { routeId, directionId };

    // Use a unique edge name to support multigraph
    const edgeName = `${routeId}_${directionId}`;
    this.graph.setEdge(fromParent, toParent, edgeData, edgeName);
  }

  /**
   * Builds the graph for a specific route and direction
   * @param routeId The route ID
   * @param directionId The direction ID (0 or 1)
   * @param date Date for filtering trips (YYYYMMDD format, required)
   */
  private buildGraphForRouteDirection(
    routeId: string,
    directionId: number,
    date: string
  ): void {
    // Get all trips for this route and direction
    const trips = this.gtfs.getTrips({
      routeId,
      directionId,
      date
    });

    if (!trips || trips.length === 0) {
      return;
    }

    // Build ordered list of stops
    const tripIds = trips.map(t => t.trip_id);
    const orderedStops = this.gtfs.buildOrderedStopList(tripIds);

    // Add edges between consecutive stops
    for (let i = 0; i < orderedStops.length - 1; i++) {
      const currentStop = orderedStops[i];
      const nextStop = orderedStops[i + 1];

      this.addTransitEdge(
        currentStop.stop_id,
        nextStop.stop_id,
        routeId,
        directionId
      );
    }
  }

  /**
   * Builds the complete transit graph for all routes
   * @param date Date for filtering trips (YYYYMMDD format, required)
   */
  public buildGraph(date: string): void {
    // Get all routes
    const routes = this.gtfs.getRoutes();

    if (!routes) {
      return;
    }

    // For each route, build graph for both directions
    for (const route of routes) {
      // Direction 0
      this.buildGraphForRouteDirection(route.route_id, 0, date);

      // Direction 1
      this.buildGraphForRouteDirection(route.route_id, 1, date);
    }
  }

  /**
   * Builds the graph for a specific route
   * @param routeId The route ID to build graph for
   * @param date Date for filtering trips (YYYYMMDD format, required)
   */
  public buildGraphForRoute(routeId: string, date: string): void {
    // Direction 0
    this.buildGraphForRouteDirection(routeId, 0, date);

    // Direction 1
    this.buildGraphForRouteDirection(routeId, 1, date);
  }

  /**
   * Gets the graph instance
   * @returns The graph
   */
  public getGraph(): Graph {
    return this.graph;
  }

  /**
   * Helper function to find all simple paths using DFS
   * @param current Current node
   * @param target Target node
   * @param visited Set of visited nodes
   * @param currentPath Current path being explored
   * @param allPaths Array to store all found paths
   */
  private findAllPathsDFS(
    current: string,
    target: string,
    visited: Set<string>,
    currentPath: PathSegment[],
    allPaths: PathSegment[][]
  ): void {
    // Base case: reached target
    if (current === target) {
      allPaths.push([...currentPath]);
      return;
    }

    // Mark current as visited
    visited.add(current);

    // Get all outgoing edges
    const edges = this.graph.outEdges(current) || [];

    for (const edge of edges) {
      const nextNode = edge.w;

      // Skip if already visited (avoid cycles)
      if (visited.has(nextNode)) {
        continue;
      }

      // Get edge data
      const edgeData = this.graph.edge(edge) as TransitEdge;

      // Add segment to current path
      const segment: PathSegment = {
        startStop: current,
        routeId: edgeData.routeId,
        directionId: edgeData.directionId,
        endStop: nextNode
      };
      currentPath.push(segment);

      // Recursively explore
      this.findAllPathsDFS(nextNode, target, visited, currentPath, allPaths);

      // Backtrack
      currentPath.pop();
    }

    // Unmark current node
    visited.delete(current);
  }

  /**
   * Finds all paths between two stops
   * @param startStopId The starting stop ID (will be converted to parent)
   * @param endStopId The ending stop ID (will be converted to parent)
   * @returns Array of paths, where each path is an array of PathSegments
   */
  public findAllPaths(startStopId: string, endStopId: string): PathSegment[][] {
    const startParent = this.findGrandestParent(startStopId);
    const endParent = this.findGrandestParent(endStopId);

    // Check if nodes exist in graph
    if (!this.graph.hasNode(startParent) || !this.graph.hasNode(endParent)) {
      return [];
    }

    const allPaths: PathSegment[][] = [];
    const visited = new Set<string>();
    const currentPath: PathSegment[] = [];

    this.findAllPathsDFS(startParent, endParent, visited, currentPath, allPaths);

    return allPaths;
  }

  /**
   * Gets all nodes in the graph
   * @returns Array of node IDs
   */
  public getNodes(): string[] {
    return this.graph.nodes();
  }

  /**
   * Gets all edges in the graph
   * @returns Array of edges
   */
  public getEdges(): Array<{ v: string; w: string; data: TransitEdge }> {
    const edges = this.graph.edges();
    return edges.map((edge: { v: string; w: string }) => ({
      v: edge.v,
      w: edge.w,
      data: this.graph.edge(edge) as TransitEdge
    }));
  }

  /**
   * Gets edges for a specific route
   * @param routeId The route ID to filter by
   * @returns Array of edges for the route
   */
  public getEdgesForRoute(routeId: string): Array<{ v: string; w: string; data: TransitEdge }> {
    return this.getEdges().filter(edge => edge.data.routeId === routeId);
  }

  /**
   * Simplifies a path by grouping consecutive segments on the same route/direction
   * into single trips, hiding intermediate stops when there's no transfer
   * @param path Array of path segments to simplify
   * @returns Array of simplified trips
   */
  public static simplifyPath(path: PathSegment[]): SimplifiedTrip[] {
    if (path.length === 0) {
      return [];
    }

    const simplifiedTrips: SimplifiedTrip[] = [];
    let currentTrip: SimplifiedTrip | null = null;

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];

      // If no current trip or different route/direction, start a new trip
      if (!currentTrip ||
          currentTrip.routeId !== segment.routeId ||
          currentTrip.directionId !== segment.directionId) {

        // Save the previous trip if it exists
        if (currentTrip) {
          simplifiedTrips.push(currentTrip);
        }

        // Start a new trip
        currentTrip = {
          startStop: segment.startStop,
          endStop: segment.endStop,
          routeId: segment.routeId,
          directionId: segment.directionId,
          intermediateStops: []
        };
      } else {
        // Same route/direction - extend the current trip
        // Add the previous end stop as an intermediate stop
        currentTrip.intermediateStops.push(currentTrip.endStop);
        // Update the end stop to the current segment's end
        currentTrip.endStop = segment.endStop;
      }
    }

    // Don't forget to add the last trip
    if (currentTrip) {
      simplifiedTrips.push(currentTrip);
    }

    return simplifiedTrips;
  }

  /**
   * Converts a path to trip legs (only transfers - one entry per route/direction change)
   * @param path Array of path segments
   * @returns Array of trip legs
   */
  public static pathToTripLegs(path: PathSegment[]): TripLeg[] {
    const simplified = GraphBuilder.simplifyPath(path);
    return simplified.map(trip => ({
      startStop: trip.startStop,
      endStop: trip.endStop,
      routeId: trip.routeId,
      directionId: trip.directionId
    }));
  }

  /**
   * Converts time string (HH:MM:SS) to seconds since midnight
   * @param timeString Time in HH:MM:SS format
   * @returns Seconds since midnight
   */
  private static timeToSeconds(timeString: string): number {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Gets all stop IDs related to a stop (including children if it's a parent station)
   * @param gtfs GTFS data instance
   * @param stopId The stop ID (could be a parent station)
   * @returns Array of stop IDs (parent and all children)
   */
  private static getRelatedStopIds(gtfs: GtfsSqlJs, stopId: string): string[] {
    const stopIds = [stopId];

    // Get all stops
    const allStops = gtfs.getStops();
    if (!allStops) {
      return stopIds;
    }

    // Find all stops that have this stop as parent_station
    const childStops = allStops.filter(stop => stop.parent_station === stopId);
    stopIds.push(...childStops.map(stop => stop.stop_id));

    return stopIds;
  }

  /**
   * Finds scheduled trips matching the path for a specific date and time
   * @param gtfs GTFS data instance
   * @param path Array of path segments
   * @param date Date in YYYYMMDD format
   * @param departureTime Departure time in seconds since midnight
   * @param minTransferDuration Minimum transfer duration in seconds
   * @returns Scheduled journey if found, null otherwise
   */
  public static findScheduledTrips(
    gtfs: GtfsSqlJs,
    path: PathSegment[],
    date: string,
    departureTime: number,
    minTransferDuration: number
  ): ScheduledJourney | null {
    // Step 1: Convert path to trip legs
    const legs = GraphBuilder.pathToTripLegs(path);

    if (legs.length === 0) {
      return null;
    }

    const scheduledLegs: ScheduledLeg[] = [];
    let currentTime = departureTime;

    // Step 2: For each leg, find matching trips
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      // Get all trips for this route and direction on the given date
      const trips = gtfs.getTrips({
        routeId: leg.routeId,
        directionId: leg.directionId,
        date
      });

      if (!trips || trips.length === 0) {
        return null; // No trips available for this leg
      }

      // Get all related stop IDs (including children) for start and end stops
      const startStopIds = GraphBuilder.getRelatedStopIds(gtfs, leg.startStop);
      const endStopIds = GraphBuilder.getRelatedStopIds(gtfs, leg.endStop);

      // Get stop times filtered by trip IDs (only for our route/direction/date trips)
      const tripIds = trips.map(t => t.trip_id);
      const stopTimesForTrips = gtfs.getStopTimes({ tripId: tripIds });

      if (!stopTimesForTrips || stopTimesForTrips.length === 0) {
        return null;
      }

      // Find stop times at departure stop for our valid trips
      const departureStopTimes = stopTimesForTrips.filter(st =>
        startStopIds.includes(st.stop_id)
      );

      if (departureStopTimes.length === 0) {
        return null; // No trips serve the departure stop
      }

      // Sort by departure time to find earliest matching trip
      departureStopTimes.sort((a, b) => {
        const timeA = GraphBuilder.timeToSeconds(a.departure_time);
        const timeB = GraphBuilder.timeToSeconds(b.departure_time);
        return timeA - timeB;
      });

      // Find a trip that:
      // 1. Departs after currentTime
      // 2. Also serves the arrival stop (after the departure stop)
      let matchedTrip = null;
      let matchedDepartureTime = 0;
      let matchedArrivalTime = 0;

      for (const depStopTime of departureStopTimes) {
        const depTime = GraphBuilder.timeToSeconds(depStopTime.departure_time);

        // Skip if this departure is too early
        if (depTime < currentTime) {
          continue;
        }

        // Now find arrival stop time for the same trip
        const arrivalStopTime = stopTimesForTrips.find(st =>
          st.trip_id === depStopTime.trip_id &&
          endStopIds.includes(st.stop_id) &&
          st.stop_sequence > depStopTime.stop_sequence
        );

        if (!arrivalStopTime) {
          // This trip doesn't serve the arrival stop after departure stop
          continue;
        }

        // Found a matching trip!
        const arrTime = GraphBuilder.timeToSeconds(arrivalStopTime.arrival_time);

        matchedTrip = trips.find(t => t.trip_id === depStopTime.trip_id);
        matchedDepartureTime = depTime;
        matchedArrivalTime = arrTime;
        break; // Take the earliest available trip
      }

      if (!matchedTrip) {
        return null; // No suitable trip found for this leg
      }

      // Get route info
      const routes = gtfs.getRoutes({ routeId: leg.routeId });
      const routeShortName = routes?.[0]?.route_short_name || leg.routeId;

      // Get trip short name (use trip_short_name or trip_id)
      const tripShortName = (matchedTrip as any).trip_short_name || matchedTrip.trip_id;

      // Add this scheduled leg
      scheduledLegs.push({
        tripId: matchedTrip.trip_id,
        tripShortName,
        routeShortName,
        startStop: leg.startStop,
        endStop: leg.endStop,
        departureTime: matchedDepartureTime,
        arrivalTime: matchedArrivalTime
      });

      // Update current time for next leg (arrival + transfer time)
      currentTime = matchedArrivalTime + minTransferDuration;
    }

    // Calculate total duration
    const totalDuration = scheduledLegs[scheduledLegs.length - 1].arrivalTime - scheduledLegs[0].departureTime;

    return {
      legs: scheduledLegs,
      totalDuration,
      departureTime: scheduledLegs[0].departureTime,
      arrivalTime: scheduledLegs[scheduledLegs.length - 1].arrivalTime
    };
  }
}
