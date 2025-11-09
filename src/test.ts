import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder, PathSegment, SimplifiedTrip, ScheduledJourney } from './graph-builder';
import * as path from 'path';

/**
 * Helper function to convert seconds to HH:MM:SS format
 */
function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper function to display simplified trips
 */
function displaySimplifiedPath(
  gtfs: GtfsSqlJs,
  path: PathSegment[],
  pathNumber: number
): void {
  const simplifiedTrips = GraphBuilder.simplifyPath(path);

  console.log(`Path ${pathNumber} (${simplifiedTrips.length} trip(s)):`);

  simplifiedTrips.forEach((trip, tripIndex) => {
    // Get stop names
    const fromStops = gtfs.getStops({ stopId: trip.startStop });
    const toStops = gtfs.getStops({ stopId: trip.endStop });

    const fromName = fromStops?.[0]?.stop_name || trip.startStop;
    const toName = toStops?.[0]?.stop_name || trip.endStop;

    // Get route info
    const routes = gtfs.getRoutes({ routeId: trip.routeId });
    const routeName = routes?.[0]?.route_short_name || trip.routeId;

    // Display trip
    console.log(
      `  Trip ${tripIndex + 1}: ${fromName} -> ${toName} via Route ${routeName}, Direction ${trip.directionId}`
    );

    // Optionally show intermediate stops count if any
    if (trip.intermediateStops.length > 0) {
      console.log(`           (${trip.intermediateStops.length} intermediate stop(s))`);
    }
  });

  console.log('');
}

/**
 * Helper function to display scheduled journey
 */
function displayScheduledJourney(
  gtfs: GtfsSqlJs,
  journey: ScheduledJourney,
  pathNumber: number
): void {
  console.log(`\n  Scheduled Journey for Path ${pathNumber}:`);
  console.log(`    Departure: ${secondsToTime(journey.departureTime)}`);
  console.log(`    Arrival: ${secondsToTime(journey.arrivalTime)}`);
  console.log(`    Duration: ${Math.floor(journey.totalDuration / 60)} minutes`);
  console.log(`    Legs: ${journey.legs.length}`);

  journey.legs.forEach((leg, legIndex) => {
    // Get stop names
    const fromStops = gtfs.getStops({ stopId: leg.startStop });
    const toStops = gtfs.getStops({ stopId: leg.endStop });

    const fromName = fromStops?.[0]?.stop_name || leg.startStop;
    const toName = toStops?.[0]?.stop_name || leg.endStop;

    console.log(`\n    Leg ${legIndex + 1}:`);
    console.log(`      Route: ${leg.routeShortName} (Trip: ${leg.tripShortName})`);
    console.log(`      From: ${fromName} at ${secondsToTime(leg.departureTime)}`);
    console.log(`      To: ${toName} at ${secondsToTime(leg.arrivalTime)}`);
    console.log(`      Duration: ${Math.floor((leg.arrivalTime - leg.departureTime) / 60)} minutes`);
  });

  console.log('');
}

async function main() {
  // Test parameters
  const testDate = '20251110'; // 2025-11-10
  const testTime = '13:55:00';
  const testTimeSeconds = 13 * 3600 + 55 * 60; // 50100 seconds
  const minTransferDuration = 5 * 60; // 5 minutes = 300 seconds

  console.log('='.repeat(70));
  console.log('GTFS Itinerary Search Test');
  console.log('='.repeat(70));
  console.log(`\nTest Parameters:`);
  console.log(`  Date: ${testDate} (${testDate.substring(0, 4)}-${testDate.substring(4, 6)}-${testDate.substring(6, 8)})`);
  console.log(`  Departure Time: ${testTime}`);
  console.log(`  Minimum Transfer Duration: ${minTransferDuration / 60} minutes`);
  console.log('');

  console.log('Loading GTFS data from car-jaune.gtfs.zip...');

  // Load GTFS data
  const gtfsPath = path.join(__dirname, '..', 'data', 'car-jaune.gtfs.zip');
  const gtfs = await GtfsSqlJs.fromZip(gtfsPath, {
    onProgress: (progress) => {
      console.log(`Loading: ${progress.percentComplete.toFixed(1)}%`);
    }
  });

  console.log('\nGTFS data loaded successfully!');

  // Find routes with short names O1 and S4
  const allRoutes = gtfs.getRoutes();
  const routeO1 = allRoutes?.find(r => r.route_short_name === 'O1');
  const routeS4 = allRoutes?.find(r => r.route_short_name === 'S4');

  if (!routeO1) {
    console.log('\nRoute O1 not found!');
    return;
  }

  if (!routeS4) {
    console.log('\nRoute S4 not found!');
    return;
  }

  console.log(`\nFound route O1: ${routeO1.route_short_name} - ${routeO1.route_long_name}`);
  console.log(`Route ID: ${routeO1.route_id}`);

  console.log(`\nFound route S4: ${routeS4.route_short_name} - ${routeS4.route_long_name}`);
  console.log(`Route ID: ${routeS4.route_id}`);

  // Create graph builder with a single unified graph
  console.log('\n\nBuilding unified graph with routes O1 and S4...');
  console.log(`Using date: ${testDate}`);
  const graphBuilder = new GraphBuilder(gtfs);

  // Add both routes to the same graph (enables transfers between routes)
  graphBuilder.buildGraphForRoute(routeO1.route_id, testDate);
  graphBuilder.buildGraphForRoute(routeS4.route_id, testDate);

  console.log(`\nUnified graph built (single graph containing both routes):`);
  console.log(`Total nodes: ${graphBuilder.getNodes().length}`);
  console.log(`Total edges: ${graphBuilder.getEdges().length}`);

  // Get edges for route O1 (subset of the unified graph)
  const edgesO1 = graphBuilder.getEdgesForRoute(routeO1.route_id);
  console.log(`\nRoute O1 edges in graph: ${edgesO1.length}`);

  console.log('\nEdges (connections) for route O1:');
  for (const edge of edgesO1) {
    // Get stop names
    const fromStops = gtfs.getStops({ stopId: edge.v });
    const toStops = gtfs.getStops({ stopId: edge.w });

    const fromName = fromStops?.[0]?.stop_name || edge.v;
    const toName = toStops?.[0]?.stop_name || edge.w;

    console.log(
      `  ${fromName} -> ${toName} (Direction ${edge.data.directionId})`
    );
  }

  // Get edges for route S4 (subset of the unified graph)
  const edgesS4 = graphBuilder.getEdgesForRoute(routeS4.route_id);
  console.log(`\nRoute S4 edges in graph: ${edgesS4.length}`);

  console.log('\nEdges (connections) for route S4:');
  for (const edge of edgesS4) {
    // Get stop names
    const fromStops = gtfs.getStops({ stopId: edge.v });
    const toStops = gtfs.getStops({ stopId: edge.w });

    const fromName = fromStops?.[0]?.stop_name || edge.v;
    const toName = toStops?.[0]?.stop_name || edge.w;

    console.log(
      `  ${fromName} -> ${toName} (Direction ${edge.data.directionId})`
    );
  }

  // Find stops for path computations
  console.log('\n\nSearching for stops...');

  const stDenisStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-denis') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  const stPierreStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-pierre') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  const stLouisStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-louis') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  console.log(`\nFound ${stDenisStops?.length || 0} stops matching "Gare De St-Denis":`);
  stDenisStops?.forEach(stop => console.log(`  - ${stop.stop_name} (${stop.stop_id})`));

  console.log(`\nFound ${stPierreStops?.length || 0} stops matching "Gare De St-Pierre":`);
  stPierreStops?.forEach(stop => console.log(`  - ${stop.stop_name} (${stop.stop_id})`));

  console.log(`\nFound ${stLouisStops?.length || 0} stops matching "Gare St-Louis":`);
  stLouisStops?.forEach(stop => console.log(`  - ${stop.stop_name} (${stop.stop_id})`));

  // PATH 1: Gare De St-Denis to Gare De St-Pierre
  console.log('\n\n=== PATH COMPUTATION 1 ===');
  if (!stDenisStops || stDenisStops.length === 0 || !stPierreStops || stPierreStops.length === 0) {
    console.log('Cannot compute path 1: One or both stops not found.');
  } else {
    console.log(`Finding paths from ${stDenisStops[0].stop_name} to ${stPierreStops[0].stop_name}...`);

    const paths1 = graphBuilder.findAllPaths(
      stDenisStops[0].stop_id,
      stPierreStops[0].stop_id
    );

    console.log(`\nFound ${paths1.length} path(s):\n`);

    if (paths1.length === 0) {
      console.log('No paths found between these stops.');
    } else {
      // Display simplified paths (groups consecutive segments on same route/direction)
      paths1.forEach((path, index) => {
        displaySimplifiedPath(gtfs, path, index + 1);
      });

      // Find scheduled trips for each path
      console.log('\n--- SCHEDULED TRIPS ---\n');
      console.log(`Searching for scheduled trips departing after ${testTime}...\n`);

      paths1.forEach((path, index) => {
        const journey = GraphBuilder.findScheduledTrips(
          gtfs,
          path,
          testDate,
          testTimeSeconds,
          minTransferDuration
        );

        if (journey) {
          displayScheduledJourney(gtfs, journey, index + 1);
        } else {
          console.log(`\n  Path ${index + 1}: No scheduled trips found for this path\n`);
        }
      });
    }
  }

  // PATH 2: Gare St-Louis to Gare De St-Pierre
  console.log('\n=== PATH COMPUTATION 2 ===');
  if (!stLouisStops || stLouisStops.length === 0 || !stPierreStops || stPierreStops.length === 0) {
    console.log('Cannot compute path 2: One or both stops not found.');
  } else {
    console.log(`Finding paths from ${stLouisStops[0].stop_name} to ${stPierreStops[0].stop_name}...`);

    const paths2 = graphBuilder.findAllPaths(
      stLouisStops[0].stop_id,
      stPierreStops[0].stop_id
    );

    console.log(`\nFound ${paths2.length} path(s):\n`);

    if (paths2.length === 0) {
      console.log('No paths found between these stops.');
    } else {
      // Display simplified paths (groups consecutive segments on same route/direction)
      paths2.forEach((path, index) => {
        displaySimplifiedPath(gtfs, path, index + 1);
      });

      // Find scheduled trips for each path
      console.log('\n--- SCHEDULED TRIPS ---\n');
      console.log(`Searching for scheduled trips departing after ${testTime}...\n`);

      paths2.forEach((path, index) => {
        const journey = GraphBuilder.findScheduledTrips(
          gtfs,
          path,
          testDate,
          testTimeSeconds,
          minTransferDuration
        );

        if (journey) {
          displayScheduledJourney(gtfs, journey, index + 1);
        } else {
          console.log(`\n  Path ${index + 1}: No scheduled trips found for this path\n`);
        }
      });
    }
  }
}

main().catch(console.error);
