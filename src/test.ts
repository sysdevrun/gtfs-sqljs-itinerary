import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder } from './graph-builder';
import * as path from 'path';

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

  // Find route with short name O1
  const allRoutes = gtfs.getRoutes();
  const routes = allRoutes?.filter(r => r.route_short_name === 'O1');

  if (!routes || routes.length === 0) {
    console.log('\nRoute O1 not found!');
    return;
  }

  const routeO1 = routes[0];
  console.log(`\nFound route: ${routeO1.route_short_name} - ${routeO1.route_long_name}`);
  console.log(`Route ID: ${routeO1.route_id}`);

  // Create graph builder
  console.log('\nBuilding graph for route O1...');
  const graphBuilder = new GraphBuilder(gtfs);

  // Build graph for route O1
  graphBuilder.buildGraphForRoute(routeO1.route_id);

  // Get edges for route O1
  const edgesO1 = graphBuilder.getEdgesForRoute(routeO1.route_id);

  console.log(`\nGraph for route O1:`);
  console.log(`Total nodes: ${graphBuilder.getNodes().length}`);
  console.log(`Total edges: ${edgesO1.length}`);

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

  // Find stops for "Gare De St-Denis" and "Gare De St-Pierre"
  console.log('\n\nSearching for stops...');

  const stDenisStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-denis') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  const stPierreStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-pierre') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  console.log(`\nFound ${stDenisStops?.length || 0} stops matching "Gare De St-Denis":`);
  stDenisStops?.forEach(stop => console.log(`  - ${stop.stop_name} (${stop.stop_id})`));

  console.log(`\nFound ${stPierreStops?.length || 0} stops matching "Gare De St-Pierre":`);
  stPierreStops?.forEach(stop => console.log(`  - ${stop.stop_name} (${stop.stop_id})`));

  if (!stDenisStops || stDenisStops.length === 0 || !stPierreStops || stPierreStops.length === 0) {
    console.log('\nCannot find paths: One or both stops not found.');
    return;
  }

  // Try finding paths on route O1 only (already built)
  console.log(`\nFinding paths from ${stDenisStops[0].stop_name} to ${stPierreStops[0].stop_name} on route O1...`);

  const paths = graphBuilder.findAllPaths(
    stDenisStops[0].stop_id,
    stPierreStops[0].stop_id
  );

  console.log(`\nFound ${paths.length} path(s) on route O1:\n`);

  paths.forEach((path, index) => {
    console.log(`Path ${index + 1}:`);
    path.forEach((segment, segIndex) => {
      // Get stop names
      const fromStops = gtfs.getStops({ stopId: segment.startStop });
      const toStops = gtfs.getStops({ stopId: segment.endStop });

      const fromName = fromStops?.[0]?.stop_name || segment.startStop;
      const toName = toStops?.[0]?.stop_name || segment.endStop;

      // Get route info
      const routesForSegment = gtfs.getRoutes({ routeId: segment.routeId });
      const routeName = routesForSegment?.[0]?.route_short_name || segment.routeId;

      console.log(
        `  ${segIndex + 1}. ${fromName} -> ${toName} (Route ${routeName}, Direction ${segment.directionId})`
      );
    });
    console.log('');
  });

  if (paths.length === 0) {
    console.log('No paths found between these stops on route O1.');
    console.log('\nNote: To search for paths across all routes, the full graph would need to be built,');
    console.log('but this requires significant memory. The current demo only searches within route O1.');
  }
}

main().catch(console.error);
