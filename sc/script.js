// Initialize
const input = document.getElementById('markdown-input');
const preview = document.getElementById('preview');
const reviewOverlay = document.getElementById('review-overlay');
const suggestionTooltip = document.getElementById('suggestion-tooltip');
const modal = document.getElementById('armory-modal');
const armoryList = document.getElementById('armory-list');
const armorySearch = document.getElementById('armory-search');
const statusBar = document.getElementById('status-bar');

const CACHE_KEY_DATA = 'sc_editor_gw2_data';
const CACHE_KEY_BUILD = 'sc_editor_gw2_build';

// Session-based ignore lists
let sessionIgnoreList = new Set(); // Palavras ignoradas globalmente (Skip All)
let skippedInstances = new Map();  // Ocorrências específicas ignoradas (Skip This) -> Map<Word, Set<Index>>

// GW2 API data cache
let gw2Data = {
    items: [],
    skills: [],
    traits: [],
    waypoints: [],
    specializations: [],
    loaded: false,
    loading: false
};

// Traitline modal state
let currentTraitSelections = {
    spec: null,
    trait1: null,
    trait2: null,
    trait3: null
};

// Review Mode State
let reviewState = {
    active: false,
    matches: [] 
};

// Status Bar Helper
function setStatus(msg, type = 'normal') {
    statusBar.textContent = msg;
    if (type === 'error') statusBar.style.color = '#ef4444';
    else if (type === 'success') statusBar.style.color = '#10b981';
    else statusBar.style.color = '#64748b';
    if (type === 'success') setTimeout(() => setStatus('Ready'), 4000);
}

// -------------------
// REAL-TIME & MANUAL SCAN
// -------------------

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function runScan(fromInput = false) {
    const suggestSC = document.getElementById('suggest-sc').checked;
    
    // Load GW2 data if needed
    if (!gw2Data.loaded && (document.getElementById('suggest-skills').checked || 
        document.getElementById('suggest-items').checked || 
        document.getElementById('suggest-traits').checked)) {
        if (!fromInput) await loadGW2Data(); 
        else return;
    }
    
    const isAutoReplace = document.getElementById('auto-replace').checked;
    const text = input.value;
    const matches = findMatches(text, suggestSC);
    
    reviewState.matches = matches;

    if (fromInput && matches.length === 0) {
        if (reviewState.active) cancelReviewMode();
        return;
    }

    if (!fromInput && matches.length === 0) {
        setStatus("No matches found.", "normal");
        return;
    }

    if (isAutoReplace) {
        const uniqueMatches = matches.filter(m => m.candidates.length === 1);
        if (uniqueMatches.length > 0) {
            performAutoReplacement(uniqueMatches);
            const newText = input.value;
            const newMatches = findMatches(newText, suggestSC);
            reviewState.matches = newMatches;
        }
    }

    if (reviewState.matches.length > 0) {
        startReviewMode();
    } else if (reviewState.active) {
        cancelReviewMode();
    }
}

function performAutoReplacement(matches) {
    let text = input.value;
    matches.sort((a, b) => b.start - a.start);
    
    input.focus();
    // Select all text to support proper Undo history
    input.select();
    
    // Construct new text locally
    let newText = text;
    // We need to rebuild it carefully or use the execCommand on specific ranges.
    // However, execCommand 'insertText' works on selection.
    // For bulk replace, it's safer to replace the whole content to keep history simple (1 undo step).
    
    matches.forEach(m => {
        const selected = m.candidates[0];
        const tag = selected.source === 'sc' 
            ? '[sc:' + selected.id + ']' + selected.name + '[/sc]'
            : '[gw2:' + selected.id + ':' + selected.type + ']';
        newText = newText.substring(0, m.start) + tag + newText.substring(m.end);
    });

    const oldLength = input.value.length;
    const cursor = input.selectionStart;

    document.execCommand('insertText', false, newText);

    const newLength = newText.length;
    const newCursor = cursor + (newLength - oldLength); // Aproximado
    input.setSelectionRange(newCursor, newCursor);
    
    updatePreview();
}

function startReviewMode() {
    reviewState.active = true;
    renderReviewOverlay(input.value, reviewState.matches);
    reviewOverlay.style.display = 'block';
    
    if(reviewState.matches.length > 0) {
        setStatus("Suggestions found (" + reviewState.matches.length + ")", "normal");
    }
}

function manualScan() {
    // Reset skipped instances on manual scan if desired, 
    // but usually user wants to keep skips until page reload.
    // We keep them.
    runScan(false);
}

function cancelReviewMode() {
    reviewState.active = false;
    reviewState.matches = [];
    reviewOverlay.style.display = 'none';
    suggestionTooltip.classList.remove('active');
}

// -------------------
// MATCHING LOGIC
// -------------------

function findMatches(text, includeSC = true) {
    const allData = [];
    
    // Add GW2 data
    const suggestSkills = document.getElementById('suggest-skills').checked;
    const suggestItems = document.getElementById('suggest-items').checked;
    const suggestTraits = document.getElementById('suggest-traits').checked;
    
    if (gw2Data.loaded) {
        if (suggestSkills) gw2Data.skills.forEach(s => allData.push({...s, type: 'skill', source: 'gw2'}));
        if (suggestItems) gw2Data.items.forEach(i => allData.push({...i, type: 'item', source: 'gw2'}));
        if (suggestTraits) gw2Data.traits.forEach(t => allData.push({...t, type: 'trait', source: 'gw2'}));
    }
    
    // Add SC armory data
    if (includeSC && typeof armoryData !== 'undefined') {
        armoryData.forEach(a => allData.push({...a, type: 'sc', source: 'sc'}));
    }
    
    const nameMap = new Map();
    allData.forEach(d => {
        if(!d.name) return;
        const normalizedName = d.name.toLowerCase();
        
        // GLOBAL SKIP CHECK
        if (sessionIgnoreList.has(normalizedName)) return;
        
        if (!nameMap.has(d.name)) nameMap.set(d.name, []);
        nameMap.get(d.name).push(d);
    });

    // Identify Forbidden Ranges (Tags)
    const forbiddenRanges = [];
    const ignorePatterns = [
        /\[sc:.*?\[\/sc\]/g,
        /\[gw2:.*?\]/g,
        /\[wp:.*?\[\/wp\]/g,
        /\[traitline:.*?\]/g,
        /`[^`]+`/g // Ignora blocos de código inline também
    ];

    ignorePatterns.forEach(pattern => {
        let tagMatch;
        pattern.lastIndex = 0; 
        while ((tagMatch = pattern.exec(text)) !== null) {
            forbiddenRanges.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
        }
    });

    const isForbidden = (start, end) => {
        return forbiddenRanges.some(r => 
            (start >= r.start && start < r.end) || 
            (end > r.start && end <= r.end) ||     
            (start <= r.start && end >= r.end)     
        );
    };

    const matches = [];
    const safeMode = document.getElementById('safe-mode').checked;
    const sortedNames = Array.from(nameMap.keys()).sort((a, b) => b.length - a.length);

    // Map to track occurrence counts for "Skip Instance" logic
    // Key: CleanName, Value: Counter
    const occurrenceCounters = new Map();

    sortedNames.forEach(name => {
        const candidates = nameMap.get(name);
        const regexStr = safeMode ? '<(' + escapeRegex(name) + ')>' : '\\b(' + escapeRegex(name) + ')\\b';
        const regex = new RegExp(regexStr, 'gi');
        
        // Reset counter for this word
        occurrenceCounters.set(name, 0);

        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            
            // Check Forbidden / Overlap
            const overlapsMatch = matches.some(m => (start < m.end && end > m.start));
            const overlapsTag = isForbidden(start, end);

            // Increment occurrence counter for this word
            const currentCount = occurrenceCounters.get(name);
            occurrenceCounters.set(name, currentCount + 1);

            // INSTANCE SKIP CHECK
            // If this specific occurrence index (0-based) is in the skip list for this word
            const skippedSet = skippedInstances.get(name);
            const isSkippedInstance = skippedSet && skippedSet.has(currentCount);

            if (!overlapsMatch && !overlapsTag && !isSkippedInstance) {
                matches.push({
                    start,
                    end,
                    text: match[0],
                    cleanName: name,
                    candidates: candidates,
                    occurrenceIndex: currentCount // Save which number this is
                });
            }
        }
    });

    return matches;
}

function renderReviewOverlay(text, matches) {
    matches.sort((a, b) => a.start - b.start);
    let html = '';
    let lastIdx = 0;
    
    matches.forEach((m, idx) => {
        html += escapeHtml(text.substring(lastIdx, m.start));
        
        const isAmbiguous = m.candidates.length > 1;
        const isSCOnly = m.candidates.every(c => c.source === 'sc');
        
        let classes = 'review-highlight ';
        if (isSCOnly && !isAmbiguous) classes += 'sc-tag';
        else if (isAmbiguous) classes += 'ambiguous';
        else classes += 'resolved';
        
        let content = escapeHtml(m.text);
        if (content.startsWith('&lt;') && content.endsWith('&gt;')) {
            content = '<span class="hidden-bracket">&lt;</span>' + escapeHtml(m.cleanName) + '<span class="hidden-bracket">&gt;</span>';
        }

        html += '<span class="' + classes + '" onmouseenter="showTooltip(event, ' + idx + ')" onmouseleave="hideTooltipCheck(event)">' + content + '</span>';
        lastIdx = m.end;
    });
    
    html += escapeHtml(text.substring(lastIdx));
    reviewOverlay.innerHTML = html;
}

// -------------------
// TOOLTIP LOGIC
// -------------------
let tooltipTimeout;

function showTooltip(e, matchIdx) {
    clearTimeout(tooltipTimeout);
    const match = reviewState.matches[matchIdx];
    const rect = e.target.getBoundingClientRect();
    const tooltip = suggestionTooltip;
    
    let html = '<div style="margin-bottom:5px; font-weight:bold; color:#fff; border-bottom:1px solid #333; padding-bottom:5px;">' + match.cleanName + '</div>';
    
    html += '<div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">';
    // Skip This (Instance)
    html += '<button onclick="skipMatch(' + matchIdx + ')" style="flex:1; padding:0.4rem; background:#ef4444; border:none; border-radius:4px; color:white; font-size:0.75rem; cursor:pointer; font-weight:600;">Skip This</button>';
    // Skip All (Global)
    html += '<button onclick="skipForSession(\'' + escapeHtml(match.cleanName).replace(/'/g, "\\'") + '\')" style="flex:1; padding:0.4rem; background:#f59e0b; border:none; border-radius:4px; color:white; font-size:0.75rem; cursor:pointer; font-weight:600;">Skip All</button>';
    html += '</div>';
    
    const scCandidates = match.candidates.filter(c => c.source === 'sc');
    const gw2Candidates = match.candidates.filter(c => c.source === 'gw2');
    
    if (scCandidates.length > 0) {
        html += '<div style="font-size:0.75rem; color:#f59e0b; margin:0.5rem 0 0.25rem; font-weight:600;">SC ARMORY</div>';
        scCandidates.forEach(c => {
            html += '<div class="tooltip-option" onclick="selectCandidate(' + matchIdx + ', ' + c.id + ', \'sc\')">';
            html += '<div class="tooltip-icon" style="background:#f59e0b20;"></div>';
            html += '<div><div style="color:white;">' + c.name + '</div>';
            html += '<div style="font-size:0.75rem; color:#888;">SC (ID: ' + c.id + ')</div></div></div>';
        });
    }
    
    if (gw2Candidates.length > 0) {
        html += '<div style="font-size:0.75rem; color:#047857; margin:0.5rem 0 0.25rem; font-weight:600;">GW2 API</div>';
        gw2Candidates.forEach(c => {
            const iconStyle = c.icon ? 'background-image: url(' + c.icon + ')' : 'background: #444';
            html += '<div class="tooltip-option" onclick="selectCandidate(' + matchIdx + ', ' + c.id + ', \'' + c.type + '\')">';
            html += '<div class="tooltip-icon" style="' + iconStyle + '"></div>';
            html += '<div><div style="color:white;">' + c.name + '</div>';
            html += '<div style="font-size:0.75rem; color:#888;">' + c.type + ' (ID: ' + c.id + ')</div></div></div>';
        });
    }

    tooltip.innerHTML = html;
    tooltip.classList.add('active');

    const viewportHeight = window.innerHeight;
    const tooltipHeight = tooltip.offsetHeight;
    if (rect.bottom + tooltipHeight + 10 > viewportHeight) {
        tooltip.style.top = (rect.top - tooltipHeight - 5) + 'px';
    } else {
        tooltip.style.top = (rect.bottom + 5) + 'px';
    }
    tooltip.style.left = rect.left + 'px';
    
    tooltip.onmouseenter = () => clearTimeout(tooltipTimeout);
    tooltip.onmouseleave = () => tooltip.classList.remove('active');
}

function hideTooltipCheck(e) {
    tooltipTimeout = setTimeout(() => {
        suggestionTooltip.classList.remove('active');
    }, 100);
}

function skipMatch(matchIdx) {
    const match = reviewState.matches[matchIdx];
    
    // Add to skippedInstances (Skip This Place)
    if (!skippedInstances.has(match.cleanName)) {
        skippedInstances.set(match.cleanName, new Set());
    }
    skippedInstances.get(match.cleanName).add(match.occurrenceIndex);

    // Remove from UI immediately
    reviewState.matches.splice(matchIdx, 1);
    suggestionTooltip.classList.remove('active');
    
    // Re-render overlay to hide the highlight
    if (reviewState.matches.length === 0) {
        cancelReviewMode();
    } else {
        renderReviewOverlay(input.value, reviewState.matches);
    }
    setStatus('Suggestion skipped (this instance)', 'normal');
}

function skipForSession(name) {
    sessionIgnoreList.add(name.toLowerCase());
    suggestionTooltip.classList.remove('active');
    
    // Remove all matches with this name
    reviewState.matches = reviewState.matches.filter(m => m.cleanName !== name);
    
    if (reviewState.matches.length === 0) {
        cancelReviewMode();
    } else {
        renderReviewOverlay(input.value, reviewState.matches);
    }
    setStatus('Skipping "' + name + '" for this session', 'normal');
}

function selectCandidate(matchIdx, id, type) {
    const match = reviewState.matches[matchIdx];
    const tag = type === 'sc' 
        ? '[sc:' + id + ']' + match.cleanName + '[/sc]'
        : '[gw2:' + id + ':' + type + ']';
    
    input.focus();
    input.setSelectionRange(match.start, match.end);
    document.execCommand('insertText', false, tag);
    
    updatePreview();
    suggestionTooltip.classList.remove('active');
    
    const suggestSC = document.getElementById('suggest-sc').checked;
    runScan(true); 
}

// -------------------
// SCROLL SYNC FIX
// -------------------
input.addEventListener('scroll', function() { 
    // Force sync
    reviewOverlay.scrollTop = input.scrollTop;
    reviewOverlay.scrollLeft = input.scrollLeft;
});

// -------------------
// CACHING & DATA
// -------------------

async function loadGW2Data() {
    if (gw2Data.loaded) return;
    
    if (typeof gw2ArmoryData !== 'undefined') {
        gw2Data.items = gw2ArmoryData.items || [];
        gw2Data.skills = gw2ArmoryData.skills || [];
        gw2Data.traits = gw2ArmoryData.traits || [];
        gw2Data.loaded = true;
        setStatus('Loaded data from armory-gw2.js', 'success');
        return;
    }
    
    gw2Data.loading = true;
    setStatus('Checking API...', 'normal');

    try {
        const buildRes = await fetch('https://api.guildwars2.com/v2/build');
        const buildJson = await buildRes.json();
        const currentBuild = buildJson.id;

        const cachedBuild = localStorage.getItem(CACHE_KEY_BUILD);
        const cachedData = localStorage.getItem(CACHE_KEY_DATA);

        if (cachedBuild == currentBuild && cachedData) {
            gw2Data = JSON.parse(cachedData);
            gw2Data.loaded = true;
            gw2Data.loading = false;
            setStatus('Loaded cache.', 'success');
            return;
        }

        setStatus('Fetching API data...', 'normal');
        const skills = await fetch('https://api.guildwars2.com/v2/skills?ids=all').then(r=>r.json());
        const traits = await fetch('https://api.guildwars2.com/v2/traits?ids=all').then(r=>r.json());
        const itemIds = await fetch('https://api.guildwars2.com/v2/items').then(r=>r.json());
        
        gw2Data.skills = skills;
        gw2Data.traits = traits;
        gw2Data.items = [];
        
        const batchSize = 200;
        const limit = 30000;
        const idsToFetch = itemIds.slice(0, limit);
        
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
            const chunk = idsToFetch.slice(i, i + batchSize);
            const items = await fetch('https://api.guildwars2.com/v2/items?ids=' + chunk.join(',')).then(r=>r.json());
            gw2Data.items.push(...items);
            setStatus('Fetching items... ' + gw2Data.items.length + '/' + idsToFetch.length);
        }
        
        gw2Data.loaded = true;
        gw2Data.loading = false;
        
        try {
            const dataToSave = { items: gw2Data.items, skills: gw2Data.skills, traits: gw2Data.traits, loaded: true, loading: false };
            localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(dataToSave));
            localStorage.setItem(CACHE_KEY_BUILD, currentBuild);
            setStatus('Cache saved.', 'success');
        } catch(e) {
            setStatus('Loaded (Cache full).', 'success');
        }

    } catch(e) {
        console.error(e);
        setStatus('API Error', 'error');
        gw2Data.loading = false;
    }
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY_DATA);
    localStorage.removeItem(CACHE_KEY_BUILD);
    gw2Data = { items: [], skills: [], traits: [], loaded: false, loading: false };
    setStatus('Cache cleared.', 'success');
}

// -------------------
// STANDARD EDITOR
// -------------------

function populateArmoryList(items = armoryData) {
    armoryList.innerHTML = items.map(item => 
        '<div class="armory-item" onclick="insertArmoryTag(' + item.id + ', \'' + item.name.replace(/'/g, "\\'") + '\')">' +
        '<div class="armory-item-icon"></div>' +
        '<div class="armory-item-info">' +
        '<div class="armory-item-name">' + item.name + '</div>' +
        '<div class="armory-item-id">[sc:' + item.id + ']</div>' +
        '</div></div>'
    ).join('');
}
populateArmoryList();

function filterArmory() {
    const search = armorySearch.value.toLowerCase();
    const filtered = armoryData.filter(item => 
        item.name.toLowerCase().includes(search) || item.id.toString().includes(search)
    );
    populateArmoryList(filtered);
}

function openArmoryModal() { 
    modal.classList.add('active'); 
    armorySearch.value=''; 
    armorySearch.focus(); 
    populateArmoryList(); 
}

function closeArmoryModal() { 
    modal.classList.remove('active'); 
}

function insertArmoryTag(id, name) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const sel = text.substring(start, end) || name;
    
    const replacement = '[sc:' + id + ']' + sel + '[/sc]';
    input.focus();
    input.setSelectionRange(start, end);
    document.execCommand('insertText', false, replacement);
    
    closeArmoryModal();
    updatePreview();
}

function openGW2Modal() {
    const m = document.getElementById('gw2-modal');
    m.classList.add('active');
    if(!gw2Data.loaded) loadGW2Data();
    filterGW2();
}

function closeGW2Modal() { 
    document.getElementById('gw2-modal').classList.remove('active'); 
}

function filterGW2() {
    if(!gw2Data.loaded) return;
    const search = document.getElementById('gw2-search').value.toLowerCase();
    const type = document.getElementById('gw2-type-filter').value;
    const list = document.getElementById('gw2-list');
    
    let res = [];
    if(type==='all'||type==='items') gw2Data.items.filter(i=>i.name.toLowerCase().includes(search)).forEach(i => res.push({...i, type:'item'}));
    if(type==='all'||type==='skills') gw2Data.skills.filter(s=>s.name.toLowerCase().includes(search)).forEach(s => res.push({...s, type:'skill'}));
    if(type==='all'||type==='traits') gw2Data.traits.filter(t=>t.name.toLowerCase().includes(search)).forEach(t => res.push({...t, type:'trait'}));
    
    list.innerHTML = res.slice(0,50).map(i => 
        '<div class="armory-item" onclick="insertGW2Tag(' + i.id + ', \'' + i.type + '\')">' +
        '<div class="armory-item-icon" style="background-image: url(' + (i.icon||'') + ')"></div>' +
        '<div class="armory-item-info">' +
        '<div class="armory-item-name">' + i.name + '</div>' +
        '<div class="armory-item-id">' + i.type + '</div>' +
        '</div></div>'
    ).join('');
}

function insertGW2Tag(id, type) {
    const tag = '[gw2:' + id + ':' + type + ']';
    insertMarkdown(tag, ''); 
    closeGW2Modal();
}

function toggleSuggestions() {
    document.getElementById('suggestions-panel').classList.toggle('active');
}

// Waypoint modal
async function openWaypointModal() {
    const modal = document.getElementById('waypoint-modal');
    modal.classList.add('active');
    if (gw2Data.waypoints.length === 0) await loadWaypoints();
    filterWaypoints();
}

function closeWaypointModal() {
    document.getElementById('waypoint-modal').classList.remove('active');
}

async function loadWaypoints() {
    try {
        if (typeof gw2ArmoryData !== 'undefined' && gw2ArmoryData.waypoints) {
            gw2Data.waypoints = gw2ArmoryData.waypoints;
            populateWaypointMapFilter();
            return;
        }
        const mapsRes = await fetch('https://api.guildwars2.com/v2/maps?ids=all');
        const maps = await mapsRes.json();
        const waypoints = [];
        maps.forEach(map => {
            if (map.points_of_interest) {
                map.points_of_interest.forEach(poi => {
                    if (poi.type === 'waypoint' && poi.chat_link) {
                        waypoints.push({
                            id: poi.id,
                            name: poi.name || 'Unnamed Waypoint', 
                            chat_link: poi.chat_link,
                            map_name: map.name || 'Unknown Map',    
                            map_id: map.id
                        });
                    }
                });
            }
        });
        gw2Data.waypoints = waypoints.sort((a, b) => a.name.localeCompare(b.name));
        populateWaypointMapFilter();
    } catch (error) {
        console.error('Error loading waypoints:', error);
    }
}

function populateWaypointMapFilter() {
    const filter = document.getElementById('waypoint-map-filter');
    const maps = [...new Set(gw2Data.waypoints.map(w => w.map_name))].sort();
    filter.innerHTML = '<option value="all">All Maps</option>';
    maps.forEach(mapName => {
        const opt = document.createElement('option');
        opt.value = mapName;
        opt.textContent = mapName;
        filter.appendChild(opt);
    });
}

function filterWaypoints() {
    const search = document.getElementById('waypoint-search').value.toLowerCase();
    const mapFilter = document.getElementById('waypoint-map-filter').value;
    const list = document.getElementById('waypoint-list');
    
    const filtered = gw2Data.waypoints.filter(wp => {
        const wpName = (wp.name || 'Unknown').toLowerCase();
        const wpMapName = (wp.map_name || 'Unknown Map').toLowerCase();
        const matchesSearch = wpName.includes(search) || wpMapName.includes(search);
        const matchesMap = mapFilter === 'all' || wp.map_name === mapFilter;
        return matchesSearch && matchesMap;
    });
    
    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">No waypoints found</div>';
        return;
    }
    
    list.innerHTML = filtered.slice(0, 100).map(wp => 
        '<div class="armory-item" onclick="insertWaypointFromModal(\'' + (wp.chat_link || '').replace(/'/g, "\\'") + '\', \'' + (wp.name || 'Unknown').replace(/'/g, "\\'") + '\')">' +
        '<div class="armory-item-icon" style="background-image: url(https://qjv.dev.br/map/icons/waypoint.png); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>' +
        '<div class="armory-item-info">' +
        '<div class="armory-item-name">' + (wp.name || 'Unknown Waypoint') + '</div>' +
        '<div class="armory-item-id">' + (wp.map_name || 'Unknown Map') + '</div>' +
        '</div></div>'
    ).join('');
}

function insertWaypointFromModal(chatLink, name) {
    const tag = '[wp:' + chatLink + ']' + name + '[/wp]';
    insertMarkdown(tag, '');
    closeWaypointModal();
}

// Traitline logic
async function openTraitlineModal() {
    const modal = document.getElementById('traitline-modal');
    modal.classList.add('active');
    currentTraitSelections = { spec: null, trait1: null, trait2: null, trait3: null };
    document.getElementById('traits-container').style.display = 'none';
    document.getElementById('insert-trait-btn').style.display = 'none';
    resetDropdown('spec-input'); resetDropdown('trait1-input'); resetDropdown('trait2-input'); resetDropdown('trait3-input');

    if (gw2Data.specializations.length === 0) await loadSpecializations();
    setupDropdown('spec', gw2Data.specializations, onSpecSelect);
}

function closeTraitlineModal() {
    document.getElementById('traitline-modal').classList.remove('active');
    document.querySelectorAll('.dropdown-options').forEach(el => el.classList.remove('show'));
}

async function loadSpecializations() {
    try {
        if (typeof gw2ArmoryData !== 'undefined' && gw2ArmoryData.specializations) {
            gw2Data.specializations = gw2ArmoryData.specializations;
            gw2Data.traits = gw2ArmoryData.traits || gw2Data.traits;
            return;
        }
        const specsRes = await fetch('https://api.guildwars2.com/v2/specializations?ids=all');
        const specs = await specsRes.json();
        gw2Data.specializations = specs.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) { console.error('Error loading specs:', error); }
}

function resetDropdown(inputId) {
    const input = document.getElementById(inputId);
    input.value = ''; input.style.backgroundImage = 'none'; input.dataset.id = '';
}

function setupDropdown(type, data, onSelectCallback) {
    const input = document.getElementById(type + '-input');
    const list = document.getElementById(type + '-options');

    const renderList = (filterText = '') => {
        list.innerHTML = '';
        const lowerFilter = filterText.toLowerCase();
        const filtered = data.filter(item => item.name.toLowerCase().includes(lowerFilter) || item.id.toString().includes(lowerFilter));

        if (filtered.length === 0) { list.innerHTML = '<div style="padding:10px; color:#666; text-align:center;">No matches</div>'; return; }

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.onclick = () => {
                input.value = item.name; input.dataset.id = item.id;
                if (item.icon) input.style.backgroundImage = `url(${item.icon})`;
                list.classList.remove('show');
                if (onSelectCallback) onSelectCallback(item);
            };
            div.innerHTML = `<img src="${item.icon || ''}" alt=""><div class="dropdown-info"><div class="dropdown-name">${item.name}</div><div class="dropdown-id">ID: ${item.id}</div></div>`;
            list.appendChild(div);
        });
    };

    input.onfocus = () => { renderList(input.value); list.classList.add('show'); };
    input.oninput = () => { renderList(input.value); list.classList.add('show'); };
    document.addEventListener('click', (e) => { if (!e.target.closest(`#${type}-dropdown`)) list.classList.remove('show'); });
}

async function onSpecSelect(spec) {
    currentTraitSelections.spec = spec.id;
    setStatus('Loading data for ' + spec.name + '...', 'normal');
    
    if (!spec.major_traits) {
        try {
            const res = await fetch('https://api.guildwars2.com/v2/specializations/' + spec.id);
            const fullSpec = await res.json();
            spec.major_traits = fullSpec.major_traits;
        } catch (e) { setStatus('Error fetching spec', 'error'); return; }
    }

    const traitsNeeded = spec.major_traits || [];
    const missingTraits = traitsNeeded.filter(tid => !gw2Data.traits.find(t => t.id === tid));

    if (missingTraits.length > 0) {
        try {
            const res = await fetch('https://api.guildwars2.com/v2/traits?ids=' + missingTraits.join(','));
            const newTraits = await res.json();
            gw2Data.traits.push(...newTraits);
        } catch (e) { setStatus('Error fetching traits', 'error'); return; }
    }

    setStatus('Ready');
    const getTraitObjects = (indices) => {
        if (!spec.major_traits) return [];
        return indices.map(idx => {
            const tid = spec.major_traits[idx];
            return gw2Data.traits.find(t => t.id === tid);
        }).filter(Boolean);
    };

    const tier1Traits = getTraitObjects([0, 1, 2]);
    const tier2Traits = getTraitObjects([3, 4, 5]);
    const tier3Traits = getTraitObjects([6, 7, 8]);

    document.getElementById('traits-container').style.display = 'flex';
    document.getElementById('insert-trait-btn').style.display = 'block';
    resetDropdown('trait1-input'); resetDropdown('trait2-input'); resetDropdown('trait3-input');
    currentTraitSelections.trait1 = null; currentTraitSelections.trait2 = null; currentTraitSelections.trait3 = null;

    setupDropdown('trait1', tier1Traits, (t) => currentTraitSelections.trait1 = t.id);
    setupDropdown('trait2', tier2Traits, (t) => currentTraitSelections.trait2 = t.id);
    setupDropdown('trait3', tier3Traits, (t) => currentTraitSelections.trait3 = t.id);
}

function insertTraitlineFromModal() {
    if (!currentTraitSelections.spec) { alert("Please select a specialization"); return; }
    const spec = currentTraitSelections.spec;
    const t1 = currentTraitSelections.trait1 || 0;
    const t2 = currentTraitSelections.trait2 || 0;
    const t3 = currentTraitSelections.trait3 || 0;
    const tag = `[traitline:${spec}:${t1}:${t2}:${t3}]`;
    insertMarkdown(tag, '');
    closeTraitlineModal();
}

function insertTraitline() { openTraitlineModal(); }
function insertWaypoint() { openWaypointModal(); }

function insertMarkdown(before, after) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selectedText = input.value.substring(start, end);
    const replacement = before + selectedText + after;
    input.focus();
    input.setSelectionRange(start, end);
    document.execCommand('insertText', false, replacement);
    const newCursorPos = start + before.length + selectedText.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    updatePreview();
}

function parseNestedLists(lines) {
    const result = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // MODIFIED: Only recognize '-' as unordered list, NOT '*'
        const unorderedMatch = line.match(/^( *)\* (.+)$/);
        const orderedMatch = line.match(/^( *)\d+\. (.+)$/);
        
        if (unorderedMatch || orderedMatch) {
            const match = unorderedMatch || orderedMatch;
            const indent = match[1].length;
            const listItems = [];
            let currentIndent = indent;
            while (i < lines.length) {
                const currentLine = lines[i];
                const currentUnordered = currentLine.match(/^( *)- (.+)$/);
                const currentOrdered = currentLine.match(/^( *)\d+\. (.+)$/);
                const currentMatch = currentUnordered || currentOrdered;
                if (!currentMatch) break;
                const currentLineIndent = currentMatch[1].length;
                if (listItems.length > 0 && currentLineIndent < currentIndent) break;
                const level = Math.floor(currentLineIndent / 4);
                const content = currentMatch[2];
                listItems.push({ level, content, type: currentUnordered ? 'ul' : 'ol' });
                i++;
            }
            result.push(buildNestedList(listItems));
        } else {
            result.push(line);
            i++;
        }
    }
    return result.join('\n');
}

function buildNestedList(items) {
    if (items.length === 0) return '';
    const stack = [];
    let html = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const level = item.level;
        while (stack.length > level) {
            const lastType = stack.pop();
            html += '</' + lastType + '>';
        }
        if (stack.length < level + 1) {
            while (stack.length < level + 1) {
                html += '<' + item.type + '>';
                stack.push(item.type);
            }
        }
        if (stack.length === level + 1 && stack[level] !== item.type) {
            html += '</' + stack[level] + '>';
            stack[level] = item.type;
            html += '<' + item.type + '>';
        }
        html += '<li>' + item.content + '</li>';
    }
    while (stack.length > 0) {
        const lastType = stack.pop();
        html += '</' + lastType + '>';
    }
    return html;
}

function decodeWaypointChatLink(base64Code) {
    try {
        if (!base64Code) return 994;
        const binaryString = atob(base64Code);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        if (bytes[0] !== 0x04) return 994;
        return bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24);
    } catch (e) { return 994; }
}

function parseMarkdown(text) {
    // 1. Extract Code Blocks
    const codeBlocks = [];
    const placeholder = "%%CODEBLOCK%%";
    text = text.replace(/`([^`]+)`/g, function(match, code) {
        codeBlocks.push(code);
        return placeholder + (codeBlocks.length - 1) + "%%";
    });

    text = text.replace(/<([^>]+)>/g, '$1');

    text = text.replace(/\[wp:\[&([^\]]+)\]\](.*?)\[\/wp\]/g, function(match, code, name) {
        const waypointId = decodeWaypointChatLink(code);
        return '<span class="sc-armory-custom" data-armory-id="' + waypointId + '" data-armory-title="' + name + '"><span class="sc-armory-icon" style="background-image: url(https://qjv.dev.br/map/icons/waypoint.png)"></span>' + name + '</span>';
    });

    text = text.replace(/\[traitline:(\d+):(\d+):(\d+):(\d+)\]/g, function(match, specId, trait1, trait2, trait3) {
        return '<span data-armory-embed="specializations" data-armory-ids="' + specId + '" data-armory-' + specId + '-traits="' + trait1 + ',' + trait2 + ',' + trait3 + '"></span>';
    });

    text = text.replace(/\[sc:(\d+)\](.*?)\[\/sc\]/g, function(match, id, content) {
        const item = armoryData.find(i => i.id == id);
        const displayName = content || (item ? item.name : 'ID:' + id);
        const bleedIcon = 'https://assets.snowcrows.com/images/sc-armory/bleeding.png';
        if (!content) return '<span data-armory-id="' + id + '" data-armory-title="' + displayName + '" title="' + displayName + '" class="sc-armory-custom"><span class="sc-armory-icon" style="background-image: url(' + bleedIcon + ')"></span></span>';
        return '<span data-armory-id="' + id + '" data-armory-title="' + displayName + '" title="' + displayName + '" class="sc-armory-custom"><span class="sc-armory-icon" style="background-image: url(' + bleedIcon + ')"></span>' + displayName + '</span>';
    });

    text = text.replace(/\[gw2:(\d+):skill\]/g, '<span data-armory-embed="skills" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');
    text = text.replace(/\[gw2:(\d+):trait\]/g, '<span data-armory-embed="traits" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');
    text = text.replace(/\[gw2:(\d+):item\]/g, '<span data-armory-embed="items" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');

    text = text.replace(/^---$/gim, '<hr>');
    text = text.replace(/^\*\*\*$/gim, '<hr>');
    text = text.replace(/^___$/gim, '<hr>');

    text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    text = text.replace(/  \n/g, '<br>\n');

    const lines = text.split('\n');
    text = parseNestedLists(lines);

    text = text.replace(/^&gt; (.+)$/gim, '<blockquote>$1</blockquote>');
    text = text.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

    // Restore Code Blocks
    text = text.replace(new RegExp(placeholder + "(\\d+)%%", "g"), function(match, id) {
        return '<code>' + escapeHtml(codeBlocks[id]) + '</code>';
    });

    text = text.split('\n\n').map(para => {
        para = para.trim();
        if (!para) return '';
        if (!para.match(/^<[h|u|o|b]/)) {
            para = para.split('<br>').map(part => part.replace(/\n/g, ' ')).join('<br>');
            return '<p>' + para + '</p>';
        }
        return para;
    }).join('\n');

    return text;
}

const debouncedPreview = debounce(function() {
    const markdown = input.value;
    const html = parseMarkdown(markdown);
    preview.innerHTML = html;
    
    const oldScript = document.getElementById('armory-script-injection');
    if (oldScript) oldScript.remove();
    
    const script = document.createElement('script');
    script.id = 'armory-script-injection'; 
    script.async = true;
    script.src = 'https://unpkg.com/armory-embeds@^0.x.x/armory-embeds.js';
    document.body.appendChild(script);
}, 1000);

function updatePreview() { debouncedPreview(); }

const debouncedScan = debounce(function() {
    if (document.getElementById('scan-as-type').checked) runScan(true);
}, 500);

input.addEventListener('input', function() { updatePreview(); debouncedScan(); });
reviewOverlay.addEventListener('click', function() { cancelReviewMode(); input.focus(); });

// Check for armory updates logic removed for brevity (stays same as before)
// ... (Include your checkArmoryUpdates, showUpdateWarning, dismissWarning functions here if needed)

window.onload = function() {
    updatePreview();
    // setTimeout(checkArmoryUpdates, 2000);
};

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }