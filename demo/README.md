# GTFS Itinerary Planner Demo

A web-based itinerary planner for the Car Jaune transit network, built with React, TypeScript, and Tailwind CSS v3.

## Features

- **Real-time Itinerary Search**: Find optimal routes between any two stops
- **Smart Path Finding**: Uses BFS algorithm to find shortest paths with minimal transfers
- **Scheduled Trip Matching**: Shows actual scheduled departures matching your search
- **Route Visualization**: Displays routes with their official colors and branding
- **Web Worker Architecture**: All GTFS processing runs in a background thread for smooth UX
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Vite** - Fast build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v3** - Utility-first CSS framework
- **Comlink** - Simplifies web worker communication
- **gtfs-sqljs** - GTFS data processing
- **gtfs-sqljs-itinerary** - Graph-based itinerary search (parent module)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd demo
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Architecture

### Web Worker Pattern

The application uses a dedicated web worker to handle all GTFS data operations:

```
┌─────────────────┐         Comlink RPC          ┌──────────────────┐
│                 │◄──────────────────────────────►│                  │
│   React App     │                                │   GTFS Worker    │
│   (Main Thread) │      Async Function Calls      │ (Background)     │
│                 │◄──────────────────────────────►│                  │
└─────────────────┘                                └──────────────────┘
        │                                                    │
        │                                                    ├─ Load GTFS Data
        ├─ UI Interactions                                  ├─ Build Graph
        ├─ Display Results                                  ├─ Find Paths
        └─ User Input                                       └─ Match Schedules
```

### Key Components

#### `src/gtfs.worker.ts`
Web worker that:
- Loads GTFS data from ZIP file
- Builds transit graph using gtfs-sqljs-itinerary
- Finds optimal paths using BFS algorithm
- Matches paths to scheduled trips

#### `src/useGTFSWorker.ts`
React hook that:
- Initializes and manages the web worker
- Wraps worker API with Comlink for easy async calls
- Tracks initialization progress and errors

#### `src/components/ItineraryForm.tsx`
Search form with:
- Departure/arrival stop selectors
- Date picker (defaults to today)
- Time selector (2-hour increments, defaults to 06:00)
- Auto-search on form changes

#### `src/components/ItineraryResults.tsx`
Results display showing:
- Journey duration and departure/arrival times
- Route badges with official colors
- Transfer points
- Detailed leg information

## How It Works

### 1. GTFS Data Loading

On app startup, the worker:
1. Fetches the GTFS ZIP file from `public/car-jaune.gtfs.zip`
2. Loads it into an SQLite database using gtfs-sqljs
3. Indexes routes, stops, trips, and schedules

### 2. Graph Building

When searching, the worker:
1. Creates a directed multigraph with stops as nodes
2. Iterates through all routes and directions
3. Adds edges between consecutive stops on each route
4. Handles parent/child stop relationships

### 3. Path Finding

Uses Breadth-First Search (BFS) to:
- Find shortest paths first (by number of segments)
- Limit to 10 paths maximum
- Restrict to 3 transfers maximum
- Return paths ordered by quality (direct routes first)

### 4. Schedule Matching

For each path:
1. Simplifies to trip legs (groups consecutive segments on same route)
2. Finds trips operating on the selected date
3. Matches departure times after requested time
4. Ensures minimum transfer duration (5 minutes)
5. Returns complete journey with times and trip IDs

## Configuration

### Base URL for GitHub Pages

Update `vite.config.ts` if deploying to a different repository:

```typescript
export default defineConfig({
  base: '/your-repo-name/',
  // ...
})
```

### Transfer Duration

Adjust in `src/gtfs.worker.ts`:

```typescript
minTransferDuration: 300  // 5 minutes in seconds
```

### Path Finding Limits

Adjust in `src/gtfs.worker.ts`:

```typescript
const paths = this.graphBuilder.findAllPaths(
  request.fromStopId,
  request.toStopId,
  10, // maxPaths - number of path alternatives
  3   // maxTransfers - maximum connections
);
```

## Deployment

### GitHub Pages

1. Update `base` in `vite.config.ts` to match your repo name
2. Build the project: `npm run build`
3. Deploy the `dist` directory to GitHub Pages

### Manual Deployment

The `dist` directory contains all static files needed for deployment to any web server.

## Performance Considerations

- **Web Worker**: Keeps main thread responsive during heavy computations
- **BFS Algorithm**: Efficiently finds optimal paths without exploring all possibilities
- **Filtered Queries**: Never loads entire GTFS tables, only filtered subsets
- **Progress Tracking**: Shows loading progress for better UX

## Browser Compatibility

- Modern browsers with ES2020+ support
- Web Workers support required
- Tested on Chrome, Firefox, Safari, Edge

## License

MIT

## Credits

- Built with [gtfs-sqljs](https://github.com/sysdevrun/gtfs-sqljs)
- GTFS data from [Car Jaune](https://pysae.com/api/v2/groups/car-jaune/gtfs/pub)
- Graph algorithms using [graphlib](https://github.com/dagrejs/graphlib)
