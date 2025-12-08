function drawCanvas() {
    if (!state.ctx || !state.img) return;
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    state.ctx.drawImage(state.img, 0, 0, state.canvas.width, state.canvas.height);
    
    // Draw waypoint discovery circles
    const waypointsToShow = state.currentMode === 'tsp' ? state.markers.Waypoints : state.gw2Waypoints;
    waypointsToShow.forEach(w => {
        state.ctx.strokeStyle = '#9f7aea';
        state.ctx.lineWidth = 2;
        state.ctx.setLineDash([5, 5]);
        state.ctx.globalAlpha = 0.5;
        state.ctx.beginPath();
        state.ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        state.ctx.stroke();
        
        state.ctx.fillStyle = 'rgba(159, 122, 234, 0.1)';
        state.ctx.fill();
    });
    state.ctx.globalAlpha = 1.0;
    state.ctx.setLineDash([]);
    
    const routeToDraw = state.previewRoute.length > 0 ? state.previewRoute : state.optimalRoute;
    const isPreview = state.previewRoute.length > 0;
    
    if (state.WaypointDiscoveryMode && routeToDraw.length > 0) {
        const discoveredWaypoints = new Set();
        
        for (let i = 0; i < routeToDraw.length; i++) {
            const point = routeToDraw[i];
            updateDiscoveredWaypointsGeneric(point, discoveredWaypoints);
            
            if (i > 0) {
                const prevPoint = routeToDraw[i - 1];
                for (const Waypoint of waypointsToShow) {
                    if (!discoveredWaypoints.has(Waypoint) && 
                        lineSegmentIntersectsCircle(prevPoint, point, Waypoint, Waypoint.radius)) {
                        discoveredWaypoints.add(Waypoint);
                    }
                }
            }
        }
        
        for (const Waypoint of discoveredWaypoints) {
            state.ctx.strokeStyle = '#48bb78';
            state.ctx.lineWidth = 3;
            state.ctx.setLineDash([5, 5]);
            state.ctx.beginPath();
            state.ctx.arc(Waypoint.x, Waypoint.y, Waypoint.radius, 0, Math.PI * 2);
            state.ctx.stroke();
            
            state.ctx.fillStyle = '#48bb78';
            state.ctx.font = 'bold 16px Arial';
            state.ctx.fillText('✓', Waypoint.x + Waypoint.radius + 5, Waypoint.y - Waypoint.radius);
        }
        state.ctx.setLineDash([]);
    }
    
    if (routeToDraw.length > 0) {
        state.ctx.strokeStyle = isPreview ? '#4299e1' : '#f56565';
        state.ctx.lineWidth = isPreview ? 3 : 4;
        state.ctx.setLineDash(isPreview ? [4, 4] : [8, 8]);
        state.ctx.globalAlpha = isPreview ? 0.7 : 0.8;
        
        for (let i = 0; i < routeToDraw.length - 1; i++) {
            const current = routeToDraw[i];
            const next = routeToDraw[i + 1];
            const isWaypointType = (state.currentMode === 'tsp' && next.type === 'Waypoint') || 
                                  (state.currentMode === 'gw2' && next.type === 'waypoint');
            if (isWaypointType && !next.explicitVisit) continue;
            
            state.ctx.beginPath();
            state.ctx.moveTo(current.x, current.y);
            state.ctx.lineTo(next.x, next.y);
            state.ctx.stroke();
        }
        
        state.ctx.globalAlpha = 1.0;
        state.ctx.setLineDash([]);
        
        for (let i = 0; i < routeToDraw.length - 1; i++) {
            const current = routeToDraw[i];
            const next = routeToDraw[i + 1];
            const isWaypointType = (state.currentMode === 'tsp' && next.type === 'Waypoint') || 
                                  (state.currentMode === 'gw2' && next.type === 'waypoint');
            if (isWaypointType && !next.explicitVisit) {
                const text = `⚡ W${next.id + 1}`;
                const textPos = findBestTextPosition(current, next, text, routeToDraw);
                state.ctx.save();
                state.ctx.font = 'bold 14px Arial';
                state.ctx.fillStyle = isPreview ? '#4299e1' : '#9f7aea';
                state.ctx.strokeStyle = 'white';
                state.ctx.lineWidth = 3;
                state.ctx.strokeText(text, textPos.x, textPos.y);
                state.ctx.fillText(text, textPos.x, textPos.y);
                state.ctx.restore();
            }
        }
    }
}

function findBestTextPosition(origin, Waypoint, text, route) {
    const dx = Waypoint.x - origin.x;
    const dy = Waypoint.y - origin.y;
    const angle = Math.atan2(dy, dx);
    const positions = [
        { offset: 35, angleOffset: 0 },
        { offset: 35, angleOffset: Math.PI / 2 },
        { offset: 35, angleOffset: -Math.PI / 2 },
        { offset: 35, angleOffset: Math.PI },
        { offset: 50, angleOffset: Math.PI / 4 },
        { offset: 50, angleOffset: -Math.PI / 4 },
        { offset: 50, angleOffset: 3 * Math.PI / 4 },
        { offset: 50, angleOffset: -3 * Math.PI / 4 },
    ];
    state.ctx.font = 'bold 14px Arial';
    const textMetrics = state.ctx.measureText(text);
    const textWidth = textMetrics.width;
    const allMarkers = [state.markers.start, ...state.markers.ends, ...state.markers.Markers, ...state.markers.Waypoints, ...route].filter(m => m);
    
    for (const pos of positions) {
        const testAngle = angle + pos.angleOffset;
        const testX = origin.x + Math.cos(testAngle) * pos.offset;
        const testY = origin.y + Math.sin(testAngle) * pos.offset;
        let hasCollision = false;
        const markerRadius = 20;
        
        for (const marker of allMarkers) {
            const dist = Math.sqrt(Math.pow(testX - marker.x, 2) + Math.pow(testY - marker.y, 2));
            if (dist < markerRadius + textWidth / 2) {
                hasCollision = true;
                break;
            }
        }
        if (!hasCollision) return { x: testX, y: testY };
    }
    return { x: origin.x + Math.cos(angle) * 60, y: origin.y + Math.sin(angle) * 60 };
}
