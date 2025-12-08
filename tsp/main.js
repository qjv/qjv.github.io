// Main calculation entry point
function calculatePath() {
    if (state.currentMode === 'tsp') {
        if (!state.markers.start) {
            alert('Please set a start point');
            return;
        }
        if (state.endpointMode === 'and' && state.markers.ends.length > 0 && state.markers.Waypoints.length === 0) {
            alert('AND mode requires at least one Waypoint to handle mandatory teleportation from endpoints!');
            return;
        }
        if (state.markers.Markers.length > 25 && !confirm(`You have ${state.markers.Markers.length} Markers. Continue?`)) return;
    } else {
        // GW2 mode validation
        if (!state.markers.gw2Start) {
            alert('Please set a start point');
            return;
        }
        
        let totalPoints = 0;
        Object.keys(state.markers.gw2).forEach(type => {
            totalPoints += state.markers.gw2[type].length;
        });
        
        if (totalPoints === 0) {
            alert('Please place at least one marker on the map');
            return;
        }
        
        // Check if requirements are met
        let unmetRequirements = [];
        Object.keys(state.gw2Requirements).forEach(type => {
            const required = state.gw2Requirements[type];
            if (required === 0) return; // Skip if 0 (optional)
            const available = state.markers.gw2[type].length;
            if (required > available) {
                const markerDef = GW2_MARKERS.find(m => m.type === type);
                unmetRequirements.push(`${markerDef.name}: need ${required}, have ${available}`);
            }
        });
        
        if (unmetRequirements.length > 0) {
            alert('Requirements not met:\n' + unmetRequirements.join('\n'));
            return;
        }
    }
    
    clearDistanceCache();
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsContent = document.getElementById('resultsContent');
    resultsPanel.classList.add('active');
    resultsContent.innerHTML = '<div class="computing"><div class="computing-spinner">⚙️</div><p>Computing routes...</p></div>';
    
    setTimeout(() => {
        try {
            const results = runAllAlgorithms();
            displayResults(results);
            if (!resultsContent.classList.contains('expanded')) toggleResults();
        } catch (error) {
            console.error('Error computing routes:', error);
            resultsContent.innerHTML = '<div class="computing"><p style="color: #f56565;">Error computing routes.</p></div>';
        }
    }, 100);
}

function runAllAlgorithms() {
    if (state.currentMode === 'gw2') {
        return runGW2Algorithms();
    }
    
    const start = state.markers.start;
    const Markers = state.markers.Markers;
    let scenarios = [];
    
    if (state.endpointMode === 'or' && state.markers.ends.length > 0) {
        state.markers.ends.forEach(end => {
            scenarios.push({ destination: end, pointsToVisit: [...Markers] });
        });
    } else if (state.endpointMode === 'and') {
        scenarios.push({ destination: null, pointsToVisit: [...Markers, ...state.markers.ends] });
    } else {
        scenarios.push({ destination: state.markers.ends.length > 0 ? state.markers.ends[0] : null, pointsToVisit: [...Markers] });
    }

    const runAlgorithm = (algoName, algoFunc) => {
        let bestForAlgo = null;
        let minAlgoDist = Infinity;
        scenarios.forEach(scenario => {
            const rawPath = algoFunc(start, scenario.destination, scenario.pointsToVisit);
            const processedPath = insertWaypointsInPath(rawPath);
            const dist = calculatePathDistance(processedPath);
            if (dist < minAlgoDist) {
                minAlgoDist = dist;
                bestForAlgo = { name: algoName, path: processedPath, distance: dist };
            }
        });
        return bestForAlgo;
    };

    const results = [];
    const pointCount = Math.max(...scenarios.map(s => s.pointsToVisit.length));

    if (pointCount <= 7) results.push(runAlgorithm('Brute Force (Optimal)', bruteForceAllPoints));
    results.push(runAlgorithm('Nearest Neighbor', nearestNeighborAllPoints));
    if (pointCount <= 20) {
        results.push(runAlgorithm('Nearest Neighbor + 2-Opt', (s, e, p) => twoOptImprove(nearestNeighborAllPoints(s, e, p))));
    }
    results.push(runAlgorithm('Greedy Insertion', greedyInsertion));
    const attempts = pointCount <= 10 ? 15 : pointCount <= 15 ? 10 : 5;
    results.push(runAlgorithm(`Random Restart (${attempts}x)`, (s, e, p) => randomRestart(s, e, p, attempts)));
    
    return results;
}

function runGW2Algorithms() {
    if (!state.markers.gw2Start) {
        alert('Please set a start point');
        return [];
    }
    
    // Collect required points with smart subset selection
    let bestSubset = null;
    let bestSubsetDist = Infinity;
    const numAttempts = 20; // Try 20 different random subsets
    
    for (let attempt = 0; attempt < numAttempts; attempt++) {
        let candidatePoints = [];
        
        Object.keys(state.markers.gw2).forEach(type => {
            const required = state.gw2Requirements[type];
            const available = state.markers.gw2[type];
            
            if (required > 0 && available.length > 0) {
                if (required >= available.length) {
                    // Must visit all
                    candidatePoints.push(...available);
                } else {
                    // Choose random subset
                    const shuffled = [...available].sort(() => Math.random() - 0.5);
                    candidatePoints.push(...shuffled.slice(0, required));
                }
            }
        });
        
        // Add waypoints if required
        const waypointRequirement = state.gw2Requirements['waypoint'] || 0;
        if (waypointRequirement > 0 && state.gw2Waypoints.length > 0) {
            if (waypointRequirement >= state.gw2Waypoints.length) {
                candidatePoints.push(...state.gw2Waypoints);
            } else {
                const shuffled = [...state.gw2Waypoints].sort(() => Math.random() - 0.5);
                candidatePoints.push(...shuffled.slice(0, waypointRequirement));
            }
        }
        
        if (candidatePoints.length === 0) continue;
        
        // Quick distance estimate for this subset
        const start = state.markers.gw2Start;
        let estimatedDist = 0;
        let current = start;
        const remaining = [...candidatePoints];
        
        while (remaining.length > 0) {
            let nearest = null;
            let minDist = Infinity;
            let nearestIdx = -1;
            
            for (let i = 0; i < remaining.length; i++) {
                const dist = euclideanDistance(current, remaining[i]);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = remaining[i];
                    nearestIdx = i;
                }
            }
            
            estimatedDist += minDist;
            current = nearest;
            remaining.splice(nearestIdx, 1);
        }
        
        // Add distance to end if exists
        if (state.markers.gw2Ends.length > 0) {
            const distToEnd = Math.min(...state.markers.gw2Ends.map(e => euclideanDistance(current, e)));
            estimatedDist += distToEnd;
        }
        
        if (estimatedDist < bestSubsetDist) {
            bestSubsetDist = estimatedDist;
            bestSubset = candidatePoints;
        }
    }
    
    if (!bestSubset || bestSubset.length === 0) {
        alert('No points to visit. Set "Required" > 0 for at least one marker type.');
        return [];
    }
    
    const pointsToVisit = bestSubset;
    const start = state.markers.gw2Start;
    const ends = state.markers.gw2Ends;
    
    // Temporarily set TSP markers for algorithm to use
    const oldStart = state.markers.start;
    const oldEnds = state.markers.ends;
    const oldMarkers = state.markers.Markers;
    const oldWaypoints = state.markers.Waypoints;
    
    state.markers.start = start;
    state.markers.ends = ends;
    state.markers.Markers = pointsToVisit;
    state.markers.Waypoints = state.gw2Waypoints;
    
    let scenarios = [];
    if (ends.length > 0) {
        ends.forEach(end => {
            scenarios.push({ destination: end, pointsToVisit: [...pointsToVisit] });
        });
    } else {
        scenarios.push({ destination: null, pointsToVisit: [...pointsToVisit] });
    }

    const runAlgorithm = (algoName, algoFunc) => {
        let bestForAlgo = null;
        let minAlgoDist = Infinity;
        scenarios.forEach(scenario => {
            const rawPath = algoFunc(start, scenario.destination, scenario.pointsToVisit);
            const processedPath = insertWaypointsInPathGeneric(rawPath);
            const dist = calculatePathDistanceGeneric(processedPath);
            if (dist < minAlgoDist) {
                minAlgoDist = dist;
                bestForAlgo = { name: algoName, path: processedPath, distance: dist };
            }
        });
        return bestForAlgo;
    };

    const results = [];
    const pointCount = Math.max(...scenarios.map(s => s.pointsToVisit.length));

    if (pointCount <= 7) results.push(runAlgorithm('Brute Force (Optimal)', bruteForceAllPoints));
    results.push(runAlgorithm('Nearest Neighbor', nearestNeighborAllPoints));
    if (pointCount <= 20) {
        results.push(runAlgorithm('Nearest Neighbor + 2-Opt', (s, e, p) => twoOptImprove(nearestNeighborAllPoints(s, e, p))));
    }
    results.push(runAlgorithm('Greedy Insertion', greedyInsertion));
    const attempts = pointCount <= 10 ? 15 : pointCount <= 15 ? 10 : 5;
    results.push(runAlgorithm(`Random Restart (${attempts}x)`, (s, e, p) => randomRestart(s, e, p, attempts)));
    
    // Restore TSP markers
    state.markers.start = oldStart;
    state.markers.ends = oldEnds;
    state.markers.Markers = oldMarkers;
    state.markers.Waypoints = oldWaypoints;
    
    return results;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    updateLegend();
});
