// --- STATIC DATA ---
const encounters = {
    "Wing 1: Spirit Vale": { "Vale Guardian": { roles: ["Seeker Control", "Tank"] }, "Spirit Run": { roles: ["Portal"] }, "Gorseval": { roles: ["Tank"] }, "Sabetha": { roles: ["Cannon 1/3", "Cannon 2/4", "Kiter"] } },
    "Wing 2: Salvation Pass": { "Slothasor": { roles: ["Mushroom 1", "Mushroom 2", "Mushroom 3", "Mushroom 4"] }, "Bandit Trio": { roles: ["Mortar"] }, "Matthias Gabrel": { roles: ["Reflect"] } },
    "Wing 3: Stronghold of the Faithful": { "Escort": { roles: ["Tower", "Back Warg"] }, "Keep Construct": { roles: ["Pusher"] }, "Xera": { roles: ["Tank"] } },
    "Wing 4: Bastion of the Penitent": { "Cairn": { roles: ["Baiter"] }, "Mursaat Overseer": { roles: ["Claim", "Dispel", "Protect"] }, "Samarog": { roles: ["Pusher", "Baiter"] }, "Deimos": { roles: ["Tank", "Hand Kiter", "Oil Kiter"] } },
    "Wing 5: Hall of Chains": { "Soulless Horror": { roles: ["Tank", "Pusher"] }, "River of Souls": { roles: ["Superspeed", "Desmina Healer"] }, "Statues of Grenth": { roles: ["Light Orb"] }, "Dhuum": { roles: ["Tank", "Kiter", "Green 1", "Green 2", "Green 3"] } },
    "Wing 6: Mythwright Gambit": { "Conjured Amalgamate": { roles: ["Swords", "Shields"] }, "Twin Largos": { roles: ["Kenut kiter"] }, "Qadim": { roles: ["Matriarch Tank", "Lamp", "Kiter", "Portal"] } },
    "Wing 7: The Key of Ahdashim": { "Cardinal Adina": { roles: ["Pillars", "Tank", "Bubble"] }, "Cardinal Sabir": { roles: ["Pylons", "Portal", "Bubble"] }, "Qadim the Peerless": { roles: ["Pylons", "Tank"] } },
    "Wing 8: Mount Balrior": { "Decima, the Stormsinger": { roles: ["Ranged", "Melee", "Kiter"] }, "Greer, the Plaguebringer": { roles: ["Tank", "Bubble"] }, "Ura, the Steamshrieker": { roles: ["Bloodstone"] } }
};
const primaryRoles = {
    'alac_h': 'Alacrity Healer',
    'quick_h': 'Quickness Healer',
    'alac_dps': 'Alacrity DPS',
    'quick_dps': 'Quickness DPS',
    'dps': 'DPS'
};
const boonIcons = {
    'alac_h': 'https://wiki.guildwars2.com/images/6/6f/Time_Trial.png?20180207180213',
    'quick_h': 'https://wiki.guildwars2.com/images/6/62/Registered.png',
    'alac_dps': 'https://wiki.guildwars2.com/images/4/4c/Alacrity.png',
    'quick_dps': 'https://wiki.guildwars2.com/images/b/b4/Quickness.png',
    'dps': 'https://wiki.guildwars2.com/images/9/9f/Volatile_Explosives.png'
};
const subroleColors = {
    'Tank': 'border-cyan-400', 'Baiter': 'border-cyan-400', 'Matriarch Tank': 'border-cyan-400',
    'Kiter': 'border-amber-400', 'Hand Kiter': 'border-amber-400', 'Oil Kiter': 'border-amber-400', 'Pylon Kiter': 'border-amber-400', 'Kenut kiter': 'border-amber-400',
    'Green 1': 'border-green-500', 'Green 2': 'border-green-400', 'Green 3': 'border-green-300',
    'Cannon 1/3': 'border-orange-500', 'Cannon 2/4': 'border-orange-400', 'Mortar': 'border-red-500',
    'Portal': 'border-fuchsia-500',
    'Seeker Control': 'border-indigo-400', 'Light Orb': 'border-yellow-200', 'Bloodstone': 'border-red-600',
    'Reflect': 'border-sky-300', 'Pusher': 'border-rose-400',
    'Lamp': 'border-yellow-300', 'Bubble': 'border-blue-400', 'Pylons': 'border-amber-300',
    'Superspeed': 'border-pink-400', 'Desmina Healer': 'border-pink-300',
    'Claim': 'border-violet-500', 'Dispel': 'border-violet-400', 'Protect': 'border-violet-300',
    'Tower': 'border-stone-400', 'Back Warg': 'border-stone-500',
    'Swords': 'border-rose-500', 'Shields': 'border-sky-500',
    'Ranged': 'border-teal-300', 'Melee': 'border-orange-400',
    'Mushroom 1': 'border-emerald-600', 'Mushroom 2': 'border-emerald-500', 'Mushroom 3': 'border-emerald-400', 'Mushroom 4': 'border-emerald-300'
};

// --- STATE MANAGEMENT ---
const emptySlot = { player: '', primaryRole: '', specificRole: '', damageType: '' };
const emptyStandardSlot = { player: '', primaryRole: '', damageType: '' };
let state = {
    roster: { main: Array(10).fill(''), reserves: [] },
    standardComp: {
        group1: Array(5).fill({...emptyStandardSlot}),
        group2: Array(5).fill({...emptyStandardSlot})
    },
    assignments: {},
    ui: { selectedWings: [], collapsedEncounters: [], collapsedWings: [], wingOrder: Object.keys(encounters) }
};

// --- DICTIONARIES FOR COMPRESSION ---
const allEncounterNames = Object.values(encounters).flatMap(wing => Object.keys(wing));
const allWingNames = Object.keys(encounters);
const allPrimaryRoleKeys = Object.keys(primaryRoles);
const allSpecificRoleKeys = [...new Set(Object.values(encounters).flatMap(wing => Object.values(wing).flatMap(enc => enc.roles)))];
const allDamageTypeKeys = ['Power', 'Condition', 'Any'];

// --- DOM ELEMENTS ---
const mainRosterGrid = document.getElementById('main-roster-grid');
const reserveRosterList = document.getElementById('reserve-roster-list');
const newReserveNameInput = document.getElementById('new-reserve-name');
const addReserveBtn = document.getElementById('add-reserve-btn');
const standardCompContainer = document.getElementById('standard-comp-container');
const wingSelector = document.getElementById('wing-selector');
const allEncountersContainer = document.getElementById('all-encounters-container');
const copyLinkBtn = document.getElementById('copy-link-btn');
const notificationModal = document.getElementById('notification-modal');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');
const exportBtn = document.getElementById('export-btn');

// --- INITIALIZATION ---
function initialize() {
    if (!loadStateFromUrl()) {
        Object.values(encounters).forEach(wing => {
            Object.keys(wing).forEach(encounterName => {
                state.assignments[encounterName] = JSON.parse(JSON.stringify(state.standardComp));
            });
        });
    }
    renderAll();
    setupActionButtons();
}

function setupActionButtons() {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleFileImport);
    exportBtn.addEventListener('click', exportStateToFile);
    copyLinkBtn.addEventListener('click', copyShareableLink);
}

// --- RENDER & UI ---
function renderAll() {
    renderRosterInputs();
    renderStandardComp();
    renderWingSelector();
    renderAllEncounters();
}

function renderRosterInputs() {
    mainRosterGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full p-2 text-base';
        input.placeholder = `Player ${i + 1}`;
        input.maxLength = 20;
        input.value = state.roster.main[i];
        input.dataset.index = i;
        input.addEventListener('input', handleMainRosterChange);
        mainRosterGrid.appendChild(input);
    }
    reserveRosterList.innerHTML = '';
    state.roster.reserves.forEach((name, i) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2';
        div.innerHTML = `<input type="text" class="w-full max-w-xs p-2 text-base" value="${name}" data-index="${i}" oninput="handleReserveRosterChange(event)" maxlength="20"><button class="text-gray-400 hover:text-red-500 font-bold" onclick="removeReserve(${i})"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg></button>`;
        reserveRosterList.appendChild(div);
    });
}

function renderStandardComp() {
    standardCompContainer.innerHTML = '';
    const roster = [...state.roster.main, ...state.roster.reserves].filter(n => n && n.trim());
    const grid = document.createElement('div');
    grid.className = 'mt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4';
    ['group1', 'group2'].forEach(groupKey => {
        const block = document.createElement('div');
        block.innerHTML = `<h4 class="font-bold mb-2 text-gray-300">${groupKey === 'group1' ? 'Group 1' : 'Group 2'}</h4>`;
        const container = document.createElement('div');
        container.className = 'space-y-2';
        state.standardComp[groupKey].forEach((slot, i) => {
            container.appendChild(createAssignmentSlot('standardComp', groupKey, i, slot, roster, []));
        });
        block.appendChild(container);
        grid.appendChild(block);
    });
    standardCompContainer.appendChild(grid);
}

function renderWingSelector() {
    wingSelector.innerHTML = '';
    state.ui.wingOrder.forEach(wingName => {
        const btn = document.createElement('button');
        btn.className = `px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors duration-200 ${ state.ui.selectedWings.includes(wingName) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500' }`;
        btn.textContent = `Wing ${Object.keys(encounters).indexOf(wingName) + 1}`;
        btn.title = wingName;
        btn.dataset.wingName = wingName;
        btn.draggable = true;
        btn.onclick = () => toggleWing(wingName);
        wingSelector.appendChild(btn);
    });
    setupWingDragAndDrop();
}

function renderAllEncounters() {
    allEncountersContainer.innerHTML = '';
    const roster = [...state.roster.main, ...state.roster.reserves].filter(n => n && n.trim());
    state.ui.wingOrder.forEach(wingName => {
        if (!state.ui.selectedWings.includes(wingName)) return;
        const isWingCollapsed = state.ui.collapsedWings.includes(wingName);
        const wingEncounters = encounters[wingName];
        const wingContainer = document.createElement('div');
        wingContainer.className = 'bg-gray-800 rounded-2xl shadow-2xl p-6 space-y-6';

        const wingHeader = document.createElement('div');
        wingHeader.className = 'flex justify-between items-center cursor-pointer';
        wingHeader.onclick = () => toggleWingCollapse(wingName);
        wingHeader.innerHTML = `<h2 class="text-xl font-bold text-white">${wingName}</h2><div class="flex items-center gap-2"><button class="btn-secondary text-xs ${isWingCollapsed ? 'hidden' : ''}" onclick="event.stopPropagation(); clearWingData('${wingName}');">Clear Data</button><div class="w-6 h-6 transition-transform duration-200 ${isWingCollapsed ? '-rotate-90' : 'rotate-0'}"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div></div>`;
        wingContainer.appendChild(wingHeader);

        const encountersList = document.createElement('div');
        encountersList.className = `space-y-6 ${isWingCollapsed ? 'hidden' : ''}`;
        Object.entries(wingEncounters).forEach(([name, data]) => {
            encountersList.appendChild(renderEncounter(name, data, roster));
        });
        wingContainer.appendChild(encountersList);
        allEncountersContainer.appendChild(wingContainer);
    });
}

function renderEncounter(name, data, roster) {
    const isCollapsed = state.ui.collapsedEncounters.includes(name);
    const assigned = new Set([...state.assignments[name].group1.map(s => s.player), ...state.assignments[name].group2.map(s => s.player)].filter(Boolean));
    const block = document.createElement('div');
    block.className = 'bg-gray-900/50 p-4 rounded-lg';

    const titleRow = document.createElement('div');
    titleRow.className = 'flex justify-between items-center cursor-pointer';
    titleRow.onclick = () => toggleEncounterCollapse(name);
    titleRow.innerHTML = `<h3 class="text-lg font-semibold text-white">${name}</h3><div class="flex items-center gap-2"><button class="btn-secondary text-xs ${isCollapsed ? 'hidden' : ''}" onclick="event.stopPropagation(); clearEncounterData('${name}');">Clear Data</button><div class="w-5 h-5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div></div>`;
    block.appendChild(titleRow);

    const grid = document.createElement('div');
    grid.className = `mt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 ${isCollapsed ? 'hidden' : ''}`;
    ['group1', 'group2'].forEach(key => {
        const groupBlock = document.createElement('div');
        groupBlock.innerHTML = `<h4 class="font-bold mb-2 text-gray-300">${key === 'group1' ? 'Group 1' : 'Group 2'}</h4>`;
        const container = document.createElement('div');
        container.className = 'space-y-2';
        state.assignments[name][key].forEach((slot, i) => {
            const availableRoster = roster.filter(p => !assigned.has(p) || p === slot.player);
            container.appendChild(createAssignmentSlot(name, key, i, slot, availableRoster, data.roles));
        });
        groupBlock.appendChild(container);
        grid.appendChild(groupBlock);
    });
    block.appendChild(grid);
    return block;
}

function createAssignmentSlot(context, group, index, slotData, roster, specificRoles) {
    const borderColor = subroleColors[slotData.specificRole] || 'border-gray-700';
    const container = document.createElement('div');
    container.className = `p-1 rounded-md border-2 space-y-1 ${borderColor}`;

    const topRow = document.createElement('div'); topRow.className = 'flex items-center gap-1';
    topRow.innerHTML = `<div class="w-[20px] h-[20px] flex-shrink-0 flex items-center justify-center">${boonIcons[slotData.primaryRole] ? `<img src="${boonIcons[slotData.primaryRole]}" class="boon-icon" title="${primaryRoles[slotData.primaryRole]}">` : ''}</div>`;

    const playerSelect = document.createElement('select');
    playerSelect.className = 'p-1 text-xs w-full';
    playerSelect.innerHTML = `<option value="">Player...</option>${roster.map(name => `<option value="${name}" ${slotData.player === name ? 'selected' : ''}>${name}</option>`).join('')}`;
    playerSelect.onchange = (e) => updateAssignment(context, group, index, 'player', e.target.value);
    topRow.appendChild(playerSelect);

    const middleRow = document.createElement('div'); middleRow.className = 'flex items-center gap-1';

    const roleSelect = document.createElement('select');
    roleSelect.className = 'p-1 text-xs w-full flex-1';
    roleSelect.innerHTML = `<option value="">Role...</option>${Object.entries(primaryRoles).map(([key, name]) => `<option value="${key}" ${slotData.primaryRole === key ? 'selected' : ''}>${name}</option>`).join('')}`;
    roleSelect.onchange = (e) => updateAssignment(context, group, index, 'primaryRole', e.target.value);
    middleRow.appendChild(roleSelect);

    if (slotData.primaryRole && slotData.primaryRole.includes('dps')) {
        const damageSelect = document.createElement('select');
        damageSelect.className = 'p-1 text-xs w-full flex-1';
        damageSelect.innerHTML = `<option value="">Damage...</option>${allDamageTypeKeys.map(t => `<option value="${t}" ${slotData.damageType === t ? 'selected' : ''}>${t}</option>`).join('')}`;
        damageSelect.onchange = (e) => updateAssignment(context, group, index, 'damageType', e.target.value);
        middleRow.appendChild(damageSelect);
    }

    if (specificRoles && specificRoles.length > 0) {
        const subroleSelect = document.createElement('select');
        subroleSelect.className = 'p-1 text-xs w-full flex-1';
        subroleSelect.innerHTML = `<option value="">Sub-role...</option>${specificRoles.map(r => `<option value="${r}" ${slotData.specificRole === r ? 'selected' : ''}>${r}</option>`).join('')}`;
        subroleSelect.onchange = (e) => updateAssignment(context, group, index, 'specificRole', e.target.value);
        middleRow.appendChild(subroleSelect);
    }
    container.append(topRow, middleRow);
    return container;
}

// --- EVENT HANDLERS & ACTIONS ---
function handleMainRosterChange(event) {
    state.roster.main[parseInt(event.target.dataset.index, 10)] = event.target.value;
    renderStandardComp();
    renderAllEncounters();
}
window.handleReserveRosterChange = function(event) {
    state.roster.reserves[parseInt(event.target.dataset.index, 10)] = event.target.value;
    renderStandardComp();
    renderAllEncounters();
};
function addReserve() { const name = newReserveNameInput.value.trim(); if (name) { state.roster.reserves.push(name); newReserveNameInput.value = ''; renderAll(); } }
addReserveBtn.addEventListener('click', addReserve);
newReserveNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addReserve(); });
window.removeReserve = function(index) { state.roster.reserves.splice(index, 1); renderAll(); };

function toggleWing(wingName) {
    const wings = state.ui.selectedWings;
    const index = wings.indexOf(wingName);
    if (index > -1) wings.splice(index, 1); else wings.push(wingName);
    renderWingSelector();
    renderAllEncounters();
}
window.toggleWingCollapse = function(wingName) {
    const wings = state.ui.collapsedWings;
    const index = wings.indexOf(wingName);
    if (index > -1) wings.splice(index, 1); else wings.push(wingName);
    renderAllEncounters();
};
window.toggleEncounterCollapse = function(encounterName) {
    const encounters = state.ui.collapsedEncounters;
    const index = encounters.indexOf(encounterName);
    if (index > -1) encounters.splice(index, 1); else encounters.push(encounterName);
    renderAllEncounters();
};

window.clearEncounterData = function(encounterName) {
    state.assignments[encounterName] = JSON.parse(JSON.stringify(state.standardComp));
    renderAllEncounters();
};
window.clearWingData = function(wingName) {
    Object.keys(encounters[wingName]).forEach(n => { state.assignments[n] = JSON.parse(JSON.stringify(state.standardComp)); });
    renderAllEncounters();
};

function updateAssignment(context, group, index, field, value) {
    if (context === 'standardComp') {
        const oldStandardComp = JSON.parse(JSON.stringify(state.standardComp));
        const target = state.standardComp;

        const newSlot = { ...target[group][index], [field]: value };
        if (field === 'primaryRole' && !newSlot.primaryRole.includes('dps')) {
            newSlot.damageType = '';
        }
        target[group][index] = newSlot;

        Object.keys(state.assignments).forEach(encounterName => {
            if (JSON.stringify(state.assignments[encounterName]) === JSON.stringify(oldStandardComp)) {
                state.assignments[encounterName] = JSON.parse(JSON.stringify(state.standardComp));
            }
        });
        renderAll();
    } else {
        const target = state.assignments[context];
        const newSlot = { ...target[group][index], [field]: value };
        if (field === 'primaryRole' && !newSlot.primaryRole.includes('dps')) {
            newSlot.damageType = '';
        }
        target[group][index] = newSlot;
        renderAllEncounters();
    }
}

// --- UTILITY & FILE HANDLING ---
function setupWingDragAndDrop() {
    let draggedItem = null;
    wingSelector.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('dragstart', () => { draggedItem = btn; setTimeout(() => btn.classList.add('opacity-50'), 0); });
        btn.addEventListener('dragend', () => { if (draggedItem) draggedItem.classList.remove('opacity-50'); draggedItem = null; });
        btn.addEventListener('dragover', e => {
            e.preventDefault();
            const target = e.target.closest('button');
            if (target && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const next = (e.clientX - rect.left) / rect.width > 0.5;
                wingSelector.insertBefore(draggedItem, next ? target.nextSibling : target);
            }
        });
    });
    wingSelector.addEventListener('drop', (e) => {
        e.preventDefault();
        state.ui.wingOrder = Array.from(wingSelector.querySelectorAll('button')).map(btn => btn.dataset.wingName);
        renderAllEncounters();
    });
}

function exportStateToFile() {
    try {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gw2-roster.json';
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Roster exported successfully!');
    } catch (error) {
        console.error('Failed to export state:', error);
        showNotification('Error exporting roster.', true);
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loaded = JSON.parse(e.target.result);
            if (loaded.roster && loaded.assignments && loaded.ui) {
                state = loaded;
                if (!state.standardComp) {
                    state.standardComp = { group1: Array(5).fill({...emptyStandardSlot}), group2: Array(5).fill({...emptyStandardSlot}) };
                }
                renderAll();
                showNotification('Roster imported successfully!');
            } else { throw new Error('Invalid file format.'); }
        } catch (error) {
            console.error('Failed to import state:', error);
            showNotification('Error importing roster: Invalid file.', true);
        }
    };
    reader.onerror = () => showNotification('Error reading file.', true);
    reader.readAsText(file);
    event.target.value = '';
}

// --- URL COMPRESSION & EXPANSION ---
function compressStateV5(s) {
    const playerMap = [...new Set([...s.roster.main, ...s.roster.reserves])].filter(p => p && p.trim());
    const getIdx = (map, val) => val ? map.indexOf(val) : -1;

    const compressed = { v: 5 };

    // Player & Roster Data
    if (playerMap.length > 0) {
        compressed.p = playerMap;
        let mainRosterTrimmed = [...s.roster.main];
        while (mainRosterTrimmed.length > 0 && !mainRosterTrimmed[mainRosterTrimmed.length - 1]) mainRosterTrimmed.pop();
        
        const rosterData = {
            m: mainRosterTrimmed.map(p => getIdx(playerMap, p)),
            rs: s.roster.reserves.map(p => getIdx(playerMap, p))
        };
        if (rosterData.m.length > 0 || rosterData.rs.length > 0) {
            compressed.r = rosterData;
        }
    }

    // Standard Composition Data
    const isStandardCompDefault = s.standardComp.group1.every(slot => !slot.player && !slot.primaryRole && !slot.damageType) &&
                                 s.standardComp.group2.every(slot => !slot.player && !slot.primaryRole && !slot.damageType);

    if (!isStandardCompDefault) {
        const compToArray = (slot) => {
            const arr = [getIdx(playerMap, slot.player), getIdx(allPrimaryRoleKeys, slot.primaryRole), getIdx(allDamageTypeKeys, slot.damageType)];
            while (arr.length > 0 && (arr[arr.length - 1] === -1 || arr[arr.length - 1] === undefined)) arr.pop();
            return arr.length > 0 ? arr : 0;
        };
        compressed.sc = {
            g1: s.standardComp.group1.map(compToArray),
            g2: s.standardComp.group2.map(compToArray)
        };
    }

    // Assignments Data
    const assignments = {};
    const standardCompString = JSON.stringify(s.standardComp);
    let hasCustomAssignments = false;
    for (const encName in s.assignments) {
        if (JSON.stringify(s.assignments[encName]) !== standardCompString) {
            hasCustomAssignments = true;
            const encIdx = getIdx(allEncounterNames, encName);
            if (encIdx > -1) {
                const comp = s.assignments[encName];
                const toArr = slot => {
                    const arr = [getIdx(playerMap, slot.player), getIdx(allPrimaryRoleKeys, slot.primaryRole), getIdx(allSpecificRoleKeys, slot.specificRole), getIdx(allDamageTypeKeys, slot.damageType)];
                    while (arr.length > 0 && (arr[arr.length - 1] === -1 || arr[arr.length - 1] === undefined)) arr.pop();
                    return arr.length > 0 ? arr : 0;
                };
                assignments[encIdx] = [comp.group1.map(toArr), comp.group2.map(toArr)];
            }
        }
    }
    if (hasCustomAssignments) {
        compressed.a = assignments;
    }

    // UI Data
    const uiData = {};
    if (s.ui.selectedWings.length > 0) {
        uiData.sw = s.ui.selectedWings.map(w => getIdx(allWingNames, w));
    }
    if (s.ui.collapsedEncounters.length > 0) {
        uiData.ce = s.ui.collapsedEncounters.map(e => getIdx(allEncounterNames, e));
    }
    if (s.ui.collapsedWings.length > 0) {
        uiData.cw = s.ui.collapsedWings.map(w => getIdx(allWingNames, w));
    }
    const defaultWingOrder = JSON.stringify(s.ui.wingOrder.map(w => getIdx(allWingNames, w))) === JSON.stringify(allWingNames.map((_, i) => i));
    if (!defaultWingOrder) {
        uiData.wo = s.ui.wingOrder.map(w => getIdx(allWingNames, w));
    }

    if (Object.keys(uiData).length > 0) {
        compressed.u = uiData;
    }

    return compressed;
}

function expandStateV5(c) {
    const p = c.p || [];
    const get = (map, idx) => (idx > -1 && map[idx]) ? map[idx] : '';
    
    const s = { 
        roster: { main: Array(10).fill(''), reserves: [] }, 
        assignments: {}, 
        ui: { selectedWings: [], collapsedEncounters: [], collapsedWings: [], wingOrder: allWingNames }, 
        standardComp: {
            group1: Array(5).fill(null).map(() => ({...emptyStandardSlot})),
            group2: Array(5).fill(null).map(() => ({...emptyStandardSlot}))
        } 
    };

    // Roster
    if (c.r) {
        s.roster.main = (c.r.m || []).map(idx => get(p, idx));
        while (s.roster.main.length < 10) s.roster.main.push('');
        s.roster.reserves = (c.r.rs || []).map(idx => get(p, idx));
    }

    // UI
    if (c.u) {
        s.ui.selectedWings = (c.u.sw || []).map(idx => get(allWingNames, idx));
        s.ui.collapsedEncounters = (c.u.ce || []).map(idx => get(allEncounterNames, idx));
        s.ui.collapsedWings = (c.u.cw || []).map(idx => get(allWingNames, idx));
        s.ui.wingOrder = (c.u.wo && c.u.wo.length > 0) ? c.u.wo.map(idx => get(allWingNames, idx)) : allWingNames;
    }

    // Standard Comp
    if (c.sc) {
        const arrToStandardSlot = (arr) => arr === 0 ? {...emptyStandardSlot} : { player: get(p, arr[0]), primaryRole: get(allPrimaryRoleKeys, arr[1]), damageType: get(allDamageTypeKeys, arr[2]) || '' };
        s.standardComp = { 
            group1: c.sc.g1.map(arrToStandardSlot), 
            group2: c.sc.g2.map(arrToStandardSlot) 
        };
    }
    
    // Assignments
    allEncounterNames.forEach(encName => {
        const encIdx = allEncounterNames.indexOf(encName);
        if (c.a && c.a[encIdx]) {
            const [g1, g2] = c.a[encIdx];
            const arrToEncounterSlot = (arr) => arr === 0 ? {...emptySlot} : { player: get(p, arr[0]), primaryRole: get(allPrimaryRoleKeys, arr[1]), specificRole: get(allSpecificRoleKeys, arr[2]) || '', damageType: get(allDamageTypeKeys, arr[3]) || '' };
            s.assignments[encName] = { group1: g1.map(arrToEncounterSlot), group2: g2.map(arrToEncounterSlot) };
        } else {
            s.assignments[encName] = JSON.parse(JSON.stringify(s.standardComp));
        }
    });

    return s;
}

function compressStateV4(s) {
    const playerMap = [...new Set([...s.roster.main, ...s.roster.reserves])].filter(p => p && p.trim());
    const getIdx = (map, val) => val ? map.indexOf(val) : -1;
    let mainRosterTrimmed = [...s.roster.main];
    while (mainRosterTrimmed.length > 0 && !mainRosterTrimmed[mainRosterTrimmed.length - 1]) mainRosterTrimmed.pop();

    const compToArray = (slot) => {
        const arr = [getIdx(playerMap, slot.player), getIdx(allPrimaryRoleKeys, slot.primaryRole), getIdx(allDamageTypeKeys, slot.damageType)];
        while (arr.length > 0 && arr[arr.length - 1] === -1) arr.pop();
        return arr.length > 0 ? arr : 0;
    };
    const standardComp = { g1: s.standardComp.group1.map(compToArray), g2: s.standardComp.group2.map(compToArray) };

    const assignments = {};
    for (const encName in s.assignments) {
        if (JSON.stringify(s.assignments[encName]) !== JSON.stringify(s.standardComp)) {
            const encIdx = getIdx(allEncounterNames, encName);
            if (encIdx > -1) {
                const comp = s.assignments[encName];
                const toArr = slot => {
                    const arr = [getIdx(playerMap, slot.player), getIdx(allPrimaryRoleKeys, slot.primaryRole), getIdx(allSpecificRoleKeys, slot.specificRole), getIdx(allDamageTypeKeys, slot.damageType)];
                    while (arr.length > 0 && (arr[arr.length - 1] === -1 || arr[arr.length - 1] === undefined)) arr.pop();
                    return arr.length > 0 ? arr : 0;
                };
                assignments[encIdx] = [comp.group1.map(toArr), comp.group2.map(toArr)];
            }
        }
    }
    return { p: playerMap, r: { m: mainRosterTrimmed.map(p => getIdx(playerMap, p)), rs: s.roster.reserves.map(p => getIdx(playerMap, p)) }, sc: standardComp, a: assignments, u: { sw: s.ui.selectedWings.map(w => getIdx(allWingNames, w)), ce: s.ui.collapsedEncounters.map(e => getIdx(allEncounterNames, e)), cw: s.ui.collapsedWings.map(w => getIdx(allWingNames, w)), wo: s.ui.wingOrder.map(w => getIdx(allWingNames, w)) } };
}

function expandStateV4(c) {
    const p = c.p || [];
    const get = (map, idx) => (idx > -1 && map[idx]) ? map[idx] : '';
    const s = { roster: {}, assignments: {}, ui: {}, standardComp: {} };
    s.roster = { main: (c.r.m || []).map(idx => get(p, idx)), reserves: (c.r.rs || []).map(idx => get(p, idx)) };
    while (s.roster.main.length < 10) s.roster.main.push('');
    s.ui = { selectedWings: (c.u.sw || []).map(idx => get(allWingNames, idx)), collapsedEncounters: (c.u.ce || []).map(idx => get(allEncounterNames, idx)), collapsedWings: (c.u.cw || []).map(idx => get(allWingNames, idx)), wingOrder: (c.u.wo && c.u.wo.length > 0) ? c.u.wo.map(idx => get(allWingNames, idx)) : allWingNames };
    const arrToComp = (arr) => arr === 0 ? {...emptyStandardSlot} : { player: get(p, arr[0]), primaryRole: get(allPrimaryRoleKeys, arr[1]), damageType: get(allDamageTypeKeys, arr[2]) || '' };
    s.standardComp = (c.sc && c.sc.g1) ? { group1: c.sc.g1.map(arrToComp), group2: c.sc.g2.map(arrToComp) } : { group1: Array(5).fill({...emptyStandardSlot}), group2: Array(5).fill({...emptyStandardSlot}) };
    allEncounterNames.forEach(encName => {
        const encIdx = allEncounterNames.indexOf(encName);
        if (c.a && c.a[encIdx]) {
            const [g1, g2] = c.a[encIdx];
            const arrToSlot = (arr) => arr === 0 ? {...emptySlot} : { player: get(p, arr[0]), primaryRole: get(allPrimaryRoleKeys, arr[1]), specificRole: get(allSpecificRoleKeys, arr[2]) || '', damageType: get(allDamageTypeKeys, arr[3]) || '' };
            s.assignments[encName] = { group1: g1.map(arrToSlot), group2: g2.map(arrToSlot) };
        } else {
            s.assignments[encName] = JSON.parse(JSON.stringify(s.standardComp));
        }
    });
    return s;
}

function expandStateV3(c) {
    const p = c.p || [];
    const get = (m, i) => (i > -1 && m[i]) || '';
    const s = { roster: {}, assignments: {}, ui: {}, standardComp: {} };
    s.roster = { main: (c.r.m || []).map(i => get(p, i)), reserves: (c.r.rs || []).map(i => get(p, i)) };
    while (s.roster.main.length < 10) s.roster.main.push('');
    s.ui = {
        selectedWings: (c.u.sw || []).map(i => get(allWingNames, i)),
        collapsedEncounters: (c.u.ce || []).map(i => get(allEncounterNames, i)),
        collapsedWings: (c.u.cw || []).map(i => get(allWingNames, i)),
        wingOrder: (c.u.wo && c.u.wo.length > 0) ? c.u.wo.map(i => get(allWingNames, i)) : allWingNames
    };
    const arrToStandardSlot = (sl) => ({ player: get(p, sl[0]), primaryRole: get(allPrimaryRoleKeys, sl[1]), damageType: get(allDamageTypeKeys, sl[2]) || '' });
    s.standardComp = (c.sc && c.sc.g1) ? {
        group1: c.sc.g1.map(arrToStandardSlot),
        group2: c.sc.g2.map(arrToStandardSlot)
    } : { group1: Array(5).fill({ ...emptyStandardSlot }), group2: Array(5).fill({ ...emptyStandardSlot }) };
    
    allEncounterNames.forEach(n => {
        const i = allEncounterNames.indexOf(n);
        if (c.a && c.a[i]) {
            const [g1, g2] = c.a[i];
            const arrToEncounterSlot = (sl) => sl === 0 ? { ...emptySlot } : { player: get(p, sl[0]), primaryRole: get(allPrimaryRoleKeys, sl[1]), specificRole: get(allSpecificRoleKeys, sl[2]) || '', damageType: get(allDamageTypeKeys, sl[3]) || '' };
            s.assignments[n] = {
                group1: g1.map(arrToEncounterSlot),
                group2: g2.map(arrToEncounterSlot)
            };
        } else {
            s.assignments[n] = JSON.parse(JSON.stringify(s.standardComp));
        }
    });
    return s;
}

function copyShareableLink() {
    try {
        const compressed = pako.deflate(JSON.stringify(compressStateV5(state)));
        let binaryString = '';
        for (let i = 0; i < compressed.length; i += 8192) {
            binaryString += String.fromCharCode.apply(null, compressed.subarray(i, i + 8192));
        }
        const url = `${window.location.origin}${window.location.pathname}#v5-${btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
        navigator.clipboard.writeText(url).then(() => showNotification('Shareable link copied to clipboard!'));
    } catch (error) {
        console.error("Failed to copy link:", error);
        showNotification('Error copying link.', true);
    }
}

function loadStateFromUrl() {
    if (!window.location.hash || window.location.hash.length < 2) return false;
    try {
        const hash = window.location.hash.substring(1);
        let loaded;
        const decode = b64 => {
            let s = b64.replace(/-/g, '+').replace(/_/g, '/');
            while (s.length % 4) s += '=';
            const bytes = atob(s).split('').map(c => c.charCodeAt(0));
            return pako.inflate(new Uint8Array(bytes), { to: 'string' });
        };

        if (hash.startsWith('v5-')) {
            loaded = expandStateV5(JSON.parse(decode(hash.substring(3))));
        } else if (hash.startsWith('v4-')) {
            loaded = expandStateV4(JSON.parse(decode(hash.substring(3))));
        } else if (hash.startsWith('v3-')) {
            loaded = expandStateV3(JSON.parse(decode(hash.substring(3))));
        } else {
            // Handle older versions (v2, etc.) using the v4 expander as a fallback
            showNotification('Loading a legacy link format. Please re-share a new link.', true);
            let contentToDecode = hash;
            const versionMatch = hash.match(/^v(\d+)-/);
            if (versionMatch) {
                contentToDecode = hash.substring(versionMatch[0].length);
            }
            const decodedJson = JSON.parse(decode(contentToDecode));
            
            // Assume older compressed formats are compatible with the v4 expander logic.
            loaded = expandStateV4(decodedJson);
        }

        if (loaded && loaded.roster && loaded.assignments) {
            if (!loaded.standardComp) {
                loaded.standardComp = { group1: Array(5).fill({...emptyStandardSlot}), group2: Array(5).fill({...emptyStandardSlot}) };
            }
            Object.assign(state, loaded);
            if (!state.ui.wingOrder || state.ui.wingOrder.length === 0) state.ui.wingOrder = Object.keys(encounters);
            showNotification('Roster loaded from link!');
            return true;
        } else {
             throw new Error("Failed to produce a valid state object from URL hash.");
        }
    } catch (error) {
        console.error("Failed to load state from URL:", error);
        showNotification('Could not parse roster from link.', true);
    }
    return false;
}

function showNotification(message, isError = false) {
    notificationModal.textContent = message;
    notificationModal.className = `fixed top-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transition-all duration-300 ${isError ? 'bg-red-500' : 'bg-blue-500'} opacity-100 translate-y-0`;
    setTimeout(() => {
        notificationModal.classList.replace('opacity-100', 'opacity-0');
        notificationModal.classList.replace('translate-y-0', '-translate-y-10');
    }, 3000);
}

// --- RUN ---
initialize();

