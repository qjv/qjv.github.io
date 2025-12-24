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

// Session-based ignore list
let sessionIgnoreList = new Set();

// GW2 API data cache
let gw2Data = {
    items: [],
    skills: [],
    traits: [],
    loaded: false,
    loading: false
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
    else statusBar.style.color = '#999';
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
    
    if (fromInput && matches.length === 0) {
        if (reviewState.active) cancelReviewMode();
        return;
    }

    if (!fromInput && matches.length === 0) {
        setStatus("No matches found.", "normal");
        return;
    }

    reviewState.matches = matches;

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
    
    matches.forEach(m => {
        const selected = m.candidates[0];
        const tag = selected.source === 'sc' 
            ? '[sc:' + selected.id + ']' + selected.name + '[/sc]'
            : '[gw2:' + selected.id + ':' + selected.type + ']';
        text = text.substring(0, m.start) + tag + text.substring(m.end);
    });

    const oldLength = input.value.length;
    input.value = text;
    const newLength = text.length;
    
    const cursor = input.selectionStart;
    if (cursor > matches[matches.length-1].start) {
        input.setSelectionRange(cursor + (newLength - oldLength), cursor + (newLength - oldLength));
    }
    
    updatePreview();
}

function startReviewMode() {
    reviewState.active = true;
    renderReviewOverlay(input.value, reviewState.matches);
    reviewOverlay.style.display = 'block';
    setStatus("Suggestions available - hover to select or click to continue typing", "normal");
}

function manualScan() {
    runScan(false);
}

function cancelReviewMode() {
    reviewState.active = false;
    reviewState.matches = [];
    reviewOverlay.style.display = 'none';
    suggestionTooltip.classList.remove('active');
}

// -------------------
// MATCHING LOGIC WITH SC SUPPORT
// -------------------

function findMatches(text, includeSC = true) {
    const allData = [];
    
    // Add GW2 data if enabled
    const suggestSkills = document.getElementById('suggest-skills').checked;
    const suggestItems = document.getElementById('suggest-items').checked;
    const suggestTraits = document.getElementById('suggest-traits').checked;
    
    if (gw2Data.loaded) {
        if (suggestSkills) {
            gw2Data.skills.forEach(s => {
                allData.push({...s, type: 'skill', source: 'gw2'});
            });
        }
        if (suggestItems) {
            gw2Data.items.forEach(i => {
                allData.push({...i, type: 'item', source: 'gw2'});
            });
        }
        if (suggestTraits) {
            gw2Data.traits.forEach(t => {
                allData.push({...t, type: 'trait', source: 'gw2'});
            });
        }
    }
    
    // Add SC armory data if enabled
    if (includeSC && typeof armoryData !== 'undefined') {
        armoryData.forEach(a => {
            allData.push({...a, type: 'sc', source: 'sc'});
        });
    }
    
    const nameMap = new Map();
    allData.forEach(d => {
        if(!d.name) return;
        const normalizedName = d.name.toLowerCase();
        if (sessionIgnoreList.has(normalizedName)) return; // Skip ignored words
        if (!nameMap.has(d.name)) nameMap.set(d.name, []);
        nameMap.get(d.name).push(d);
    });

    const matches = [];
    const safeMode = document.getElementById('safe-mode').checked;
    const sortedNames = Array.from(nameMap.keys()).sort((a, b) => b.length - a.length);

    sortedNames.forEach(name => {
        const candidates = nameMap.get(name);
        
        const regexStr = safeMode ? '<(' + escapeRegex(name) + ')>' : '\\b(' + escapeRegex(name) + ')\\b';
        const regex = new RegExp(regexStr, 'gi');
        
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            
            if (!matches.some(m => (start < m.end && end > m.start))) {
                matches.push({
                    start,
                    end,
                    text: match[0],
                    cleanName: name,
                    candidates: candidates,
                    selectedCandidate: null
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
        if (isSCOnly && !isAmbiguous) {
            classes += 'sc-tag';
        } else if (isAmbiguous) {
            classes += 'ambiguous';
        } else {
            classes += 'resolved';
        }
        
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
// TOOLTIP LOGIC WITH SKIP OPTIONS
// -------------------
let tooltipTimeout;

function showTooltip(e, matchIdx) {
    clearTimeout(tooltipTimeout);
    const match = reviewState.matches[matchIdx];
    const rect = e.target.getBoundingClientRect();
    const tooltip = suggestionTooltip;
    
    let html = '<div style="margin-bottom:5px; font-weight:bold; color:#fff; border-bottom:1px solid #333; padding-bottom:5px;">' + match.cleanName + '</div>';
    
    // Skip options
    html += '<div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">';
    html += '<button onclick="skipMatch(' + matchIdx + ')" style="flex:1; padding:0.4rem; background:#ef4444; border:none; border-radius:4px; color:white; font-size:0.75rem; cursor:pointer; font-weight:600;">Skip This</button>';
    html += '<button onclick="skipForSession(\'' + escapeHtml(match.cleanName).replace(/'/g, "\\'") + '\')" style="flex:1; padding:0.4rem; background:#f59e0b; border:none; border-radius:4px; color:white; font-size:0.75rem; cursor:pointer; font-weight:600;">Skip All</button>';
    html += '</div>';
    
    // Group by source
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
    reviewState.matches.splice(matchIdx, 1);
    suggestionTooltip.classList.remove('active');
    
    if (reviewState.matches.length === 0) {
        cancelReviewMode();
    } else {
        renderReviewOverlay(input.value, reviewState.matches);
    }
    setStatus('Suggestion skipped', 'normal');
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
    
    const text = input.value;
    const newText = text.substring(0, match.start) + tag + text.substring(match.end);
    input.value = newText;
    
    updatePreview();
    suggestionTooltip.classList.remove('active');
    
    const suggestSC = document.getElementById('suggest-sc').checked;
    runScan(true); 
}

// -------------------
// CACHING & DATA
// -------------------

async function loadGW2Data() {
    if (gw2Data.loaded) return;
    
    // Check if armory-gw2.js is loaded
    if (typeof gw2ArmoryData !== 'undefined') {
        gw2Data.items = gw2ArmoryData.items || [];
        gw2Data.skills = gw2ArmoryData.skills || [];
        gw2Data.traits = gw2ArmoryData.traits || [];
        gw2Data.loaded = true;
        setStatus('Loaded ' + gw2Data.items.length + ' items, ' + gw2Data.skills.length + ' skills, ' + gw2Data.traits.length + ' traits from armory-gw2.js', 'success');
        return;
    }
    
    gw2Data.loading = true;
    setStatus('Checking API version...', 'normal');

    try {
        const buildRes = await fetch('https://api.guildwars2.com/v2/build');
        const buildJson = await buildRes.json();
        const currentBuild = buildJson.id;

        const cachedBuild = localStorage.getItem(CACHE_KEY_BUILD);
        const cachedData = localStorage.getItem(CACHE_KEY_DATA);

        if (cachedBuild == currentBuild && cachedData) {
            try {
                gw2Data = JSON.parse(cachedData);
                gw2Data.loaded = true;
                gw2Data.loading = false;
                setStatus('Loaded cache (Build ' + currentBuild + ').', 'success');
                return;
            } catch (e) {
                console.warn("Cache corrupted", e);
            }
        }

        setStatus('Fetching fresh API data...', 'normal');
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
            const dataToSave = {
                items: gw2Data.items,
                skills: gw2Data.skills,
                traits: gw2Data.traits,
                loaded: true,
                loading: false
            };
            localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(dataToSave));
            localStorage.setItem(CACHE_KEY_BUILD, currentBuild);
            setStatus('Cache rebuilt & saved.', 'success');
        } catch(e) {
            setStatus('Loaded (Cache full/disabled).', 'success');
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
    input.value = text.substring(0, start) + '[sc:' + id + ']' + sel + '[/sc]' + text.substring(end);
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
    if(type==='all'||type==='items') {
        gw2Data.items.filter(i=>i.name.toLowerCase().includes(search)).forEach(i => {
            res.push({...i, type:'item'});
        });
    }
    if(type==='all'||type==='skills') {
        gw2Data.skills.filter(s=>s.name.toLowerCase().includes(search)).forEach(s => {
            res.push({...s, type:'skill'});
        });
    }
    if(type==='all'||type==='traits') {
        gw2Data.traits.filter(t=>t.name.toLowerCase().includes(search)).forEach(t => {
            res.push({...t, type:'trait'});
        });
    }
    
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
    insertMarkdown('[gw2:' + id + ':' + type + ']', ''); 
    closeGW2Modal();
}

function toggleSuggestions() {
    document.getElementById('suggestions-panel').classList.toggle('active');
}

function insertMarkdown(before, after) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    input.value = newText;
    const newCursorPos = start + before.length + selectedText.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    input.focus();
    updatePreview();
}

function parseNestedLists(lines) {
    const result = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const unorderedMatch = line.match(/^( *)- (.+)$/);
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

function parseMarkdown(text) {
    text = text.replace(/<([^>]+)>/g, '$1');

    text = text.replace(/\[sc:(\d+)\](.*?)\[\/sc\]/g, function(match, id, content) {
        const item = armoryData.find(i => i.id == id);
        const displayName = content || (item ? item.name : 'ID:' + id);
        if (!content) {
            return '<span data-armory-id="' + id + '" data-armory-title="' + displayName + '" title="' + displayName + '" aria-label="' + displayName + '" role="img" class="sc-armory-custom capitalize"><span class="text-orange-200"><span class="w-5 h-5 inline-block relative top-1 bg-cover" style="background-image: url(https://assets.snowcrows.com/images/sc-armory/bleeding.png)"></span></span></span>';
        }
        return '<span data-armory-id="' + id + '" data-armory-title="' + displayName + '" title="' + displayName + '" aria-label="' + displayName + '" role="img" class="sc-armory-custom capitalize"><span class="text-orange-200"><span class="w-5 h-5 inline-block mr-1 relative top-1 bg-cover" style="background-image: url(https://assets.snowcrows.com/images/sc-armory/bleeding.png)"></span>' + displayName + '</span></span>';
    });

    text = text.replace(/\[gw2:(\d+):skill\]/g, '<span style="display: inline-flex; align-items: center; vertical-align: middle;" data-armory-embed="skills" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');
    text = text.replace(/\[gw2:(\d+):trait\]/g, '<span style="display: inline-flex; align-items: center; vertical-align: middle;" data-armory-embed="traits" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');
    text = text.replace(/\[gw2:(\d+):item\]/g, '<span style="display: inline-flex; align-items: center; vertical-align: middle;" data-armory-embed="items" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>');

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
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    text = text.replace(/  \n/g, '<br>\n');

    const lines = text.split('\n');
    text = parseNestedLists(lines);

    text = text.replace(/^&gt; (.+)$/gim, '<blockquote>$1</blockquote>');
    text = text.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

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
    
    const oldScript = document.querySelector('script[src*="armory-embeds"]');
    if (oldScript) oldScript.remove();
    
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://unpkg.com/armory-embeds@^0.x.x/armory-embeds.js';
    document.body.appendChild(script);
}, 1000);

function updatePreview() {
    debouncedPreview();
}

const debouncedScan = debounce(function() {
    if (document.getElementById('scan-as-type').checked) {
        runScan(true);
    }
}, 500);

input.addEventListener('input', function() {
    updatePreview();
    debouncedScan();
});

// Allow clicking on overlay to dismiss and continue typing
reviewOverlay.addEventListener('click', function() {
    cancelReviewMode();
    input.focus();
});

input.addEventListener('scroll', function() { 
    reviewOverlay.scrollTop = input.scrollTop; 
});

// Check for armory updates
async function checkArmoryUpdates() {
    if (typeof gw2ArmoryData === 'undefined') {
        console.log('No armory data loaded');
        return;
    }

    const lastCheck = localStorage.getItem('armory_last_check');
    const lastCheckDate = lastCheck ? new Date(lastCheck) : null;
    const now = new Date();
    
    if (lastCheckDate && (now - lastCheckDate) < 24 * 60 * 60 * 1000) {
        const cachedResult = localStorage.getItem('armory_outdated');
        if (cachedResult === 'true') {
            showUpdateWarning(JSON.parse(localStorage.getItem('armory_update_details')));
        }
        return;
    }

    try {
        const itemIds = await fetch('https://api.guildwars2.com/v2/items').then(r => r.json()).catch(() => []);
        const skillIds = await fetch('https://api.guildwars2.com/v2/skills').then(r => r.json()).catch(() => []);
        const traitIds = await fetch('https://api.guildwars2.com/v2/traits').then(r => r.json()).catch(() => []);

        const currentHighest = {
            item: Math.max(...itemIds),
            skill: Math.max(...skillIds),
            trait: Math.max(...traitIds)
        };

        const fileHighest = gw2ArmoryData.metadata?.highestIds || {
            item: Math.max(...gw2ArmoryData.items.map(i => i.id)),
            skill: Math.max(...gw2ArmoryData.skills.map(s => s.id)),
            trait: Math.max(...gw2ArmoryData.traits.map(t => t.id))
        };

        const itemsDiff = currentHighest.item - fileHighest.item;
        const skillsDiff = currentHighest.skill - fileHighest.skill;
        const traitsDiff = currentHighest.trait - fileHighest.trait;

        const isOutdated = itemsDiff > 0 || skillsDiff > 0 || traitsDiff > 0;

        localStorage.setItem('armory_last_check', now.toISOString());
        localStorage.setItem('armory_outdated', isOutdated.toString());

        if (isOutdated) {
            const details = {
                items: itemsDiff > 0 ? itemsDiff + ' new items' : null,
                skills: skillsDiff > 0 ? skillsDiff + ' new skills' : null,
                traits: traitsDiff > 0 ? traitsDiff + ' new traits' : null,
                generated: gw2ArmoryData.metadata?.generated || 'Unknown'
            };
            localStorage.setItem('armory_update_details', JSON.stringify(details));
            showUpdateWarning(details);
        } else {
            localStorage.setItem('armory_update_details', null);
        }

    } catch (error) {
        console.error('Error checking armory updates:', error);
    }
}

function showUpdateWarning(details) {
    const warning = document.getElementById('update-warning');
    const detailsEl = document.getElementById('update-details');
    
    const updates = [details.items, details.skills, details.traits].filter(Boolean);
    const updateText = updates.length > 0 ? updates.join(', ') : 'New content available';
    const generatedDate = details.generated ? new Date(details.generated).toLocaleDateString() : 'Unknown';
    
    detailsEl.textContent = updateText + ' detected. Your armory was generated on ' + generatedDate + '. Run the generator to update!';
    warning.style.display = 'block';
}

function dismissWarning() {
    document.getElementById('update-warning').style.display = 'none';
}

window.onload = function() {
    updatePreview();
    setTimeout(checkArmoryUpdates, 2000);
};

function escapeRegex(s) { 
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

function escapeHtml(s) { 
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
}