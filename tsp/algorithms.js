// Distance calculation
function euclideanDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function clearDistanceCache() {
    state.distanceCache.clear();
}

// Line-circle intersection for waypoint discovery
function lineSegmentIntersectsCircle(p1, p2, center, radius) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - center.x;
    const fy = p1.y - center.y;
    
    const a = dx * dx + dy * dy;
    if (a < 0.001) return euclideanDistance(p1, center) <= radius;
    
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - radius * radius;
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return false;
    
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

// Waypoint discovery functions
function updateDiscoveredWaypoints(point, discoveredWaypoints) {
    if (!state.WaypointDiscoveryMode) {
        state.markers.Waypoints.forEach(w => discoveredWaypoints.add(w));
        return;
    }
    for (const Waypoint of state.markers.Waypoints) {
        if (euclideanDistance(point, Waypoint) <= Waypoint.radius) {
            discoveredWaypoints.add(Waypoint);
        }
    }
}

function updateDiscoveredWaypointsGeneric(point, discoveredWaypoints) {
    const waypointsToCheck = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    if (!state.WaypointDiscoveryMode) {
        waypointsToCheck.forEach(w => discoveredWaypoints.add(w));
        return;
    }
    for (const Waypoint of waypointsToCheck) {
        if (euclideanDistance(point, Waypoint) <= Waypoint.radius) {
            discoveredWaypoints.add(Waypoint);
        }
    }
}

function updateDiscoveriesAlongSegment(p1, p2, discoveredWaypoints) {
    if (!state.WaypointDiscoveryMode) return;
    for (const Waypoint of state.markers.Waypoints) {
        if (!discoveredWaypoints.has(Waypoint) && 
            lineSegmentIntersectsCircle(p1, p2, Waypoint, Waypoint.radius)) {
            discoveredWaypoints.add(Waypoint);
        }
    }
}

function updateDiscoveriesAlongSegmentGeneric(p1, p2, discoveredWaypoints) {
    if (!state.WaypointDiscoveryMode) return;
    const waypointsToCheck = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    for (const Waypoint of waypointsToCheck) {
        if (!discoveredWaypoints.has(Waypoint) && 
            lineSegmentIntersectsCircle(p1, p2, Waypoint, Waypoint.radius)) {
            discoveredWaypoints.add(Waypoint);
        }
    }
}

function isWaypointDiscovered(Waypoint, discoveredWaypoints) {
    return !state.WaypointDiscoveryMode || discoveredWaypoints.has(Waypoint);
}

function isWaypointDiscoveredGeneric(Waypoint, discoveredWaypoints) {
    return !state.WaypointDiscoveryMode || discoveredWaypoints.has(Waypoint);
}

function estimateWaypointValue(waypoint, remainingPoints, discoveredWaypoints) {
    if (isWaypointDiscovered(waypoint, discoveredWaypoints)) return 0;
    
    let potentialSavings = 0;
    const pointsArray = Array.from(remainingPoints);
    
    for (let i = 0; i < pointsArray.length; i++) {
        for (let j = i + 1; j < pointsArray.length; j++) {
            const directDist = euclideanDistance(pointsArray[i], pointsArray[j]);
            const viaWaypointDist = TELEPORT_COST + euclideanDistance(waypoint, pointsArray[j]);
            const saving = Math.max(0, directDist - viaWaypointDist);
            potentialSavings += saving * 0.2;
        }
    }
    
    return potentialSavings;
}

// Distance calculation with waypoint discovery
function distanceWithDiscovery(p1, p2, discoveredWaypoints) {
    if (p1.type === 'Waypoint') return euclideanDistance(p1, p2);

    let bestDist = euclideanDistance(p1, p2);
    if (state.endpointMode === 'and' && p1.type === 'end' && state.markers.Waypoints.length > 0) {
        bestDist = Infinity;
    }
    
    if (p2.type === 'Waypoint' && p2.explicitVisit) {
        return euclideanDistance(p1, p2);
    }
    
    if (p2.type === 'Waypoint') {
        return isWaypointDiscovered(p2, discoveredWaypoints) ? TELEPORT_COST : 999999;
    }
    
    if (state.markers.Waypoints.length === 0) return bestDist;

    for (const Waypoint of state.markers.Waypoints) {
        if (!isWaypointDiscovered(Waypoint, discoveredWaypoints)) continue;
        const totalViaWaypoint = TELEPORT_COST + euclideanDistance(Waypoint, p2);
        if (totalViaWaypoint < bestDist) {
            bestDist = totalViaWaypoint;
        }
    }
    return bestDist;
}

function distanceWithDiscoveryGeneric(p1, p2, discoveredWaypoints) {
    const isP1Waypoint = (p1.type === 'Waypoint' || p1.type === 'waypoint');
    const isP2Waypoint = (p2.type === 'Waypoint' || p2.type === 'waypoint');
    
    if (isP1Waypoint) return euclideanDistance(p1, p2);

    let bestDist = euclideanDistance(p1, p2);
    
    if (isP2Waypoint && p2.explicitVisit) {
        return euclideanDistance(p1, p2);
    }
    
    if (isP2Waypoint) {
        return isWaypointDiscoveredGeneric(p2, discoveredWaypoints) ? TELEPORT_COST : 999999;
    }
    
    const waypointsToUse = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    if (waypointsToUse.length === 0) return bestDist;

    for (const Waypoint of waypointsToUse) {
        if (!isWaypointDiscoveredGeneric(Waypoint, discoveredWaypoints)) continue;
        const totalViaWaypoint = TELEPORT_COST + euclideanDistance(Waypoint, p2);
        if (totalViaWaypoint < bestDist) {
            bestDist = totalViaWaypoint;
        }
    }
    return bestDist;
}

function findBestWaypoint(p1, p2, discoveredWaypoints) {
    if (p1.type === 'Waypoint' || p2.type === 'Waypoint') return null;
    
    let directDist = euclideanDistance(p1, p2);
    if (state.endpointMode === 'and' && p1.type === 'end' && state.markers.Waypoints.length > 0) {
        directDist = Infinity;
    }
    
    let bestWaypoint = null;
    let bestDist = directDist;
    
    for (const Waypoint of state.markers.Waypoints) {
        if (!isWaypointDiscovered(Waypoint, discoveredWaypoints)) continue;
        const WaypointPath = TELEPORT_COST + euclideanDistance(Waypoint, p2);
        if (WaypointPath < bestDist) {
            bestDist = WaypointPath;
            bestWaypoint = Waypoint;
        }
    }
    return bestWaypoint;
}

function findBestWaypointGeneric(p1, p2, discoveredWaypoints) {
    const isP1Waypoint = (p1.type === 'Waypoint' || p1.type === 'waypoint');
    const isP2Waypoint = (p2.type === 'Waypoint' || p2.type === 'waypoint');
    if (isP1Waypoint || isP2Waypoint) return null;
    
    let directDist = euclideanDistance(p1, p2);
    
    let bestWaypoint = null;
    let bestDist = directDist;
    
    const waypointsToUse = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    for (const Waypoint of waypointsToUse) {
        if (!isWaypointDiscoveredGeneric(Waypoint, discoveredWaypoints)) continue;
        const WaypointPath = TELEPORT_COST + euclideanDistance(Waypoint, p2);
        if (WaypointPath < bestDist) {
            bestDist = WaypointPath;
            bestWaypoint = Waypoint;
        }
    }
    return bestWaypoint;
}

function insertWaypointsInPath(path) {
    const discoveredWaypoints = new Set();
    if (!state.WaypointDiscoveryMode) state.markers.Waypoints.forEach(w => discoveredWaypoints.add(w));
    
    const newPath = [path[0]];
    updateDiscoveredWaypoints(path[0], discoveredWaypoints);
    
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const current = path[i];
        
        if (current.type === 'Waypoint' && current.explicitVisit) {
            newPath.push(current);
            updateDiscoveredWaypoints(current, discoveredWaypoints);
            continue;
        }
        
        const Waypoint = findBestWaypoint(prev, current, discoveredWaypoints);
        
        if (Waypoint) {
            newPath.push(Waypoint);
        }
        
        updateDiscoveriesAlongSegment(prev, current, discoveredWaypoints);
        
        newPath.push(current);
        updateDiscoveredWaypoints(current, discoveredWaypoints);
    }
    return newPath;
}

function insertWaypointsInPathGeneric(path) {
    const waypointsToUse = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    const discoveredWaypoints = new Set();
    if (!state.WaypointDiscoveryMode) waypointsToUse.forEach(w => discoveredWaypoints.add(w));
    
    const newPath = [path[0]];
    updateDiscoveredWaypointsGeneric(path[0], discoveredWaypoints);
    
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const current = path[i];
        
        const isWaypointType = (current.type === 'Waypoint' || current.type === 'waypoint');
        if (isWaypointType && current.explicitVisit) {
            newPath.push(current);
            updateDiscoveredWaypointsGeneric(current, discoveredWaypoints);
            continue;
        }
        
        const Waypoint = findBestWaypointGeneric(prev, current, discoveredWaypoints);
        
        if (Waypoint) {
            newPath.push(Waypoint);
        }
        
        updateDiscoveriesAlongSegmentGeneric(prev, current, discoveredWaypoints);
        
        newPath.push(current);
        updateDiscoveredWaypointsGeneric(current, discoveredWaypoints);
    }
    return newPath;
}

function calculatePathDistance(path) {
    if (!path || path.length < 2) return 0;
    state.suppressDiscoveryLogs = true;
    let total = 0;
    const discoveredWaypoints = new Set();
    if (!state.WaypointDiscoveryMode) state.markers.Waypoints.forEach(w => discoveredWaypoints.add(w));
    
    for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i + 1];
        
        updateDiscoveredWaypoints(current, discoveredWaypoints);
        total += distanceWithDiscovery(current, next, discoveredWaypoints);
        updateDiscoveriesAlongSegment(current, next, discoveredWaypoints);
    }
    state.suppressDiscoveryLogs = false;
    return total;
}

function calculatePathDistanceGeneric(path) {
    if (!path || path.length < 2) return 0;
    state.suppressDiscoveryLogs = true;
    let total = 0;
    const waypointsToUse = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    const discoveredWaypoints = new Set();
    if (!state.WaypointDiscoveryMode) waypointsToUse.forEach(w => discoveredWaypoints.add(w));
    
    for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i + 1];
        
        updateDiscoveredWaypointsGeneric(current, discoveredWaypoints);
        total += distanceWithDiscoveryGeneric(current, next, discoveredWaypoints);
        updateDiscoveriesAlongSegmentGeneric(current, next, discoveredWaypoints);
    }
    state.suppressDiscoveryLogs = false;
    return total;
}

// TSP Algorithms
function bruteForceAllPoints(start, end, points) {
    if (points.length === 0) return end ? [start, end] : [start];
    let bestPath = null, bestDist = Infinity, permCount = 0;
    const maxPerms = 50000;
    
    function permute(remaining, currentPath) {
        if (++permCount > maxPerms) return;
        if (remaining.length === 0) {
            const fullPath = end ? [...currentPath, end] : currentPath;
            const dist = state.currentMode === 'gw2' ? calculatePathDistanceGeneric(fullPath) : calculatePathDistance(fullPath);
            if (dist < bestDist) { bestDist = dist; bestPath = fullPath; }
            return;
        }
        for (let i = 0; i < remaining.length; i++) {
            const next = remaining[i];
            permute(remaining.filter((_, idx) => idx !== i), [...currentPath, next]);
        }
    }
    permute(points, [start]);
    return bestPath || [start, ...(end ? [end] : [])];
}

function nearestNeighborAllPoints(start, end, points) {
    if (points.length === 0) return end ? [start, end] : [start];
    const path = [start];
    let current = start;
    const remaining = new Set(points);
    const discoveredWaypoints = new Set();
    updateDiscoveredWaypoints(current, discoveredWaypoints);
    
    while (remaining.size > 0) {
        let nearest = null, minDist = Infinity;
        let bestWaypointDetour = null;
        
        for (const point of remaining) {
            const directDist = distanceWithDiscovery(current, point, discoveredWaypoints);
            
            if (state.WaypointDiscoveryMode) {
                for (const waypoint of state.markers.Waypoints) {
                    if (!isWaypointDiscovered(waypoint, discoveredWaypoints)) {
                        const detourDist = euclideanDistance(current, waypoint) + euclideanDistance(waypoint, point);
                        const futureSavings = estimateWaypointValue(waypoint, remaining, discoveredWaypoints);
                        const effectiveCost = detourDist - (futureSavings / remaining.size);
                        
                        if (effectiveCost < directDist && effectiveCost < minDist) {
                            minDist = effectiveCost;
                            nearest = point;
                            bestWaypointDetour = waypoint;
                        }
                    }
                }
            }
            
            if (directDist < minDist) {
                minDist = directDist;
                nearest = point;
                bestWaypointDetour = null;
            }
        }
        
        if (nearest) {
            if (bestWaypointDetour) {
                const waypointCopy = { ...bestWaypointDetour, explicitVisit: true };
                path.push(waypointCopy);
                current = waypointCopy;
                updateDiscoveredWaypoints(current, discoveredWaypoints);
            }
            
            updateDiscoveriesAlongSegment(current, nearest, discoveredWaypoints);
            path.push(nearest);
            current = nearest;
            updateDiscoveredWaypoints(current, discoveredWaypoints);
            remaining.delete(nearest);
        }
    }
    if (end) path.push(end);
    return path;
}

function twoOptImprove(path) {
    if (path.length < 4) return path;
    let improved = true, bestPath = [...path], iterations = 0;
    const maxIterations = Math.min(50, path.length * 2);
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        for (let i = 1; i < bestPath.length - 2; i++) {
            for (let j = i + 1; j < bestPath.length - 1; j++) {
                const currentCost = calculatePathDistance(bestPath);
                const newPath = [...bestPath];
                newPath.splice(i, j - i + 1, ...newPath.slice(i, j + 1).reverse());
                const newCost = calculatePathDistance(newPath);
                
                if (newCost < currentCost) {
                    bestPath = newPath;
                    improved = true;
                }
            }
        }
    }
    return bestPath;
}

function greedyInsertion(start, end, points) {
    if (points.length === 0) return end ? [start, end] : [start];
    const path = [start, points[0]];
    if (end) path.push(end);
    const remaining = new Set(points.slice(1));
    const discoveredWaypoints = new Set();
    updateDiscoveredWaypoints(start, discoveredWaypoints);
    updateDiscoveriesAlongSegment(start, points[0], discoveredWaypoints);
    updateDiscoveredWaypoints(points[0], discoveredWaypoints);
    let totalChecks = 0;
    const MAX_CHECKS = 10000;
    
    while (remaining.size > 0) {
        let bestPoint = null, bestPosition = -1, bestIncrease = Infinity;
        let bestWaypointDetour = null, bestWaypointPosition = -1;
        
        for (const point of remaining) {
            const maxPos = end ? path.length - 1 : path.length;
            for (let i = 1; i < maxPos; i++) {
                totalChecks++;
                if (totalChecks > MAX_CHECKS) {
                    const insertPos = end ? path.length - 1 : path.length;
                    Array.from(remaining).forEach(p => path.splice(insertPos, 0, p));
                    return path;
                }
                const before = path[i - 1], after = path[i];
                const currentDist = distanceWithDiscovery(before, after, discoveredWaypoints);
                const newDist = distanceWithDiscovery(before, point, discoveredWaypoints) + 
                              distanceWithDiscovery(point, after, discoveredWaypoints);
                const increase = newDist - currentDist;
                
                if (state.WaypointDiscoveryMode) {
                    for (const waypoint of state.markers.Waypoints) {
                        if (!isWaypointDiscovered(waypoint, discoveredWaypoints)) {
                            const detourDist = euclideanDistance(before, waypoint) + 
                                              euclideanDistance(waypoint, point) + 
                                              distanceWithDiscovery(point, after, discoveredWaypoints);
                            const futureSavings = estimateWaypointValue(waypoint, remaining, discoveredWaypoints);
                            const effectiveIncrease = (detourDist - currentDist) - (futureSavings / remaining.size);
                            
                            if (effectiveIncrease < bestIncrease) {
                                bestIncrease = effectiveIncrease;
                                bestPoint = point;
                                bestPosition = i;
                                bestWaypointDetour = waypoint;
                                bestWaypointPosition = i;
                            }
                        }
                    }
                }
                
                if (increase < bestIncrease) {
                    bestIncrease = increase;
                    bestPoint = point;
                    bestPosition = i;
                    bestWaypointDetour = null;
                }
            }
        }
        
        if (bestPoint) {
            if (bestWaypointDetour) {
                const waypointCopy = { ...bestWaypointDetour, explicitVisit: true };
                path.splice(bestWaypointPosition, 0, waypointCopy);
                updateDiscoveredWaypoints(waypointCopy, discoveredWaypoints);
                if (bestPosition >= bestWaypointPosition) bestPosition++;
            }
            
            const before = path[bestPosition - 1];
            updateDiscoveriesAlongSegment(before, bestPoint, discoveredWaypoints);
            path.splice(bestPosition, 0, bestPoint);
            updateDiscoveredWaypoints(bestPoint, discoveredWaypoints);
            remaining.delete(bestPoint);
        } else {
            const insertPos = end ? path.length - 1 : path.length;
            Array.from(remaining).forEach(p => path.splice(insertPos, 0, p));
            break;
        }
    }
    return path;
}

function randomRestart(start, end, points, attempts) {
    if (points.length === 0) return end ? [start, end] : [start];
    let bestPath = null, bestDist = Infinity;
    
    for (let attempt = 0; attempt < attempts; attempt++) {
        let attemptBestPath = null, attemptBestDist = Infinity;
        const shuffled = [...points].sort(() => Math.random() - 0.5);
        
        for (let run = 0; run < 3; run++) {
            const path = end ? [start, ...shuffled, end] : [start, ...shuffled];
            const improved = twoOptImprove(path);
            const dist = calculatePathDistance(improved);
            if (dist < attemptBestDist) {
                attemptBestDist = dist;
                attemptBestPath = improved;
            }
        }
        if (attemptBestDist < bestDist) {
            bestDist = attemptBestDist;
            bestPath = attemptBestPath;
        }
    }
    return bestPath || [start, ...(end ? [end] : [])];
}
