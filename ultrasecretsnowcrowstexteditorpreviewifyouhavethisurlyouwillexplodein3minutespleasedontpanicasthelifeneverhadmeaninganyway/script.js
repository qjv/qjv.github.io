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
    if (!gw2Data.loaded) {
        if (!fromInput) await loadGW2Data(); 
        else return;
    }
    
    const isAutoReplace = document.getElementById('auto-replace').checked;
    const text = input.value;
    const matches = findMatches(text);
    
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
            // After replacement, verify if ambiguous matches remain
            const newText = input.value;
            const newMatches = findMatches(newText);
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
        const tag = `[gw2:${selected.id}:${selected.type}]`;
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
    input.style.display = 'none'; 
    input.focus();
    setStatus("Review Mode: Yellow matches are ambiguous.", "normal");
}

function manualScan() {
    runScan(false);
}

function cancelReviewMode() {
    reviewState.active = false;
    reviewState.matches = [];
    reviewOverlay.style.display = 'none';
    input.style.display = 'block';
    input.focus();
    suggestionTooltip.classList.remove('active');
}

// -------------------
// MATCHING LOGIC
// -------------------

function findMatches(text) {
    const allData = [
        ...gw2Data.skills.map(s => ({...s, type: 'skill'})),
        ...gw2Data.items.map(i => ({...i, type: 'item'})),
        ...gw2Data.traits.map(t => ({...t, type: 'trait'}))
    ];
    
    const nameMap = new Map();
    allData.forEach(d => {
        if(!d.name) return;
        if (!nameMap.has(d.name)) nameMap.set(d.name, []);
        nameMap.get(d.name).push(d);
    });

    const matches = [];
    const safeMode = document.getElementById('safe-mode').checked;
    const sortedNames = Array.from(nameMap.keys()).sort((a, b) => b.length - a.length);

    sortedNames.forEach(name => {
        const candidates = nameMap.get(name);
        
        // SAFE MODE: Only match <Word>
        // NORMAL: Match Word
        const regexStr = safeMode ? `<(${escapeRegex(name)})>` : `\\b(${escapeRegex(name)})\\b`;
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
        const classes = `review-highlight ${isAmbiguous ? 'ambiguous' : 'resolved'}`;
        
        let content = escapeHtml(m.text);
        if (content.startsWith('&lt;') && content.endsWith('&gt;')) {
            content = `<span class="hidden-bracket">&lt;</span>${escapeHtml(m.cleanName)}<span class="hidden-bracket">&gt;</span>`;
        }

        html += `<span class="${classes}" onmouseenter="showTooltip(event, ${idx})" onmouseleave="hideTooltipCheck(event)">${content}</span>`;
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
    
    let html = `<div style="margin-bottom:5px; font-weight:bold; color:#fff; border-bottom:1px solid #333; padding-bottom:5px;">${match.cleanName}</div>`;
    
    match.candidates.forEach(c => {
        const iconStyle = c.icon ? `background-image: url(${c.icon})` : 'background: #444';
        
        html += `
            <div class="tooltip-option" onclick="selectCandidate(${matchIdx}, ${c.id}, '${c.type}')">
                <div class="tooltip-icon" style="${iconStyle}"></div>
                <div>
                    <div style="color:white;">${c.name}</div>
                    <div style="font-size:0.75rem; color:#888;">${c.type} (ID: ${c.id})</div>
                </div>
            </div>
        `;
    });

    tooltip.innerHTML = html;
    tooltip.classList.add('active');

    const viewportHeight = window.innerHeight;
    const tooltipHeight = tooltip.offsetHeight;
    if (rect.bottom + tooltipHeight + 10 > viewportHeight) {
        tooltip.style.top = `${rect.top - tooltipHeight - 5}px`;
    } else {
        tooltip.style.top = `${rect.bottom + 5}px`;
    }
    tooltip.style.left = `${rect.left}px`;
    
    tooltip.onmouseenter = () => clearTimeout(tooltipTimeout);
    tooltip.onmouseleave = () => tooltip.classList.remove('active');
}

function hideTooltipCheck(e) {
    tooltipTimeout = setTimeout(() => {
        suggestionTooltip.classList.remove('active');
    }, 100);
}

function selectCandidate(matchIdx, id, type) {
    const match = reviewState.matches[matchIdx];
    const tag = `[gw2:${id}:${type}]`;
    const text = input.value;
    
    const newText = text.substring(0, match.start) + tag + text.substring(match.end);
    input.value = newText;
    
    updatePreview();
    suggestionTooltip.classList.remove('active');
    
    runScan(true); 
}

// -------------------
// CACHING & DATA
// -------------------

async function loadGW2Data() {
    if (gw2Data.loaded) return;
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
                setStatus(`Loaded cache (Build ${currentBuild}).`, 'success');
                return;
            } catch (e) {
                console.warn("Cache corrupted", e);
            }
        }

        setStatus('Fetching fresh API data...', 'normal');
        const [skills, traits, itemIds] = await Promise.all([
            fetch('https://api.guildwars2.com/v2/skills?ids=all').then(r=>r.json()),
            fetch('https://api.guildwars2.com/v2/traits?ids=all').then(r=>r.json()),
            fetch('https://api.guildwars2.com/v2/items').then(r=>r.json())
        ]);
        
        gw2Data.skills = skills;
        gw2Data.traits = traits;
        gw2Data.items = [];
        
        // Fetch more items, but still batched
        const batchSize = 200;
        const limit = 30000;
        const idsToFetch = itemIds.slice(0, limit);
        
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
            const chunk = idsToFetch.slice(i, i + batchSize);
            const items = await fetch(`https://api.guildwars2.com/v2/items?ids=${chunk.join(',')}`).then(r=>r.json());
            gw2Data.items.push(...items);
            setStatus(`Fetching items... ${gw2Data.items.length}/${idsToFetch.length}`);
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
    armoryList.innerHTML = items.map(item => `
        <div class="armory-item" onclick="insertArmoryTag(${item.id}, '${item.name.replace(/'/g, "\\'")}')">
            <div class="armory-item-icon"></div>
            <div class="armory-item-info">
                <div class="armory-item-name">${item.name}</div>
                <div class="armory-item-id">[sc:${item.id}]</div>
            </div>
        </div>
    `).join('');
}
populateArmoryList();

function filterArmory() {
    const search = armorySearch.value.toLowerCase();
    const filtered = armoryData.filter(item => 
        item.name.toLowerCase().includes(search) || item.id.toString().includes(search)
    );
    populateArmoryList(filtered);
}

function openArmoryModal() { modal.classList.add('active'); armorySearch.value=''; armorySearch.focus(); populateArmoryList(); }
function closeArmoryModal() { modal.classList.remove('active'); }

function insertArmoryTag(id, name) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const sel = text.substring(start, end) || name;
    input.value = text.substring(0, start) + `[sc:${id}]${sel}[/sc]` + text.substring(end);
    closeArmoryModal();
    updatePreview();
}

function openGW2Modal() {
    const m = document.getElementById('gw2-modal');
    m.classList.add('active');
    if(!gw2Data.loaded) loadGW2Data();
    filterGW2();
}
function closeGW2Modal() { document.getElementById('gw2-modal').classList.remove('active'); }

function filterGW2() {
    if(!gw2Data.loaded) return;
    const search = document.getElementById('gw2-search').value.toLowerCase();
    const type = document.getElementById('gw2-type-filter').value;
    const list = document.getElementById('gw2-list');
    
    let res = [];
    if(type==='all'||type==='items') res.push(...gw2Data.items.filter(i=>i.name.toLowerCase().includes(search)).map(i=>({...i, type:'item'})));
    if(type==='all'||type==='skills') res.push(...gw2Data.skills.filter(s=>s.name.toLowerCase().includes(search)).map(s=>({...s, type:'skill'})));
    if(type==='all'||type==='traits') res.push(...gw2Data.traits.filter(t=>t.name.toLowerCase().includes(search)).map(t=>({...t, type:'trait'})));
    
    list.innerHTML = res.slice(0,50).map(i => `
        <div class="armory-item" onclick="insertGW2Tag(${i.id}, '${i.type}')">
            <div class="armory-item-icon" style="background-image: url(${i.icon||''})"></div>
            <div class="armory-item-info">
                <div class="armory-item-name">${i.name}</div>
                <div class="armory-item-id">${i.type}</div>
            </div>
        </div>
    `).join('');
}

function insertGW2Tag(id, type) {
    insertMarkdown(`[gw2:${id}:${type}]`, ''); 
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
            html += `</${lastType}>`;
        }
        if (stack.length < level + 1) {
            while (stack.length < level + 1) {
                html += `<${item.type}>`;
                stack.push(item.type);
            }
        }
        if (stack.length === level + 1 && stack[level] !== item.type) {
            html += `</${stack[level]}>`;
            stack[level] = item.type;
            html += `<${item.type}>`;
        }
        html += `<li>${item.content}</li>`;
    }
    while (stack.length > 0) {
        const lastType = stack.pop();
        html += `</${lastType}>`;
    }
    return html;
}

function parseMarkdown(text) {
    text = text.replace(/<([^>]+)>/g, '$1');

    text = text.replace(/\[sc:(\d+)\](.*?)\[\/sc\]/g, (match, id, content) => {
        const item = armoryData.find(i => i.id == id);
        const displayName = content || (item ? item.name : `ID:${id}`);
        if (!content) {
            return `<span data-armory-id="${id}" data-armory-title="${displayName}" title="${displayName}" aria-label="${displayName}" role="img" class="sc-armory-custom capitalize"><span class="text-orange-200"><span class="w-5 h-5 inline-block relative top-1 bg-cover" style="background-image: url(https://assets.snowcrows.com/images/sc-armory/bleeding.png)"></span></span></span>`;
        }
        return `<span data-armory-id="${id}" data-armory-title="${displayName}" title="${displayName}" aria-label="${displayName}" role="img" class="sc-armory-custom capitalize"><span class="text-orange-200"><span class="w-5 h-5 inline-block mr-1 relative top-1 bg-cover" style="background-image: url(https://assets.snowcrows.com/images/sc-armory/bleeding.png)"></span>${displayName}</span></span>`;
    });

	text = text.replace(/\[gw2:(\d+):skill\]/g, `<span style="display: inline-flex; align-items: baseline; vertical-align: middle;" data-armory-embed="skills" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>`);
    text = text.replace(/\[gw2:(\d+):trait\]/g, `<span style="display: inline-flex; align-items: baseline; vertical-align: middle;" data-armory-embed="traits" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>`);
    text = text.replace(/\[gw2:(\d+):item\]/g, `<span style="display: inline-flex; align-items: baseline; vertical-align: middle;" data-armory-embed="items" data-armory-ids="$1" data-armory-size="20" data-armory-inline-text="wiki"></span>`);

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

// FIXED: Script re-injection to force Armory scan, but debounced to 1s
const debouncedPreview = debounce(() => {
    const markdown = input.value;
    const html = parseMarkdown(markdown);
    preview.innerHTML = html;
    
    // Logic to reload the armory script and trigger a DOM scan
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

const debouncedScan = debounce(() => {
    if (document.getElementById('scan-as-type').checked) {
        runScan(true);
    }
}, 500);

input.addEventListener('input', () => {
    updatePreview();
    debouncedScan();
});

input.addEventListener('scroll', () => { reviewOverlay.scrollTop = input.scrollTop; });
window.onload = updatePreview;

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
