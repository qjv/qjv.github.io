// GW2 Marker Definitions
const GW2_MARKERS = [
    { type: 'start', name: 'Start', icon: null, color: '#48bb78', isSpecial: true },
    { type: 'end', name: 'End', icon: null, color: '#f56565', isSpecial: true },
    { type: 'waypoint', name: 'Waypoint', icon: 'https://wiki.guildwars2.com/images/d/d2/Waypoint_%28map_icon%29.png', color: '#4299e1' },
    { type: 'heart', name: 'Heart', icon: 'https://wiki.guildwars2.com/images/f/f8/Complete_heart_%28map_icon%29.png', color: '#f56565' },
    { type: 'scout', name: 'Scout', icon: 'https://wiki.guildwars2.com/images/f/fe/Scout_%28map_icon%29.png', color: '#48bb78' },
    { type: 'vista', name: 'Vista', icon: 'https://wiki.guildwars2.com/images/f/ff/Vista_%28map_icon%29.png', color: '#9f7aea' },
    { type: 'poi', name: 'Point of Interest', icon: 'https://wiki.guildwars2.com/images/7/70/Point_of_interest_%28map_icon%29.png', color: '#ed8936' },
    { type: 'dodge', name: 'Dodge', icon: 'https://wiki.guildwars2.com/images/c/cc/Dodge_Instructor.png', color: '#38b2ac' },
    { type: 'event', name: 'Possible Event', icon: 'https://wiki.guildwars2.com/images/b/bc/Event_star_%28map_icon%29.png', color: '#ecc94b' },
    { type: 'harvest', name: 'Harvest', icon: 'https://wiki.guildwars2.com/images/b/b2/Harvesting_Collection_Box_%28map_icon%29.png', color: '#68d391' },
    { type: 'mining', name: 'Mining', icon: 'https://wiki.guildwars2.com/images/7/79/Mining_Collection_Box_%28map_icon%29.png', color: '#a0aec0' },
    { type: 'logging', name: 'Logging', icon: 'https://wiki.guildwars2.com/images/d/d8/Logging_Collection_Box_%28map_icon%29.png', color: '#975a16' }
];

// Constants
const TELEPORT_COST = 0;

// Global State
const state = {
    currentMode: 'tsp',
    canvas: null,
    ctx: null,
    img: null,
    markers: {
        start: null,
        ends: [],
        Markers: [],
        Waypoints: [],
        gw2: {},
        gw2Start: null,
        gw2Ends: []
    },
    gw2Requirements: {},
    gw2Waypoints: [],
    optimalRoute: [],
    previewRoute: [],
    allResults: [],
    markerElements: [],
    selectedMarkerType: 'start',
    endpointMode: 'or',
    WaypointDiscoveryMode: false,
    resizingWaypoint: null,
    isDraggingRadius: false,
    distanceCache: new Map(),
    suppressDiscoveryLogs: false
};

// Initialize GW2 markers and requirements
GW2_MARKERS.forEach(m => {
    if (!m.isSpecial) {
        state.markers.gw2[m.type] = [];
        state.gw2Requirements[m.type] = 0;
    }
});
