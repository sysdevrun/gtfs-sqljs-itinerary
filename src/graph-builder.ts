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
   * @param date Optional date for filtering trips
   */
  private buildGraphForRouteDirection(
    routeId: string,
    directionId: number,
    date?: string
  ): void {
    // Get all trips for this route and direction
    const trips = this.gtfs.getTrips({
      routeId,
      directionId,
      ...(date && { date })
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
   * @param date Optional date for filtering trips
   */
  public buildGraph(date?: string): void {
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
   * @param date Optional date for filtering trips
   */
  public buildGraphForRoute(routeId: string, date?: string): void {
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
}
