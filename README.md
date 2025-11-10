# gtfs-sqljs-itinerary

> Graph-based itinerary search for GTFS transit data using BFS pathfinding

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://sysdevrun.github.io/gtfs-sqljs-itinerary/)

**[View Live Demo →](https://sysdevrun.github.io/gtfs-sqljs-itinerary/)**

A TypeScript library that builds directed graphs from GTFS data and finds optimal transit itineraries using Breadth-First Search (BFS) algorithm. Built on top of [gtfs-sqljs](https://github.com/sysdevrun/gtfs-sqljs) and [graphlib](https://github.com/dagrejs/graphlib).

## Features

- 🚀 **Fast BFS Pathfinding** - Finds shortest paths first (by number of segments/transfers)
- 🗓️ **Date-Aware** - Builds graphs for specific service dates
- 🔄 **Transfer Support** - Handles multi-leg journeys with configurable transfer times
- ⏰ **Schedule Matching** - Matches theoretical paths to actual scheduled trips
- 🌐 **Browser & Node.js** - Works in both environments
- 📊 **Parent Stop Resolution** - Automatically handles GTFS parent/child stop relationships
- 🎯 **Configurable Limits** - Control max paths and transfers for performance

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Examples](#examples)
- [Architecture](#architecture)
- [Current Limitations](#current-limitations)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install gtfs-sqljs-itinerary
```

Or using the GitHub repository:

```bash
npm install github:sysdevrun/gtfs-sqljs-itinerary
```

### Dependencies

This library requires:
- `gtfs-sqljs` - GTFS data loading and querying
- `graphlib` - Graph data structure

## Quick Start

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder } from 'gtfs-sqljs-itinerary';

// 1. Load GTFS data
const gtfs = await GtfsSqlJs.fromZip('path/to/gtfs.zip');

// 2. Create graph builder
const graphBuilder = new GraphBuilder(gtfs);

// 3. Build graph for specific routes and date
const date = '20251110'; // YYYYMMDD format
graphBuilder.buildGraphForRoute('O1', date);
graphBuilder.buildGraphForRoute('S4', date);

// 4. Find paths between stops
const paths = graphBuilder.findAllPaths(
  'stop_gare_st_paul',      // from stop ID
  'stop_gare_st_pierre',    // to stop ID
  10,                        // max paths to return
  3                          // max transfers allowed
);

// 5. Find scheduled trips matching the paths
const journeys = paths
  .map(path => GraphBuilder.findScheduledTrips(
    gtfs,
    path,
    date,
    13 * 3600 + 55 * 60,     // departure time (13:55 in seconds)
    300                       // min transfer duration (5 minutes)
  ))
  .filter(j => j !== null);

// 6. Display results
journeys.forEach(journey => {
  console.log(`Journey: ${journey.departureTime} → ${journey.arrivalTime}`);
  console.log(`Duration: ${journey.totalDuration} seconds`);
  journey.legs.forEach(leg => {
    console.log(`  ${leg.routeShortName}: ${leg.startStop} → ${leg.endStop}`);
  });
});
```

## API Reference

### GraphBuilder

#### Constructor

```typescript
new GraphBuilder(gtfs: GtfsSqlJs)
```

Creates a new graph builder instance.

**Parameters:**
- `gtfs` - Instance of GtfsSqlJs with loaded GTFS data

#### Methods

##### `buildGraphForRoute(routeId: string, date: string): void`

Builds the graph for a specific route on a given date. Automatically processes both directions (0 and 1).

**Parameters:**
- `routeId` - The route ID from GTFS routes.txt
- `date` - Service date in YYYYMMDD format (required)

**Example:**
```typescript
graphBuilder.buildGraphForRoute('O1', '20251110');
```

##### `findAllPaths(startStopId: string, endStopId: string, maxPaths?: number, maxTransfers?: number): PathSegment[][]`

Finds paths between two stops using BFS algorithm.

**Parameters:**
- `startStopId` - Starting stop ID (will be converted to parent stop)
- `endStopId` - Ending stop ID (will be converted to parent stop)
- `maxPaths` - Maximum number of paths to return (default: 100)
- `maxTransfers` - Maximum number of transfers allowed (default: 5)

**Returns:** Array of paths, where each path is an array of PathSegments

**Example:**
```typescript
const paths = graphBuilder.findAllPaths('stop_a', 'stop_b', 5, 2);
```

##### `static simplifyPath(path: PathSegment[]): SimplifiedTrip[]`

Simplifies a path by grouping consecutive segments on the same route/direction.

**Parameters:**
- `path` - Array of PathSegments

**Returns:** Array of SimplifiedTrips with intermediate stops grouped

**Example:**
```typescript
const simplified = GraphBuilder.simplifyPath(path);
```

##### `static findScheduledTrips(gtfs: GtfsSqlJs, path: PathSegment[], date: string, departureTime: number, minTransferDuration: number): ScheduledJourney | null`

Finds actual scheduled trips matching a theoretical path.

**Parameters:**
- `gtfs` - GtfsSqlJs instance
- `path` - Array of PathSegments
- `date` - Service date (YYYYMMDD format)
- `departureTime` - Desired departure time in seconds since midnight
- `minTransferDuration` - Minimum transfer time in seconds

**Returns:** ScheduledJourney with actual trip IDs and times, or null if no match found

**Example:**
```typescript
const journey = GraphBuilder.findScheduledTrips(
  gtfs,
  path,
  '20251110',
  13 * 3600 + 55 * 60,  // 13:55
  300                    // 5 minutes
);
```

### TypeScript Interfaces

#### PathSegment

```typescript
interface PathSegment {
  startStop: string;      // Parent stop ID
  routeId: string;        // Route ID
  directionId: number;    // Direction (0 or 1)
  endStop: string;        // Parent stop ID
}
```

#### SimplifiedTrip

```typescript
interface SimplifiedTrip {
  startStop: string;           // Parent stop ID
  endStop: string;             // Parent stop ID
  routeId: string;             // Route ID
  directionId: number;         // Direction
  intermediateStops: string[]; // Stops between start and end
}
```

#### TripLeg

```typescript
interface TripLeg {
  startStop: string;      // Parent stop ID
  endStop: string;        // Parent stop ID
  routeId: string;        // Route ID
  directionId: number;    // Direction
}
```

#### ScheduledLeg

```typescript
interface ScheduledLeg {
  tripId: string;           // GTFS trip ID
  tripShortName: string;    // Trip short name
  routeShortName: string;   // Route short name
  startStop: string;        // Stop name
  endStop: string;          // Stop name
  departureTime: number;    // Seconds since midnight
  arrivalTime: number;      // Seconds since midnight
}
```

#### ScheduledJourney

```typescript
interface ScheduledJourney {
  legs: ScheduledLeg[];     // Individual trip legs
  totalDuration: number;    // Total journey time in seconds
  departureTime: number;    // Overall departure time
  arrivalTime: number;      // Overall arrival time
}
```

## Configuration

### Graph Building

Control which routes to include:

```typescript
// Option 1: Build for specific routes
graphBuilder.buildGraphForRoute('O1', date);
graphBuilder.buildGraphForRoute('S4', date);

// Option 2: Build for all routes
const routes = gtfs.getRoutes();
routes.forEach(route => {
  graphBuilder.buildGraphForRoute(route.route_id, date);
});
```

### Path Finding Limits

Adjust performance vs. comprehensiveness:

```typescript
const paths = graphBuilder.findAllPaths(
  fromStop,
  toStop,
  10,  // maxPaths: fewer = faster, more = comprehensive
  3    // maxTransfers: fewer = faster direct routes only
);
```

**Recommended values:**
- **Interactive UI**: `maxPaths: 10, maxTransfers: 3`
- **Comprehensive search**: `maxPaths: 100, maxTransfers: 5`
- **Direct routes only**: `maxPaths: 5, maxTransfers: 0`

### Transfer Times

Set minimum transfer duration:

```typescript
const journey = GraphBuilder.findScheduledTrips(
  gtfs,
  path,
  date,
  departureTime,
  300  // 5 minutes minimum between legs
);
```

## Examples

### Example 1: Simple Direct Route

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder } from 'gtfs-sqljs-itinerary';

const gtfs = await GtfsSqlJs.fromZip('gtfs.zip');
const builder = new GraphBuilder(gtfs);

// Build graph for one route
builder.buildGraphForRoute('1', '20251110');

// Find paths (likely only direct routes)
const paths = builder.findAllPaths('stop_a', 'stop_z', 5, 0);

console.log(`Found ${paths.length} direct paths`);
```

### Example 2: Multi-Route Journey with Transfers

```typescript
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip');
const builder = new GraphBuilder(gtfs);

// Build graph for multiple routes
['1', '2', '3', '4'].forEach(routeId => {
  builder.buildGraphForRoute(routeId, '20251110');
});

// Find paths allowing up to 2 transfers
const paths = builder.findAllPaths('stop_a', 'stop_z', 10, 2);

// Get simplified view
paths.forEach((path, idx) => {
  const simplified = GraphBuilder.simplifyPath(path);
  console.log(`Path ${idx + 1}:`);
  simplified.forEach(trip => {
    console.log(`  Route ${trip.routeId}: ${trip.startStop} → ${trip.endStop}`);
    console.log(`    (via ${trip.intermediateStops.length} stops)`);
  });
});
```

### Example 3: Finding Actual Scheduled Trips

```typescript
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip');
const builder = new GraphBuilder(gtfs);

// Build graph
['O1', 'S4'].forEach(routeId => {
  builder.buildGraphForRoute(routeId, '20251110');
});

// Find paths
const paths = builder.findAllPaths('gare_st_paul', 'gare_st_pierre', 10, 3);

// Match to scheduled trips departing after 13:55
const departureTime = 13 * 3600 + 55 * 60;
const journeys = paths
  .map(path => GraphBuilder.findScheduledTrips(
    gtfs,
    path,
    '20251110',
    departureTime,
    300  // 5 min transfers
  ))
  .filter(j => j !== null)
  .sort((a, b) => a.departureTime - b.departureTime);

// Display first journey
if (journeys.length > 0) {
  const journey = journeys[0];
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  console.log(`Depart: ${formatTime(journey.departureTime)}`);
  console.log(`Arrive: ${formatTime(journey.arrivalTime)}`);
  console.log(`Duration: ${Math.floor(journey.totalDuration / 60)} minutes`);
  console.log('Legs:');
  journey.legs.forEach(leg => {
    console.log(`  ${leg.routeShortName} (${leg.tripShortName})`);
    console.log(`    ${formatTime(leg.departureTime)} ${leg.startStop}`);
    console.log(`    ${formatTime(leg.arrivalTime)} ${leg.endStop}`);
  });
}
```

### Example 4: Web Worker Integration (Browser)

See the [demo application](./demo) for a complete example using React and Web Workers with Comlink.

```typescript
// worker.ts
import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder } from 'gtfs-sqljs-itinerary';
import * as Comlink from 'comlink';

class ItineraryWorker {
  private gtfs: GtfsSqlJs | null = null;

  async loadGTFS(url: string) {
    this.gtfs = await GtfsSqlJs.fromZip(url);
  }

  async findJourneys(from: string, to: string, date: string, time: number) {
    const builder = new GraphBuilder(this.gtfs!);

    // Build graph for all routes
    const routes = this.gtfs!.getRoutes();
    routes.forEach(r => builder.buildGraphForRoute(r.route_id, date));

    // Find and match paths
    const paths = builder.findAllPaths(from, to, 10, 3);
    return paths
      .map(p => GraphBuilder.findScheduledTrips(this.gtfs!, p, date, time, 300))
      .filter(j => j !== null);
  }
}

Comlink.expose(new ItineraryWorker());
```

## Architecture

### Graph Structure

- **Nodes**: Parent stops (GTFS stops with no parent_station, or the grandest parent recursively)
- **Edges**: Transit connections with route and direction metadata
- **Edge Data**: `{ routeId: string, directionId: number }`
- **Type**: Directed multigraph (multiple edges between same nodes allowed)

### Pathfinding Algorithm

Uses **Breadth-First Search (BFS)** instead of DFS because:

1. **Optimal ordering**: Finds shortest paths first (by number of segments)
2. **Quality results**: When limited by `maxPaths`, returns the best paths
3. **Predictable performance**: Explores level-by-level, easier to bound
4. **Natural fit**: BFS minimizes transfers, which is usually desired

**Performance comparison (St-Paul to St-Pierre, 9 routes):**
- DFS: 1,094,271 paths in 5.9 seconds
- BFS: 100 paths in 3ms ✅

### Parent Stop Resolution

GTFS supports parent stations (e.g., a train station with multiple platforms). This library:

1. Recursively finds the grandest parent for each stop
2. Builds graph using only parent stops as nodes
3. Matches child stops to parents when finding scheduled trips

This ensures the graph represents logical transfer points, not individual platforms.

## Current Limitations

### 1. Graph Rebuild Per Search

The graph is rebuilt for each itinerary search. This is acceptable for most use cases but could be optimized:

**Current approach:**
```typescript
// Rebuilds graph on every search
const builder = new GraphBuilder(gtfs);
builder.buildGraphForRoute('O1', date);
const paths = builder.findAllPaths(from, to);
```

**Workaround for multiple searches:**
```typescript
// Reuse builder for same date
const builder = new GraphBuilder(gtfs);
['O1', 'S4', 'T'].forEach(r => builder.buildGraphForRoute(r, date));

// Multiple searches without rebuilding
const paths1 = builder.findAllPaths('A', 'B');
const paths2 = builder.findAllPaths('C', 'D');
```

### 2. Date Parameter Required

The `date` parameter is mandatory because:
- Different trips operate on different days (weekday/weekend/holiday calendars)
- Graph edges must reflect actual service patterns

**Limitation:** Cannot build a "generic" graph for all dates.

### 3. No Walking Transfers

The library only considers direct transit connections. It does not:
- Calculate walking distance between nearby stops
- Suggest walk-only routes
- Model park-and-ride scenarios

**Workaround:** Build graph edges manually for walkable connections.

### 4. No Real-time Updates

Schedule matching uses static GTFS data only. It does not:
- Account for delays or cancellations
- Use GTFS-Realtime feeds
- Predict actual arrival times

**Note:** `gtfs-sqljs` supports GTFS-RT, but this library doesn't leverage it yet.

### 5. Single Transfer Time

Uses a global `minTransferDuration` for all transfers. Does not consider:
- Station-specific transfer times
- Wheelchair accessibility requirements
- Platform-to-platform walking distance

### 6. Memory Usage with Large Networks

Building graphs for all routes in a large network (e.g., 100+ routes) can consume significant memory.

**Workaround:** Build graphs for route subsets:
```typescript
// Only build graph for routes near origin/destination
const relevantRoutes = findRoutesNearStops(from, to);
relevantRoutes.forEach(r => builder.buildGraphForRoute(r, date));
```

### 7. No Cost Optimization

Pathfinding minimizes segments/transfers but doesn't optimize for:
- Total travel time
- Fare cost
- Service frequency
- Real-time crowding

BFS naturally finds shortest paths by segments, which correlates with travel time but isn't optimized for it.

## Performance

### Benchmarks

Tested with Car Jaune GTFS data (15 routes):

| Routes | Paths Found | Path Search Time | Memory |
|--------|-------------|------------------|--------|
| 1      | 1           | <1ms             | ~5MB   |
| 5      | 8           | 2ms              | ~15MB  |
| 10     | 48          | 5ms              | ~25MB  |
| 15     | 100 (limit) | 8ms              | ~35MB  |

**Configuration:** maxPaths=100, maxTransfers=3

### Optimization Tips

1. **Limit routes**: Only build graph for relevant routes
2. **Limit results**: Use smaller `maxPaths` for interactive UIs
3. **Limit transfers**: Fewer transfers = faster search
4. **Reuse builders**: Build once, search multiple times for same date
5. **Web Workers**: Run in background thread (browser) for non-blocking UI

### Progressive Route Testing

The repository includes a progressive test (`test-progressive.ts`) that demonstrates performance scaling:

```bash
npm run test:progressive
```

This tests itinerary search with increasing numbers of routes (8-15) to identify performance characteristics.

## Browser Support

Works in all modern browsers with:
- ES2020+ support
- Web Workers (recommended for large graphs)
- WebAssembly (required by sql.js)

## Node.js Support

Requires Node.js 18+ for native ES modules and async/await support.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License

Copyright (c) 2025 Théophile Helleboid / SysDevRun

See [LICENSE](./LICENSE) file for details.

## Credits

- Built on [gtfs-sqljs](https://github.com/sysdevrun/gtfs-sqljs) by sysdevrun
- Uses [graphlib](https://github.com/dagrejs/graphlib) for graph data structures
- Inspired by GTFS specification and transit routing algorithms

## Related Projects

- [gtfs-sqljs](https://github.com/sysdevrun/gtfs-sqljs) - GTFS data loading
- [OpenTripPlanner](https://www.opentripplanner.org/) - Full-featured trip planner
- [Valhalla](https://github.com/valhalla/valhalla) - Routing engine with transit support
