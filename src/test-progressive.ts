import { GtfsSqlJs } from 'gtfs-sqljs';
import { GraphBuilder, ScheduledJourney } from './graph-builder';
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
 * Display a single scheduled journey concisely
 */
function displayJourney(gtfs: GtfsSqlJs, journey: ScheduledJourney, index: number): void {
  console.log(`  Journey ${index}:`);
  console.log(`    ${secondsToTime(journey.departureTime)} → ${secondsToTime(journey.arrivalTime)} (${Math.floor(journey.totalDuration / 60)} min, ${journey.legs.length} leg(s))`);

  journey.legs.forEach((leg, legIdx) => {
    const fromStops = gtfs.getStops({ stopId: leg.startStop });
    const toStops = gtfs.getStops({ stopId: leg.endStop });
    const fromName = fromStops?.[0]?.stop_name || leg.startStop;
    const toName = toStops?.[0]?.stop_name || leg.endStop;

    console.log(`      Leg ${legIdx + 1}: ${fromName} → ${toName} [${leg.routeShortName}/${leg.tripShortName}]`);
  });
}

async function main() {
  // Test parameters
  const testDate = '20251110'; // 2025-11-10
  const testTime = '13:55:00';
  const testTimeSeconds = 13 * 3600 + 55 * 60; // 50100 seconds
  const minTransferDuration = 5 * 60; // 5 minutes = 300 seconds

  console.log('='.repeat(80));
  console.log('PROGRESSIVE ROUTE TEST: St-Paul to St-Pierre');
  console.log('='.repeat(80));
  console.log(`Date: ${testDate} | Time: ${testTime} | Min Transfer: ${minTransferDuration / 60} min\n`);

  // Load GTFS data
  const gtfsPath = path.join(__dirname, '..', 'data', 'car-jaune.gtfs.zip');
  console.log('Loading GTFS data...');
  const gtfs = await GtfsSqlJs.fromZip(gtfsPath, {
    onProgress: (progress) => {
      if (progress.percentComplete % 25 === 0) {
        console.log(`  ${progress.percentComplete}%`);
      }
    }
  });
  console.log('GTFS data loaded!\n');

  // Get all routes sorted by route_short_name
  const allRoutes = gtfs.getRoutes();
  if (!allRoutes) {
    console.log('No routes found!');
    return;
  }

  const sortedRoutes = allRoutes.sort((a, b) => {
    const nameA = a.route_short_name || a.route_id;
    const nameB = b.route_short_name || b.route_id;
    return nameA.localeCompare(nameB, undefined, { numeric: true });
  });

  console.log(`Total routes available: ${sortedRoutes.length}`);
  console.log(`Routes: ${sortedRoutes.map(r => r.route_short_name || r.route_id).join(', ')}\n`);

  // Find St-Paul and St-Pierre stops
  const stPaulStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-paul') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  const stPierreStops = gtfs.getStops()?.filter(stop =>
    stop.stop_name.toLowerCase().includes('st-pierre') &&
    stop.stop_name.toLowerCase().includes('gare')
  );

  if (!stPaulStops || stPaulStops.length === 0) {
    console.log('St-Paul stop not found!');
    return;
  }

  if (!stPierreStops || stPierreStops.length === 0) {
    console.log('St-Pierre stop not found!');
    return;
  }

  const fromStop = stPaulStops[0];
  const toStop = stPierreStops[0];

  console.log(`From: ${fromStop.stop_name} (${fromStop.stop_id})`);
  console.log(`To: ${toStop.stop_name} (${toStop.stop_id})\n`);

  console.log('='.repeat(80));

  // Test with 8, 9, 10, ..., all routes
  const startRoutes = 8;
  const maxRoutes = sortedRoutes.length; // Test all routes

  for (let numRoutes = startRoutes; numRoutes <= maxRoutes; numRoutes++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST ${numRoutes}: Using ${numRoutes} route(s)`);
    console.log('='.repeat(80));

    const routesToTest = sortedRoutes.slice(0, numRoutes);
    console.log(`Routes: ${routesToTest.map(r => r.route_short_name || r.route_id).join(', ')}`);

    // Build graph
    const startTime = Date.now();
    const graphBuilder = new GraphBuilder(gtfs);

    for (const route of routesToTest) {
      graphBuilder.buildGraphForRoute(route.route_id, testDate);
    }

    const buildTime = Date.now() - startTime;

    console.log(`\nGraph built in ${buildTime}ms`);
    console.log(`  Nodes: ${graphBuilder.getNodes().length}`);
    console.log(`  Edges: ${graphBuilder.getEdges().length}`);

    // Find paths (limit to 100 paths, max 3 transfers)
    const pathStartTime = Date.now();
    const paths = graphBuilder.findAllPaths(fromStop.stop_id, toStop.stop_id, 100, 3);
    const pathTime = Date.now() - pathStartTime;

    console.log(`\nPath finding completed in ${pathTime}ms`);
    console.log(`  Found ${paths.length} path(s)`);

    if (paths.length === 0) {
      console.log('  No paths found between these stops.');
      continue;
    }

    // Show first 2 paths (or all if less than 2)
    const pathsToShow = Math.min(2, paths.length);
    console.log(`  Showing first ${pathsToShow} path(s):\n`);

    for (let i = 0; i < pathsToShow; i++) {
      const path = paths[i];
      const legs = GraphBuilder.pathToTripLegs(path);

      console.log(`  Path ${i + 1}: ${legs.length} leg(s)`);
      legs.forEach((leg, legIdx) => {
        const fromStops = gtfs.getStops({ stopId: leg.startStop });
        const toStops = gtfs.getStops({ stopId: leg.endStop });
        const fromName = fromStops?.[0]?.stop_name || leg.startStop;
        const toName = toStops?.[0]?.stop_name || leg.endStop;

        console.log(`    ${legIdx + 1}. ${fromName} → ${toName} [Route ${leg.routeId}, Dir ${leg.directionId}]`);
      });
      console.log('');
    }

    // Find scheduled trips for first 2 paths
    console.log(`Scheduled Trips (departing after ${testTime}):\n`);

    let foundCount = 0;
    for (let i = 0; i < pathsToShow; i++) {
      const scheduleStartTime = Date.now();
      const journey = GraphBuilder.findScheduledTrips(
        gtfs,
        paths[i],
        testDate,
        testTimeSeconds,
        minTransferDuration
      );
      const scheduleTime = Date.now() - scheduleStartTime;

      if (journey) {
        displayJourney(gtfs, journey, i + 1);
        console.log(`    (found in ${scheduleTime}ms)\n`);
        foundCount++;
      } else {
        console.log(`  Journey ${i + 1}: No scheduled trips found (checked in ${scheduleTime}ms)\n`);
      }
    }

    if (foundCount === 0) {
      console.log('  No scheduled journeys found for any path.');
    }

    console.log(`\nSummary for ${numRoutes} route(s):`);
    console.log(`  Build time: ${buildTime}ms`);
    console.log(`  Path finding: ${pathTime}ms`);
    console.log(`  Total paths: ${paths.length}`);
    console.log(`  Scheduled journeys: ${foundCount}/${pathsToShow}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('PROGRESSIVE TEST COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
