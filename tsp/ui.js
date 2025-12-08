// Mode switching
function switchMode(mode) {
    state.currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.mode-content').forEach(content => content.classList.remove('active'));
    
    if (mode === 'tsp') {
        document.querySelector('.mode-tab:nth-child(1)').classList.add('active');
        document.getElementById('tsp-mode').classList.add('active');
        state.selectedMarkerType = 'start';
        document.querySelectorAll('#tspMarkerSelector .marker-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('#tspMarkerSelector .marker-type-btn.start').classList.add('active');
    } else {
        document.querySelector('.mode-tab:nth-child(2)').classList.add('active');
        document.getElementById('gw2-mode').classList.add('active');
        initGW2MarkerSelector();
        state.selectedMarkerType = 'waypoint';
    }
    updateLegend();
    clearAll();
}

// Marker type selection
function selectMarkerType(type) {
    state.selectedMarkerType = type;
    document.querySelectorAll('#tspMarkerSelector .marker-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#tspMarkerSelector .marker-type-btn.${type}`).classList.add('active');
}

function selectGW2MarkerType(type) {
    state.selectedMarkerType = type;
    document.querySelectorAll('.gw2-marker-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// GW2 marker selector initialization
function initGW2MarkerSelector() {
    const container = document.getElementById('gw2MarkerSelector');
    container.innerHTML = '';
    
    GW2_MARKERS.forEach(markerDef => {
        const item = document.createElement('div');
        item.className = 'gw2-marker-item';
        if (state.selectedMarkerType === markerDef.type) item.classList.add('active');
        item.onclick = () => selectGW2MarkerType(markerDef.type);
        
        let iconHtml = '';
        if (markerDef.icon) {
            iconHtml = `<img class="marker-icon" src="${markerDef.icon}" alt="${markerDef.name}">`;
        } else {
            iconHtml = `<div class="marker-icon dot" style="background: ${markerDef.color};"></div>`;
        }
        
        let requirementHtml = '';
        if (!markerDef.isSpecial) {
            requirementHtml = `
                <div class="gw2-required-input">
                    <label>Required:</label>
                    <input type="number" min="0" value="${state.gw2Requirements[markerDef.type]}" 
                           onclick="event.stopPropagation()" 
                           onchange="updateGW2Requirement('${markerDef.type}', this.value)">
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="gw2-marker-header">
                ${iconHtml}
                <span class="gw2-marker-name">${markerDef.name}</span>
            </div>
            ${requirementHtml}
        `;
        
        container.appendChild(item);
    });
}

function updateGW2Requirement(type, value) {
    state.gw2Requirements[type] = parseInt(value) || 0;
}

// Options toggles
function toggleWaypointDiscovery() {
    state.WaypointDiscoveryMode = document.getElementById('WaypointDiscovery').checked;
    state.optimalRoute = [];
    state.previewRoute = [];
    state.allResults = [];
    document.getElementById('resultsPanel').classList.remove('active');
    drawCanvas();
}

function toggleWaypointDiscoveryGW2() {
    state.WaypointDiscoveryMode = document.getElementById('WaypointDiscoveryGW2').checked;
    state.optimalRoute = [];
    state.previewRoute = [];
    state.allResults = [];
    document.getElementById('resultsPanel').classList.remove('active');
    drawCanvas();
}

function selectEndpointMode(mode) {
    state.endpointMode = mode;
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    const description = document.getElementById('modeDescription');
    if (mode === 'or') {
        description.textContent = 'Choose best endpoint to finish';
    } else {
        description.textContent = 'Visit all endpoints (Obligatory teleport after each)';
    }
}

function updateEndpointModeVisibility() {
    const selector = document.getElementById('endpointModeSelector');
    if (state.currentMode === 'tsp' && state.markers.ends.length > 1) {
        selector.style.display = 'flex';
    } else {
        selector.style.display = 'none';
    }
}

// Results panel
function toggleResults() {
    const content = document.getElementById('resultsContent');
    const icon = document.getElementById('toggleIcon');
    content.classList.toggle('expanded');
    icon.classList.toggle('expanded');
}

function previewResult(index) {
    if (state.allResults[index]) {
        state.previewRoute = state.allResults[index].path;
        drawCanvas();
    }
}

function clearPreview() {
    state.previewRoute = [];
    drawCanvas();
}

function displayResults(results) {
    const resultsContent = document.getElementById('resultsContent');
    state.allResults = results;
    const bestResult = results.reduce((best, current) => current.distance < best.distance ? current : best);
    state.optimalRoute = bestResult.path;
    state.previewRoute = [];
    drawCanvas();
    
    let html = '';
    results.forEach((result, index) => {
        const isBest = result === bestResult;
        const routeStr = formatRoute(result.path);
        html += `
            <div class="method-result ${isBest ? 'best' : ''}" 
                 data-result-index="${index}"
                 onmouseenter="previewResult(${index})"
                 onmouseleave="clearPreview()">
                <div class="method-name">
                    <span>${result.name}</span>
                    ${isBest ? '<span class="badge">BEST</span>' : ''}
                </div>
                <div class="method-distance">${result.distance.toFixed(2)} pixels</div>
                <div class="method-route">${routeStr}</div>
            </div>`;
    });
    resultsContent.innerHTML = html;
}

function formatRoute(path) {
    return path.map(point => {
        if (point.type === 'start') return 'Start';
        if (point.type === 'end') return `E${point.id + 1}`;
        if (point.type === 'Waypoint') {
            return point.explicitVisit ? `🚶W${point.id + 1}` : `⚡W${point.id + 1}`;
        }
        if (point.type === 'waypoint') {
            return point.explicitVisit ? `🚶WP${point.id + 1}` : `⚡WP${point.id + 1}`;
        }
        if (point.type === 'Marker') return `P${point.id + 1}`;
        
        // GW2 markers
        const markerDef = GW2_MARKERS.find(m => m.type === point.type);
        if (markerDef) {
            const prefix = markerDef.name.split(' ').map(w => w[0]).join('');
            return `${prefix}${point.id + 1}`;
        }
        return `?${point.id + 1}`;
    }).join(' → ');
}

// Legend update
function updateLegend() {
    const legend = document.getElementById('legend');
    if (state.currentMode === 'tsp') {
        legend.innerHTML = `
            <div class="legend-item">
                <div class="marker-icon dot" style="background: #48bb78;"></div>
                <span>Start (required)</span>
            </div>
            <div class="legend-item">
                <div class="marker-icon dot" style="background: #f56565;"></div>
                <span>End</span>
            </div>
            <div class="legend-item">
                <div class="marker-icon dot" style="background: #4299e1;"></div>
                <span>Markers</span>
            </div>
            <div class="legend-item">
                <div class="marker-icon dot Waypoint" style="background: #9f7aea;"></div>
                <span>Waypoints (Drag to resize • ✓ = discovered)</span>
            </div>
            <div class="legend-item" style="margin-left: auto; font-style: italic; color: #666;">
                <span>💡 Hover over results to preview routes</span>
            </div>
        `;
    } else {
        let html = '';
        
        // Start/End
        if (state.markers.gw2Start) {
            html += `
                <div class="legend-item">
                    <div class="marker-icon dot" style="background: #48bb78;"></div>
                    <span>Start: 1</span>
                </div>
            `;
        }
        if (state.markers.gw2Ends.length > 0) {
            html += `
                <div class="legend-item">
                    <div class="marker-icon dot" style="background: #f56565;"></div>
                    <span>End: ${state.markers.gw2Ends.length}</span>
                </div>
            `;
        }
        
        // Waypoints
        if (state.gw2Waypoints.length > 0) {
            html += `
                <div class="legend-item">
                    <img class="marker-icon" src="https://wiki.guildwars2.com/images/d/d2/Waypoint_%28map_icon%29.png" alt="Waypoint">
                    <span>Waypoints: ${state.gw2Waypoints.length}</span>
                </div>
            `;
        }
        
        // Other markers
        GW2_MARKERS.forEach(m => {
            if (m.isSpecial) return;
            if (m.type === 'waypoint') return; // Already handled
            const count = state.markers.gw2[m.type] ? state.markers.gw2[m.type].length : 0;
            if (count === 0 && state.gw2Requirements[m.type] === 0) return;
            const required = state.gw2Requirements[m.type];
            html += `
                <div class="legend-item">
                    <img class="marker-icon" src="${m.icon}" alt="${m.name}">
                    <span>${m.name}: ${count}${required > 0 ? ` (req: ${required})` : ''}</span>
                </div>
            `;
        });
        legend.innerHTML = html;
    }
}

// Image loading
function loadImageFromUrl() {
    const url = document.getElementById('imageUrl').value.trim();
    if (!url) {
        alert('Please enter an image URL');
        return;
    }
    loadImage(url);
}

function loadImageFromUrlGW2() {
    const url = document.getElementById('imageUrlGW2').value.trim();
    if (!url) {
        alert('Please enter an image URL');
        return;
    }
    loadImage(url);
}

function loadImage(url) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
        state.img = image;
        initCanvas();
    };
    image.onerror = () => {
        // Try without CORS
        const image2 = new Image();
        image2.onload = () => {
            state.img = image2;
            initCanvas();
        };
        image2.onerror = () => {
            alert('Failed to load image. Try uploading it instead.');
        };
        image2.src = url;
    };
    image.src = url;
}

function loadImageFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const image = new Image();
        image.onload = () => {
            state.img = image;
            initCanvas();
        };
        image.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function loadImageFromFileGW2(event) {
    loadImageFromFile(event);
}

// Canvas initialization
function initCanvas() {
    if (state.currentMode === 'tsp') {
        state.markers = {
            start: null,
            ends: [],
            Markers: [],
            Waypoints: [],
            gw2: state.markers.gw2,
            gw2Start: state.markers.gw2Start,
            gw2Ends: state.markers.gw2Ends
        };
    } else {
        const oldGw2 = state.markers.gw2;
        state.markers.gw2 = {};
        GW2_MARKERS.forEach(m => {
            if (!m.isSpecial) state.markers.gw2[m.type] = [];
        });
        state.markers.gw2Start = null;
        state.markers.gw2Ends = [];
        state.gw2Waypoints = [];
    }
    
    state.optimalRoute = [];
    state.previewRoute = [];
    state.allResults = [];
    document.getElementById('resultsPanel').classList.remove('active');
    updateEndpointModeVisibility();
    
    const container = document.getElementById('canvasContainer');
    container.innerHTML = '';
    state.markerElements = [];
    
    state.canvas = document.createElement('canvas');
    const maxWidth = container.clientWidth - 20;
    const maxHeight = 600;
    let width = state.img.width;
    let height = state.img.height;
    
    if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
    }
    if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
    }
    
    state.canvas.width = width;
    state.canvas.height = height;
    state.ctx = state.canvas.getContext('2d');
    container.appendChild(state.canvas);
    drawCanvas();
    state.canvas.addEventListener('click', handleCanvasClick);
    updateLegend();
}

// Canvas click handler
function handleCanvasClick(e) {
    const rect = state.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (state.currentMode === 'tsp') {
        if (state.selectedMarkerType === 'start') {
            if (state.markers.start) removeMarker('start', null);
            state.markers.start = { x, y, type: 'start' };
            createMarkerElement('start', x, y);
        } else if (state.selectedMarkerType === 'end') {
            const id = state.markers.ends.length;
            state.markers.ends.push({ x, y, id, type: 'end' });
            createMarkerElement('end', x, y, id);
            updateEndpointModeVisibility();
        } else if (state.selectedMarkerType === 'Marker') {
            const id = state.markers.Markers.length;
            state.markers.Markers.push({ x, y, id, type: 'Marker' });
            createMarkerElement('Marker', x, y, id);
        } else if (state.selectedMarkerType === 'Waypoint') {
            const id = state.markers.Waypoints.length;
            state.markers.Waypoints.push({ x, y, id, type: 'Waypoint', radius: 30 });
            createMarkerElement('Waypoint', x, y, id);
            drawCanvas();
        }
    } else {
        // GW2 mode
        if (state.selectedMarkerType === 'start') {
            if (state.markers.gw2Start) removeGW2Marker('start', null);
            state.markers.gw2Start = { x, y, type: 'start' };
            createGW2MarkerElement('start', x, y, null);
        } else if (state.selectedMarkerType === 'end') {
            const id = state.markers.gw2Ends.length;
            state.markers.gw2Ends.push({ x, y, id, type: 'end' });
            createGW2MarkerElement('end', x, y, id);
        } else if (state.selectedMarkerType === 'waypoint') {
            const id = state.gw2Waypoints.length;
            state.gw2Waypoints.push({ x, y, id, type: 'waypoint', radius: 30 });
            createGW2MarkerElement('waypoint', x, y, id, true);
            drawCanvas();
        } else {
            const markerType = state.selectedMarkerType;
            const id = state.markers.gw2[markerType].length;
            state.markers.gw2[markerType].push({ x, y, id, type: markerType });
            createGW2MarkerElement(markerType, x, y, id);
        }
        updateLegend();
    }
}

// Waypoint resize handlers
function onWaypointResize(e) {
    if (!state.resizingWaypoint) return;
    state.isDraggingRadius = true;
    
    const rect = state.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dist = Math.sqrt(Math.pow(mouseX - state.resizingWaypoint.x, 2) + Math.pow(mouseY - state.resizingWaypoint.y, 2));
    state.resizingWaypoint.radius = Math.max(15, dist);
    
    drawCanvas();
}

function onWaypointResizeEnd() {
    state.resizingWaypoint = null;
    document.removeEventListener('mousemove', onWaypointResize);
    document.removeEventListener('mouseup', onWaypointResizeEnd);
    setTimeout(() => {
        state.isDraggingRadius = false;
    }, 50);
}

// Marker creation
function createMarkerElement(type, x, y, id = null) {
    const container = document.getElementById('canvasContainer');
    const rect = state.canvas.getBoundingClientRect();
    const marker = document.createElement('div');
    marker.className = `marker ${type}`;
    marker.style.left = (rect.left - container.getBoundingClientRect().left + x) + 'px';
    marker.style.top = (rect.top - container.getBoundingClientRect().top + y) + 'px';
    marker.dataset.type = type;
    
    if (type === 'Marker') {
        marker.dataset.id = id;
        marker.textContent = id + 1;
    } else if (type === 'Waypoint') {
        marker.dataset.id = id;
        marker.textContent = 'W' + (id + 1);
        
        marker.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            
            state.resizingWaypoint = state.markers.Waypoints.find(w => w.id === id);
            state.isDraggingRadius = false;
            
            document.addEventListener('mousemove', onWaypointResize);
            document.addEventListener('mouseup', onWaypointResizeEnd);
        });
    } else if (type === 'end') {
        marker.dataset.id = id;
        marker.textContent = 'E' + (id + 1);
    }
    
    marker.addEventListener('click', function(e) {
        e.stopPropagation();
        if (type === 'Waypoint' && state.isDraggingRadius) {
            return;
        }
        removeMarker(type, id);
    });
    container.appendChild(marker);
    state.markerElements.push(marker);
}

function createGW2MarkerElement(type, x, y, id, isWaypoint = false) {
    const container = document.getElementById('canvasContainer');
    const rect = state.canvas.getBoundingClientRect();
    const marker = document.createElement('div');
    marker.className = `marker gw2`;
    if (type === 'waypoint' && isWaypoint) {
        marker.classList.add('Waypoint');
        marker.style.cursor = 'ns-resize';
    }
    marker.style.left = (rect.left - container.getBoundingClientRect().left + x) + 'px';
    marker.style.top = (rect.top - container.getBoundingClientRect().top + y) + 'px';
    marker.dataset.type = type;
    if (id !== null) marker.dataset.id = id;
    
    const markerDef = GW2_MARKERS.find(m => m.type === type);
    
    if (markerDef.icon) {
        const img = document.createElement('img');
        img.src = markerDef.icon;
        img.style.width = '28px';
        img.style.height = '28px';
        marker.appendChild(img);
    } else {
        // Special markers (start/end)
        marker.style.background = markerDef.color;
        marker.style.border = '3px solid white';
        marker.style.width = '28px';
        marker.style.height = '28px';
        marker.style.borderRadius = '50%';
        if (type === 'start') {
            marker.textContent = 'S';
        } else if (type === 'end') {
            marker.textContent = 'E' + (id + 1);
        }
    }
    
    // Add resize handler for waypoints
    if (type === 'waypoint' && isWaypoint) {
        marker.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            
            state.resizingWaypoint = state.gw2Waypoints.find(w => w.id === id);
            state.isDraggingRadius = false;
            
            document.addEventListener('mousemove', onWaypointResize);
            document.addEventListener('mouseup', onWaypointResizeEnd);
        });
    }
    
    marker.addEventListener('click', function(e) {
        e.stopPropagation();
        if (type === 'waypoint' && state.isDraggingRadius) {
            return;
        }
        removeGW2Marker(type, id);
    });
    
    container.appendChild(marker);
    state.markerElements.push(marker);
}

// Marker removal
function removeMarker(type, id = null) {
    const container = document.getElementById('canvasContainer');
    if (type === 'start') {
        state.markers.start = null;
        const element = container.querySelector('.marker.start');
        if (element) element.remove();
    } else if (type === 'end') {
        const idx = state.markers.ends.findIndex(e => e.id === id);
        if (idx !== -1) {
            state.markers.ends.splice(idx, 1);
            container.querySelectorAll('.marker.end').forEach(el => el.remove());
            state.markers.ends.forEach((e, i) => {
                e.id = i;
                createMarkerElement('end', e.x, e.y, i);
            });
        }
        updateEndpointModeVisibility();
    } else if (type === 'Marker') {
        const idx = state.markers.Markers.findIndex(w => w.id === id);
        if (idx !== -1) {
            state.markers.Markers.splice(idx, 1);
            container.querySelectorAll('.marker.Marker').forEach(el => el.remove());
            state.markers.Markers.forEach((w, i) => {
                w.id = i;
                createMarkerElement('Marker', w.x, w.y, i);
            });
        }
    } else if (type === 'Waypoint') {
        const idx = state.markers.Waypoints.findIndex(w => w.id === id);
        if (idx !== -1) {
            state.markers.Waypoints.splice(idx, 1);
            container.querySelectorAll('.marker.Waypoint').forEach(el => el.remove());
            state.markers.Waypoints.forEach((w, i) => {
                w.id = i;
                createMarkerElement('Waypoint', w.x, w.y, i);
            });
        }
    }
    state.optimalRoute = [];
    state.previewRoute = [];
    state.allResults = [];
    document.getElementById('resultsPanel').classList.remove('active');
    drawCanvas();
}

function removeGW2Marker(type, id) {
    const container = document.getElementById('canvasContainer');
    
    if (type === 'start') {
        state.markers.gw2Start = null;
        const element = container.querySelector('.marker.gw2[data-type="start"]');
        if (element) element.remove();
    } else if (type === 'end') {
        const idx = state.markers.gw2Ends.findIndex(e => e.id === id);
        if (idx !== -1) {
            state.markers.gw2Ends.splice(idx, 1);
            container.querySelectorAll('.marker.gw2[data-type="end"]').forEach(el => el.remove());
            state.markers.gw2Ends.forEach((e, i) => {
                e.id = i;
                createGW2MarkerElement('end', e.x, e.y, i);
            });
        }
    } else if (type === 'waypoint') {
        const idx = state.gw2Waypoints.findIndex(w => w.id === id);
        if (idx !== -1) {
            state.gw2Waypoints.splice(idx, 1);
            container.querySelectorAll('.marker.gw2[data-type="waypoint"]').forEach(el => el.remove());
            state.gw2Waypoints.forEach((w, i) => {
                w.id = i;
                createGW2MarkerElement('waypoint', w.x, w.y, i, true);
            });
        }
    } else {
        const idx = state.markers.gw2[type].findIndex(m => m.id === id);
        if (idx !== -1) {
            state.markers.gw2[type].splice(idx, 1);
            container.querySelectorAll(`.marker.gw2[data-type="${type}"]`).forEach(el => el.remove());
            state.markers.gw2[type].forEach((m, i) => {
                m.id = i;
                createGW2MarkerElement(type, m.x, m.y, i);
            });
        }
    }
    
    state.optimalRoute = [];
    state.previewRoute = [];
    state.allResults = [];
    document.getElementById('resultsPanel').classList.remove('active');
    updateLegend();
    drawCanvas();
}

function clearAll() {
    const container = document.getElementById('canvasContainer');
    container.querySelectorAll('.marker').forEach(m => m.remove());
    if (state.currentMode === 'tsp') {
        state.markers = {
            start: null,
            ends: [],
            Markers: [],
            Waypoints: [],
            gw2: state.markers.gw2,
            gw2Start: state.markers.gw2Start,
            gw2Ends: state.markers.gw2Ends
        };
    } else {
        state.markers.gw2 = {};
        GW2_MARKERS.forEach(m => {
            if (!m.isSpecial) state.markers.gw2[m.type] = [];
        });
        state.markers.gw2Start = null;
        state.markers.gw2Ends = [];
        state.gw2Waypoints = [];
    }
    state.markerElements = [];
    state.optimalRoute = [];
    state.previewRoute = [];
    state.allResults = [];
    document.getElementById('resultsPanel').classList.remove('active');
    updateEndpointModeVisibility();
    updateLegend();
    if (state.img) drawCanvas();
}
