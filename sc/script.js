// ==========================================
// 1. INITIALIZATION & UTILITIES
// ==========================================

// Handle armory.js (SC Data) existence safely
const scItemData = (typeof armoryData !== 'undefined') ? armoryData : [];
if (typeof armoryData === 'undefined') {
    console.warn('armory.js (SC Data) not found.');
}

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

let sessionIgnoreList = new Set();
let skippedInstances = new Map();

// Initialize GW2 Data Container
let gw2Data = { items: [], skills: [], traits: [], waypoints: [], specializations: [], loaded: false, loading: false };
let currentTraitSelections = { spec: null, trait1: null, trait2: null, trait3: null };
let reviewState = { active: false, matches: [] };

// --- UTILITY FUNCTIONS (Defined FIRST) ---

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function setStatus(msg, type = 'normal') {
    if (!statusBar) return;
    statusBar.textContent = msg;
    if (type === 'error') statusBar.style.color = '#ef4444';
    else if (type === 'success') statusBar.style.color = '#10b981';
    else statusBar.style.color = '#64748b';
    if (type === 'success') setTimeout(() => setStatus('Ready'), 4000);
}

// --- CORE PREVIEW FUNCTIONS ---

const debouncedPreview = debounce(function() {
    const markdown = input.value;
    const html = parseMarkdown(markdown);
    preview.innerHTML = html;

    // Re-inject armory scripts in correct order
    const oldScripts = document.querySelectorAll('[id^="armory-script-"]');
    oldScripts.forEach(s => s.remove());

    const armoryScripts = [
        'palette-mapping.js',
        'data-fetcher.js',
        'tooltip.js',
        'renderer.js',
        'build-parser.js',
        'armory.js'
    ];

    // Load scripts sequentially
    function loadScript(index) {
        if (index >= armoryScripts.length) return;

        const script = document.createElement('script');
        script.id = `armory-script-${index}`;
        script.src = `https://qjv.dev.br/armory/src/${armoryScripts[index]}`;
        script.onload = () => loadScript(index + 1);
        document.body.appendChild(script);
    }

    loadScript(0);
}, 1000);

function updatePreview() { 
    debouncedPreview(); 
}

const debouncedScan = debounce(function() {
    const autoScan = document.getElementById('scan-as-type');
    if (autoScan && autoScan.checked) runScan(true);
}, 500);

// ==========================================
// 2. SCANNING & MATCHING
// ==========================================

async function runScan(fromInput = false) {
    const suggestSC = document.getElementById('suggest-sc').checked;
    
    // Check if we need to load data
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
            reviewState.matches = findMatches(newText, suggestSC);
        }
    }

    if (reviewState.matches.length > 0) {
        startReviewMode();
    } else if (reviewState.active) {
        cancelReviewMode();
    }
}

function findMatches(text, includeSC = true) {
    const allData = [];
    const suggestSkills = document.getElementById('suggest-skills').checked;
    const suggestItems = document.getElementById('suggest-items').checked;
    const suggestTraits = document.getElementById('suggest-traits').checked;
    
    // Add GW2 Data
    if (gw2Data.loaded) {
        if (suggestSkills) gw2Data.skills.forEach(s => allData.push({...s, type: 'skill', source: 'gw2'}));
        if (suggestItems) gw2Data.items.forEach(i => allData.push({...i, type: 'item', source: 'gw2'}));
        if (suggestTraits) gw2Data.traits.forEach(t => allData.push({...t, type: 'trait', source: 'gw2'}));
    }
    
    // Add SC Data (Local Reference)
    if (includeSC && scItemData.length > 0) {
        scItemData.forEach(a => allData.push({...a, type: 'sc', source: 'sc'}));
    }
    
    const nameMap = new Map();
    allData.forEach(d => {
        if(!d.name) return;
        const normalizedName = d.name.toLowerCase();
        if (sessionIgnoreList.has(normalizedName)) return;
        if (!nameMap.has(d.name)) nameMap.set(d.name, []);
        nameMap.get(d.name).push(d);
    });

    const forbiddenRanges = [];
    const ignorePatterns = [ /\[sc:.*?\[\/sc\]/g, /\[gw2:.*?\]/g, /\[wp:.*?\[\/wp\]/g, /\[traitline:.*?\]/g, /`[^`]+`/g ];
    ignorePatterns.forEach(pattern => {
        let tagMatch; pattern.lastIndex = 0; 
        while ((tagMatch = pattern.exec(text)) !== null) {
            forbiddenRanges.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
        }
    });

    const isForbidden = (start, end) => forbiddenRanges.some(r => (start >= r.start && start < r.end) || (end > r.start && end <= r.end) || (start <= r.start && end >= r.end));

    const matches = [];
    const safeMode = document.getElementById('safe-mode').checked;
    const sortedNames = Array.from(nameMap.keys()).sort((a, b) => b.length - a.length);
    const occurrenceCounters = new Map();

    sortedNames.forEach(name => {
        const candidates = nameMap.get(name);
        let regexStr;
        if (safeMode) {
            regexStr = escapeRegex(name);
        } else {
            const isSimpleWord = /^[a-zA-Z]+$/.test(name);
            const baseName = escapeRegex(name);
            if (isSimpleWord) {
                regexStr = '\\b(' + baseName + '(?:s|es|ies|ves)?)\\b';
            } else {
                regexStr = baseName;
            }
        }
        
        try {
            const regex = new RegExp(regexStr, 'gi');
            occurrenceCounters.set(name, 0);

            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = match.index + match[0].length;
                
                if (!safeMode && !/^[a-zA-Z]+$/.test(name)) {
                    const charBefore = start > 0 ? text[start - 1] : ' ';
                    const charAfter = end < text.length ? text[end] : ' ';
                    if (/[a-zA-Z0-9]/.test(charBefore) || /[a-zA-Z0-9]/.test(charAfter)) continue;
                }

                const overlapsMatch = matches.some(m => (start < m.end && end > m.start));
                const overlapsTag = isForbidden(start, end);

                const currentCount = occurrenceCounters.get(name);
                occurrenceCounters.set(name, currentCount + 1);
                const skippedSet = skippedInstances.get(name);
                const isSkippedInstance = skippedSet && skippedSet.has(currentCount);

                if (!overlapsMatch && !overlapsTag && !isSkippedInstance) {
                    matches.push({
                        start,
                        end,
                        text: match[0],
                        cleanName: name,
                        candidates: candidates,
                        occurrenceIndex: currentCount
                    });
                }
            }
        } catch (e) { }
    });
    return matches;
}

// ==========================================
// 3. UI RENDERING
// ==========================================

function startReviewMode() {
    reviewState.active = true;
    renderReviewOverlay(input.value, reviewState.matches);
    setStatus("Suggestions found (" + reviewState.matches.length + ")", "normal");
}

function cancelReviewMode() {
    reviewState.active = false;
    reviewState.matches = [];
    reviewOverlay.textContent = input.value;
    suggestionTooltip.classList.remove('active');
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
        let content = escapeHtml(m.text);
        html += '<span class="' + classes + '" onmouseenter="showTooltip(event, ' + idx + ')" onmouseleave="hideTooltipCheck(event)">' + content + '</span>';
        lastIdx = m.end;
    });
    
    html += escapeHtml(text.substring(lastIdx));

    // FIX: Force a break for trailing newline so overlay height matches textarea
    if (text.endsWith('\n')) {
        html += '<br>';
    }

    reviewOverlay.innerHTML = html;
}

let tooltipTimeout;
function showTooltip(e, matchIdx) {
    clearTimeout(tooltipTimeout);
    const match = reviewState.matches[matchIdx];
    const rect = e.target.getBoundingClientRect();
    const tooltip = suggestionTooltip;
    
    // --- UPDATED LAYOUT (SIDE ACTION BAR) ---
    
    // 1. LEFT SIDE: CONTENT
    let contentHtml = '<div class="tooltip-main">';
    contentHtml += '<div class="tooltip-header"><span class="tooltip-title">' + match.cleanName + '</span><span class="tooltip-meta">("' + match.text + '")</span></div>';
    
    contentHtml += '<div class="tooltip-scroll-area">';
    
    const scCandidates = match.candidates.filter(c => c.source === 'sc');
    const gw2Candidates = match.candidates.filter(c => c.source === 'gw2');
    
    if (scCandidates.length > 0) {
        contentHtml += '<div class="tooltip-group-title" style="color:#f59e0b">SC Armory</div>';
        scCandidates.forEach(c => {
            contentHtml += '<div class="tooltip-option" onclick="selectCandidate(' + matchIdx + ', ' + c.id + ', \'sc\')">';
            contentHtml += '<div class="tooltip-icon" style="background:#f59e0b20;"></div>';
            contentHtml += '<div class="tooltip-text"><div class="tooltip-name">' + c.name + '</div><div class="tooltip-id">SC: ' + c.id + '</div></div></div>';
        });
    }
    
    if (gw2Candidates.length > 0) {
        contentHtml += '<div class="tooltip-group-title" style="color:#047857">GW2 API</div>';
        gw2Candidates.forEach(c => {
            const iconStyle = c.icon ? 'background-image: url(' + c.icon + ')' : 'background: #444';
            contentHtml += '<div class="tooltip-option" onclick="selectCandidate(' + matchIdx + ', ' + c.id + ', \'' + c.type + '\')">';
            contentHtml += '<div class="tooltip-icon" style="' + iconStyle + '"></div>';
            contentHtml += '<div class="tooltip-text"><div class="tooltip-name">' + c.name + '</div><div class="tooltip-id">' + c.type.toUpperCase() + '</div></div></div>';
        });
    }
    
    contentHtml += '</div></div>'; // End Scroll Area & Main
    
    // 2. RIGHT SIDE: ACTIONS
    let actionsHtml = '<div class="tooltip-actions">';
    // Ignore Instance
    actionsHtml += '<div class="action-btn ignore" title="Ignore This Instance" onclick="skipMatch(' + matchIdx + ')">✕</div>';
    // Ignore All
    actionsHtml += '<div class="action-btn ignore-all" title="Ignore All (' + escapeHtml(match.cleanName) + ')" onclick="skipForSession(\'' + escapeHtml(match.cleanName).replace(/'/g, "\\'") + '\')">⚠</div>';
    actionsHtml += '</div>';

    // Combine
    tooltip.innerHTML = contentHtml + actionsHtml;
    tooltip.classList.add('active');

    // Positioning
    const tooltipHeight = tooltip.offsetHeight;
    const viewportHeight = window.innerHeight;
    
    if (rect.bottom + tooltipHeight + 20 > viewportHeight) {
        tooltip.style.top = (rect.top - tooltipHeight - 10) + 'px';
    } else {
        tooltip.style.top = (rect.bottom + 10) + 'px';
    }
    
    let leftPos = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
    if (leftPos < 10) leftPos = 10;
    if (leftPos + tooltip.offsetWidth > window.innerWidth - 10) leftPos = window.innerWidth - tooltip.offsetWidth - 10;
    tooltip.style.left = leftPos + 'px';
    
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
    if (!skippedInstances.has(match.cleanName)) skippedInstances.set(match.cleanName, new Set());
    skippedInstances.get(match.cleanName).add(match.occurrenceIndex);
    reviewState.matches.splice(matchIdx, 1);
    suggestionTooltip.classList.remove('active');
    renderReviewOverlay(input.value, reviewState.matches);
}

function skipForSession(name) {
    sessionIgnoreList.add(name.toLowerCase());
    suggestionTooltip.classList.remove('active');
    reviewState.matches = reviewState.matches.filter(m => m.cleanName !== name);
    renderReviewOverlay(input.value, reviewState.matches);
}

function selectCandidate(matchIdx, id, type) {
    input.focus();
    const match = reviewState.matches[matchIdx];
    if (!match) return;

    const tag = type === 'sc' 
        ? '[sc:' + id + ']' + match.cleanName + '[/sc]'
        : '[gw2:' + id + ':' + type + ']';
    
    input.setSelectionRange(match.start, match.end);
    document.execCommand('insertText', false, tag);
    
    suggestionTooltip.classList.remove('active');
    updatePreview();
    runScan(true); 
}

function performAutoReplacement(matches) {
    let text = input.value;
    matches.sort((a, b) => b.start - a.start);
    input.focus();
    input.select();
    
    let newText = text;
    matches.forEach(m => {
        const selected = m.candidates[0];
        const tag = selected.source === 'sc' 
            ? '[sc:' + selected.id + ']' + selected.name + '[/sc]'
            : '[gw2:' + selected.id + ':' + selected.type + ']';
        newText = newText.substring(0, m.start) + tag + newText.substring(m.end);
    });

    document.execCommand('insertText', false, newText);
    updatePreview();
}

// ==========================================
// 4. MARKDOWN PARSER
// ==========================================

function parseMarkdown(text) {
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
        // Use local scItemData
        let item = scItemData.find(i => i.id == id);
        
        const displayName = content || (item ? item.name : 'ID:' + id);
        const bleedIcon = 'https://assets.snowcrows.com/images/sc-armory/bleeding.png';
        if (!content) return '<span data-armory-id="' + id + '" data-armory-title="' + displayName + '" title="' + displayName + '" class="sc-armory-custom"><span class="sc-armory-icon" style="background-image: url(' + bleedIcon + ')"></span></span>';
        return '<span data-armory-id="' + id + '" data-armory-title="' + displayName + '" title="' + displayName + '" class="sc-armory-custom"><span class="sc-armory-icon" style="background-image: url(' + bleedIcon + ')"></span>' + displayName + '</span>';
    });

    text = text.replace(/\[gw2:(\d+):skill\]/g, '<span data-armory-embed="skills" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');
    text = text.replace(/\[gw2:(\d+):trait\]/g, '<span data-armory-embed="traits" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');
    text = text.replace(/\[gw2:(\d+):item\]/g, '<span data-armory-embed="items" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');

    text = text.replace(/^---$/gim, '<hr>');
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

    text = text.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

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

function parseNestedLists(lines) {
    const result = [];
    let i = 0;
    const ulRegex = /^( *)[-*] (.+)$/;
    const olRegex = /^( *)\d+\. (.+)$/;
    while (i < lines.length) {
        const line = lines[i];
        const ulMatch = line.match(ulRegex);
        const olMatch = line.match(olRegex);
        if (ulMatch || olMatch) {
            const listItems = [];
            const baseIndent = (ulMatch || olMatch)[1].length;
            const listType = ulMatch ? 'ul' : 'ol';
            let emptyLineCount = 0;
            while (i < lines.length) {
                const currentLine = lines[i];
                // Allow up to 1 empty line within lists
                if (currentLine.trim() === '') {
                    emptyLineCount++;
                    if (emptyLineCount > 1) break;
                    i++;
                    continue;
                }
                const curMatch = currentLine.match(ulRegex) || currentLine.match(olRegex);
                if (!curMatch) break;
                const curIndent = curMatch[1].length;
                if (curIndent < baseIndent) break;
                emptyLineCount = 0;
                const level = Math.floor((curIndent - baseIndent) / 2);
                listItems.push({ level: Math.max(0, level), content: curMatch[2], type: currentLine.match(ulRegex) ? 'ul' : 'ol' });
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
        while (stack.length > level) { const lastType = stack.pop(); html += '</' + lastType + '>'; }
        if (stack.length < level + 1) { while (stack.length < level + 1) { html += '<' + item.type + '>'; stack.push(item.type); } }
        if (stack.length === level + 1 && stack[level] !== item.type) { html += '</' + stack[level] + '>'; stack[level] = item.type; html += '<' + item.type + '>'; }
        html += '<li>' + item.content + '</li>';
    }
    while (stack.length > 0) { const lastType = stack.pop(); html += '</' + lastType + '>'; }
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

// ==========================================
// 5. EXTERNAL DATA (GW2 API)
// ==========================================

async function loadGW2Data() {
    if (gw2Data.loaded) return;

    // --- VERIFY LOCAL DATA (gw2ArmoryData) ---
    if (typeof gw2ArmoryData !== 'undefined') {
        setStatus('Loading local database...', 'normal');
        gw2Data.items = gw2ArmoryData.items || [];
        gw2Data.skills = gw2ArmoryData.skills || [];
        gw2Data.traits = gw2ArmoryData.traits || [];
        gw2Data.specializations = gw2ArmoryData.specializations || [];
        gw2Data.waypoints = gw2ArmoryData.waypoints || [];
        gw2Data.loaded = true;
        setStatus('Local DB Loaded.', 'success');
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
        } catch(e) { setStatus('Loaded (Cache full).', 'success'); }

    } catch(e) { console.error(e); setStatus('API Error', 'error'); gw2Data.loading = false; }
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY_DATA);
    localStorage.removeItem(CACHE_KEY_BUILD);
    gw2Data = { items: [], skills: [], traits: [], loaded: false, loading: false };
    setStatus('Cache cleared.', 'success');
}

// ==========================================
// 6. UI HELPERS (Modals, Lists)
// ==========================================

function populateArmoryList(items = scItemData) {
    if (!armoryList) return;
    items = items || []; // Safety
    armoryList.innerHTML = items.map(item => 
        '<div class="armory-item" onclick="insertArmoryTag(' + item.id + ', \'' + item.name.replace(/'/g, "\\'") + '\')">' +
        '<div class="armory-item-icon"></div>' +
        '<div class="armory-item-info">' +
        '<div class="armory-item-name">' + item.name + '</div>' +
        '<div class="armory-item-id">[sc:' + item.id + ']</div>' +
        '</div></div>'
    ).join('');
}

function filterArmory() {
    const search = armorySearch.value.toLowerCase();
    const filtered = scItemData.filter(item => item.name.toLowerCase().includes(search) || item.id.toString().includes(search));
    populateArmoryList(filtered);
}

function openArmoryModal() { modal.classList.add('active'); armorySearch.value=''; armorySearch.focus(); populateArmoryList(); }
function closeArmoryModal() { modal.classList.remove('active'); }

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

function openGW2Modal() { document.getElementById('gw2-modal').classList.add('active'); if(!gw2Data.loaded) loadGW2Data(); filterGW2(); }
function closeGW2Modal() { document.getElementById('gw2-modal').classList.remove('active'); }

function filterGW2() {
    if(!gw2Data.loaded) return;
    const search = document.getElementById('gw2-search').value.toLowerCase();
    const type = document.getElementById('gw2-type-filter').value;
    const list = document.getElementById('gw2-list');

    let res = [];
    if(type==='all'||type==='items') gw2Data.items.filter(i=>i.name.toLowerCase().includes(search)).forEach(i => res.push({...i, type:'item'}));
    if(type==='all'||type==='skills') gw2Data.skills.filter(s=>s.name.toLowerCase().includes(search)).forEach(s => res.push({...s, type:'skill'}));
    if(type==='all'||type==='traits') gw2Data.traits.filter(t=>t.name.toLowerCase().includes(search)).forEach(t => res.push({...t, type:'trait'}));

    list.innerHTML = res.slice(0,50).map(i => {
        const description = i.description ? escapeHtml(i.description.replace(/<[^>]*>/g, '')) : 'No description available';
        const tooltip = description.length > 200 ? description.substring(0, 200) + '...' : description;
        return '<div class="armory-item" onclick="insertGW2Tag(' + i.id + ', \'' + i.type + '\')" title="' + tooltip + '">' +
            '<div class="armory-item-icon" style="background-image: url(' + (i.icon||'') + ')"></div>' +
            '<div class="armory-item-info">' +
            '<div class="armory-item-name">' + i.name + '</div>' +
            '<div class="armory-item-id">' + i.type + '</div>' +
            '</div></div>';
    }).join('');
}

function insertGW2Tag(id, type) { insertMarkdown('[gw2:' + id + ':' + type + ']', ''); closeGW2Modal(); }

function toggleSuggestions() {
    const panel = document.getElementById('suggestions-panel');
    panel.classList.toggle('active');
}

function manualScan() {
    runScan(false);
}

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

// Waypoints & Traits Modals
async function openWaypointModal() {
    document.getElementById('waypoint-modal').classList.add('active');

    // Ensure GW2 data is loaded first (includes waypoints from local data)
    if (!gw2Data.loaded) {
        await loadGW2Data();
    }

    // If no waypoints in local data, fetch from API
    if (gw2Data.waypoints.length === 0) {
        await loadWaypoints();
    } else {
        // If waypoints already loaded from local data, populate the map filter
        populateWaypointMapFilter();
    }
    filterWaypoints();
}
function closeWaypointModal() { document.getElementById('waypoint-modal').classList.remove('active'); }
async function loadWaypoints() {
    try {
        const mapsRes = await fetch('https://api.guildwars2.com/v2/maps?ids=all');
        const maps = await mapsRes.json();
        const waypoints = [];
        maps.forEach(map => {
            if (map.points_of_interest) {
                map.points_of_interest.forEach(poi => {
                    if (poi.type === 'waypoint' && poi.chat_link) {
                        waypoints.push({ id: poi.id, name: poi.name || 'Unnamed', chat_link: poi.chat_link, map_name: map.name || 'Unknown Map' });
                    }
                });
            }
        });
        gw2Data.waypoints = waypoints.sort((a, b) => a.name.localeCompare(b.name));
        populateWaypointMapFilter();
    } catch (e) { console.error(e); }
}
function populateWaypointMapFilter() {
    const filter = document.getElementById('waypoint-map-filter');
    const maps = [...new Set(gw2Data.waypoints.map(w => w.map_name))].sort();
    filter.innerHTML = '<option value="all">All Maps</option>';
    maps.forEach(mapName => { const opt = document.createElement('option'); opt.value = mapName; opt.textContent = mapName; filter.appendChild(opt); });
}
function filterWaypoints() {
    const search = document.getElementById('waypoint-search').value.toLowerCase();
    const mapFilter = document.getElementById('waypoint-map-filter').value;
    const list = document.getElementById('waypoint-list');
    const filtered = gw2Data.waypoints.filter(wp => {
        const wpName = (wp.name || 'Unknown').toLowerCase();
        const wpMapName = (wp.map_name || 'Unknown Map').toLowerCase();
        return (wpName.includes(search) || wpMapName.includes(search)) && (mapFilter === 'all' || wp.map_name === mapFilter);
    });
    list.innerHTML = filtered.slice(0, 100).map(wp => '<div class="armory-item" onclick="insertWaypointFromModal(\'' + (wp.chat_link || '').replace(/'/g, "\\'") + '\', \'' + (wp.name || 'Unknown').replace(/'/g, "\\'") + '\')"><div class="armory-item-icon" style="background-image: url(https://qjv.dev.br/map/icons/waypoint.png); background-size: contain; background-repeat: no-repeat; background-position: center;"></div><div class="armory-item-info"><div class="armory-item-name">' + (wp.name || 'Unknown') + '</div><div class="armory-item-id">' + (wp.map_name || 'Unknown') + '</div></div></div>').join('');
}
function insertWaypointFromModal(link, name) { insertMarkdown('[wp:' + link + ']' + name + '[/wp]', ''); closeWaypointModal(); }
function insertWaypoint() { openWaypointModal(); }
function insertTraitline() { openTraitlineModal(); }

// Traitline Logic
async function openTraitlineModal() {
    document.getElementById('traitline-modal').classList.add('active');
    currentTraitSelections = { spec: null, trait1: null, trait2: null, trait3: null };
    document.getElementById('traits-container').style.display = 'none';
    document.getElementById('insert-trait-btn').style.display = 'none';
    resetDropdown('spec-input'); resetDropdown('trait1-input'); resetDropdown('trait2-input'); resetDropdown('trait3-input');
    if (gw2Data.specializations.length === 0) await loadSpecializations();
    setupDropdown('spec', gw2Data.specializations, onSpecSelect);
}
function closeTraitlineModal() { document.getElementById('traitline-modal').classList.remove('active'); document.querySelectorAll('.dropdown-options').forEach(el => el.classList.remove('show')); }
async function loadSpecializations() {
    try {
        const specsRes = await fetch('https://api.guildwars2.com/v2/specializations?ids=all');
        const specs = await specsRes.json();
        gw2Data.specializations = specs.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) { console.error(e); }
}
function resetDropdown(id) { const i = document.getElementById(id); i.value = ''; i.dataset.id = ''; }
function setupDropdown(type, data, cb) {
    const input = document.getElementById(type + '-input');
    const list = document.getElementById(type + '-options');
    const render = (txt='') => {
        list.innerHTML = '';
        const lower = txt.toLowerCase();
        const filtered = data.filter(d => d.name.toLowerCase().includes(lower));
        filtered.forEach(d => {
            const div = document.createElement('div'); div.className = 'dropdown-item';
            div.onclick = () => { input.value = d.name; input.dataset.id = d.id; list.classList.remove('show'); if (cb) cb(d); };
            div.innerHTML = `<img src="${d.icon||''}" alt=""><div class="dropdown-info"><div class="dropdown-name">${d.name}</div><div class="dropdown-id">ID: ${d.id}</div></div>`;
            list.appendChild(div);
        });
    };
    input.onfocus = () => { render(input.value); list.classList.add('show'); };
    input.oninput = () => {
        // Clear selection if user modifies the text
        if (input.value === '') {
            input.dataset.id = '';
            if (type.startsWith('trait')) {
                const traitNum = type.replace('trait', '');
                currentTraitSelections['trait' + traitNum] = null;
            } else if (type === 'spec') {
                currentTraitSelections.spec = null;
                currentTraitSelections.trait1 = null;
                currentTraitSelections.trait2 = null;
                currentTraitSelections.trait3 = null;
                // Hide traits container and insert button when spec is cleared
                document.getElementById('traits-container').style.display = 'none';
                document.getElementById('insert-trait-btn').style.display = 'none';
                // Clear trait inputs
                resetDropdown('trait1-input');
                resetDropdown('trait2-input');
                resetDropdown('trait3-input');
            }
        }
        render(input.value);
        list.classList.add('show');
    };
    document.addEventListener('click', (e) => { if (!e.target.closest(`#${type}-dropdown`)) list.classList.remove('show'); });
}
async function onSpecSelect(spec) {
    currentTraitSelections.spec = spec.id;
    if (!spec.major_traits) {
        try { const res = await fetch('https://api.guildwars2.com/v2/specializations/' + spec.id); const full = await res.json(); spec.major_traits = full.major_traits; } catch(e){}
    }
    const needed = spec.major_traits || [];
    const missing = needed.filter(tid => !gw2Data.traits.find(t => t.id === tid));
    if (missing.length > 0) { try { const res = await fetch('https://api.guildwars2.com/v2/traits?ids=' + missing.join(',')); const newT = await res.json(); gw2Data.traits.push(...newT); } catch(e){} }
    
    const getT = (idxs) => idxs.map(i => gw2Data.traits.find(t => t.id === spec.major_traits[i])).filter(Boolean);
    setupDropdown('trait1', getT([0,1,2]), (t) => currentTraitSelections.trait1 = t.id);
    setupDropdown('trait2', getT([3,4,5]), (t) => currentTraitSelections.trait2 = t.id);
    setupDropdown('trait3', getT([6,7,8]), (t) => currentTraitSelections.trait3 = t.id);
    
    document.getElementById('traits-container').style.display = 'flex';
    document.getElementById('insert-trait-btn').style.display = 'block';
}
function insertTraitlineFromModal() {
    if (!currentTraitSelections.spec) return;
    const tag = `[traitline:${currentTraitSelections.spec}:${currentTraitSelections.trait1||0}:${currentTraitSelections.trait2||0}:${currentTraitSelections.trait3||0}]`;
    insertMarkdown(tag, ''); closeTraitlineModal();
}

// ==========================================
// 7. EVENTS & SYNC
// ==========================================

function syncOverlay() {
    reviewOverlay.scrollTop = input.scrollTop;
    reviewOverlay.scrollLeft = input.scrollLeft;
}

// Initialize
window.onload = function() {
    if (scItemData.length > 0) populateArmoryList(scItemData);
    updatePreview();
    syncOverlay();
};

input.addEventListener('input', () => { 
    reviewOverlay.textContent = input.value; 
    updatePreview(); 
    debouncedScan(); 
    requestAnimationFrame(syncOverlay);
});

input.addEventListener('scroll', syncOverlay);
window.addEventListener('resize', syncOverlay);
// reviewOverlay.addEventListener('click', function() { cancelReviewMode(); input.focus(); });