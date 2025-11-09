import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder, PathSegment, SimplifiedTrip } from './graph-builder';
import * as path from 'path';

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

async function main() {
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
  const graphBuilder = new GraphBuilder(gtfs);

  // Add both routes to the same graph (enables transfers between routes)
  graphBuilder.buildGraphForRoute(routeO1.route_id);
  graphBuilder.buildGraphForRoute(routeS4.route_id);

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
    }
  }
}

main().catch(console.error);
