document.addEventListener('DOMContentLoaded', async () => {

    const biomeMap = { "Caverns": "Underground" };
    
    // --- UI ELEMENT REFERENCES ---
    const npcChecklistContainer = document.getElementById('npc-checklist');
    const biomeChecklistContainer = document.getElementById('biome-checklist');
    const resultsContainer = document.getElementById('results');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');

    // --- FETCH DATA AND INITIALIZE APP ---
    try {
        const response = await fetch('database.json');
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        const data = await response.json();
        initializeApp(data.npcs, data.biomes);
    } catch (error) {
        console.error('Failed to load data:', error);
        resultsContainer.innerHTML = `<div class="text-center sm:col-span-2 xl:col-span-3 p-8 text-red-400"><p>Error: Could not load NPC data. Please check the console and refresh.</p></div>`;
    }

    function initializeApp(npcData, allBiomesData) {
        // --- UI INITIALIZATION ---
        createBiomeChecklist(allBiomesData);
        createNpcChecklist(npcData);

        // --- EVENT LISTENERS ---
        selectAllBtn.addEventListener('click', () => { setAllCheckboxes(true); generateLayout(npcData, allBiomesData); });
        deselectAllBtn.addEventListener('click', () => { setAllCheckboxes(false); generateLayout(npcData, allBiomesData); });

        // Initial layout generation
        generateLayout(npcData, allBiomesData);
    }

    function createBiomeChecklist(allBiomesData) {
        allBiomesData.forEach(biome => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `biome-${biome.name}`;
            input.value = biome.name;
            input.className = 'hidden biome-checkbox';
            input.checked = false;
            input.addEventListener('change', () => document.dispatchEvent(new Event('dataChanged')));

            const label = document.createElement('label');
            label.htmlFor = `biome-${biome.name}`;
            label.className = 'cursor-pointer w-12 h-12 block bg-stone-800 bg-opacity-70 border-2 border-stone-600 rounded-md p-0.5';
            
            const img = document.createElement('img');
            img.src = biome.image;
            img.title = biome.name;
            img.alt = biome.name;
            img.className = 'w-full h-full object-contain rounded-sm';

            label.appendChild(img);
            biomeChecklistContainer.appendChild(input);
            biomeChecklistContainer.appendChild(label);
        });
    }

    function createNpcChecklist(npcData) {
        const npcsByMod = npcData.reduce((acc, npc) => {
            if (!acc[npc.mod]) { acc[npc.mod] = []; }
            acc[npc.mod].push(npc);
            return acc;
        }, {});

        for (const mod in npcsByMod) {
            const modContainer = document.createElement('div');
            const modTitle = document.createElement('h3');
            modTitle.textContent = mod;
            modTitle.className = "text-sm text-amber-300 mb-2 font-bold cursor-pointer hover:text-yellow-300 transition-colors";
            modContainer.appendChild(modTitle);
            
            modTitle.addEventListener('click', () => {
                const checkboxes = modContainer.querySelectorAll('.npc-checkbox');
                if (checkboxes.length === 0) return;
                const newState = !checkboxes[0].checked;
                checkboxes.forEach(cb => cb.checked = newState);
                document.dispatchEvent(new Event('dataChanged'));
            });

            const npcGrid = document.createElement('div');
            npcGrid.className = "grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-5 gap-1";

            npcsByMod[mod].forEach(npc => {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = npc.name;
                input.value = npc.name;
                input.className = 'hidden npc-checkbox';
                input.checked = false;
                input.addEventListener('change', () => document.dispatchEvent(new Event('dataChanged')));

                const label = document.createElement('label');
                label.htmlFor = npc.name;
                label.className = 'cursor-pointer w-12 h-12 block bg-stone-800 bg-opacity-70 border-2 border-stone-600 rounded-md p-0.5';
                
                const img = document.createElement('img');
                img.src = npc.image;
                img.title = npc.name;
                img.alt = npc.name;
                img.className = 'w-full h-full object-cover object-[center_top] rounded-sm';
                img.loading = 'lazy';

                label.appendChild(img);
                npcGrid.appendChild(input);
                npcGrid.appendChild(label);
            });
            modContainer.appendChild(npcGrid);
            npcChecklistContainer.appendChild(modContainer);
        }
    }

    function setAllCheckboxes(checked) {
        document.querySelectorAll('.npc-checkbox, .biome-checkbox').forEach(cb => cb.checked = checked);
    }
    
    function generateLayout(npcData, allBiomesData) {
        const selectedNpcNames = Array.from(document.querySelectorAll('.npc-checkbox:checked')).map(cb => cb.value);
        const selectedBiomes = Array.from(document.querySelectorAll('.biome-checkbox:checked')).map(cb => cb.value);
        let availableNpcs = npcData.filter(npc => selectedNpcNames.includes(npc.name));
        
        resultsContainer.innerHTML = '';

        if (availableNpcs.length === 0 || selectedBiomes.length === 0) {
            resultsContainer.innerHTML = `<div class="text-center sm:col-span-2 xl:col-span-3 p-8 text-gray-400"><p>Select your NPCs and Biomes to auto-generate the optimal layout!</p></div>`;
            return;
        }

        let layout = {};
        selectedBiomes.forEach(b => layout[b] = []);

        const getNpc = (name) => availableNpcs.find(n => n.name === name);

        // Priority 1: Handle Truffle
        if (getNpc("Truffle") && selectedBiomes.includes("Mushroom")) {
            layout["Mushroom"].push(getNpc("Truffle"));
            availableNpcs = availableNpcs.filter(n => n.name !== "Truffle");
            if (getNpc("Guide")) {
                layout["Mushroom"].push(getNpc("Guide"));
                availableNpcs = availableNpcs.filter(n => n.name !== "Guide");
            }
        }

        // Priority 2: Find the BEST pairs
        let biomesToFill = selectedBiomes.filter(b => layout[b].length < 2);
        while (biomesToFill.length > 0 && availableNpcs.length >= 2) {
            let bestPair = null, bestBiomeForPair = null, highestScore = -1000;

            for (const biome of biomesToFill) {
                for (let i = 0; i < availableNpcs.length; i++) {
                    for (let j = i + 1; j < availableNpcs.length; j++) {
                        const npc1 = availableNpcs[i], npc2 = availableNpcs[j];
                        let currentScore = 0;
                        
                        const lovesBiome = (npc) => npc.loves.map(b => biomeMap[b] || b).includes(biome) || (biome === 'Savanna' && npc.loves.includes('Desert'));
                        if (lovesBiome(npc1)) currentScore += 10;
                        if (lovesBiome(npc2)) currentScore += 10;
                        if (npc1.likes.includes(npc2.name)) currentScore += 5;
                        if (npc2.likes.includes(npc1.name)) currentScore += 5;
                        if (npc1.hates.includes(npc2.name) || npc2.hates.includes(npc1.name)) currentScore -= 100;

                        if (currentScore > highestScore) {
                            highestScore = currentScore;
                            bestPair = [npc1, npc2];
                            bestBiomeForPair = biome;
                        }
                    }
                }
            }

            if (bestPair && bestBiomeForPair) {
                layout[bestBiomeForPair].push(...bestPair);
                availableNpcs = availableNpcs.filter(npc => npc.name !== bestPair[0].name && npc.name !== bestPair[1].name);
                biomesToFill = biomesToFill.filter(b => b !== bestBiomeForPair);
            } else {
                break;
            }
        }

        // Fallback: Fill biomes with singles
        biomesToFill = selectedBiomes.filter(b => layout[b].length < 2);
        biomesToFill.forEach(biome => {
            while (layout[biome].length < 2 && availableNpcs.length > 0) {
                layout[biome].push(availableNpcs.shift());
            }
        });

        // Priority 3: Distribute remaining NPCs
        availableNpcs.forEach(npc => {
            let bestBiome = null, bestScore = -1;
            selectedBiomes.forEach(biome => {
                if (layout[biome] && layout[biome].length < 4) {
                    let score = 0;
                    const lovesBiome = npc.loves.map(b => biomeMap[b] || b).includes(biome) || (biome === 'Savanna' && npc.loves.includes('Desert'));
                    if (lovesBiome) score += 10;
                    layout[biome].forEach(resident => {
                        if (npc.likes.includes(resident.name)) score += 5;
                        if (resident.likes.includes(npc.name)) score += 5;
                    });
                    if (score > bestScore) {
                        bestScore = score;
                        bestBiome = biome;
                    }
                }
            });
            if (bestBiome) {
                layout[bestBiome].push(npc);
            } else { // Fallback for remaining
                const smallestTown = selectedBiomes.filter(b => layout[b] && layout[b].length < 4).sort((a, b) => layout[a].length - layout[b].length)[0];
                if (smallestTown) layout[smallestTown].push(npc);
            }
        });

        // --- Render Results ---
        let hasResults = false;
        allBiomesData.forEach(biomeData => {
            const biomeName = biomeData.name;
            if (layout[biomeName] && layout[biomeName].length > 0) {
                hasResults = true;
                const biomeCard = document.createElement('div');
                biomeCard.className = 'bg-stone-800 bg-opacity-80 p-3 rounded-lg border-4';
                biomeCard.style.borderColor = biomeData.color;

                const biomeTitle = document.createElement('h3');
                biomeTitle.textContent = biomeName;
                biomeTitle.className = 'text-base font-bold text-yellow-300 mb-2 text-center';
                biomeCard.appendChild(biomeTitle);
                
                const npcContainer = document.createElement('div');
                npcContainer.className = 'flex flex-wrap gap-2 justify-center';
                
                layout[biomeName].forEach(npc => {
                    const img = document.createElement('img');
                    img.src = npc.image;
                    img.title = npc.name;
                    img.alt = npc.name;
                    img.className = 'w-12 h-12 rounded-md border-2 border-stone-500 object-cover object-[center_top]';
                    npcContainer.appendChild(img);
                });
                biomeCard.appendChild(npcContainer);
                resultsContainer.appendChild(biomeCard);
            }
        });

        if (!hasResults && selectedNpcNames.length > 0) {
            resultsContainer.innerHTML = `<div class="text-center sm:col-span-2 xl:col-span-3 p-8 text-gray-400"><p>Could not generate a valid layout. Try selecting more Biomes.</p></div>`;
        }
    }
    
    // Custom event to trigger layout generation
    document.addEventListener('dataChanged', () => {
        // We need to re-fetch the data from the DOM to pass to generateLayout
        // This is a bit inefficient but necessary since the main data lives outside the event scope
        // A better long-term solution would be state management.
        fetch('database.json')
            .then(res => res.json())
            .then(data => generateLayout(data.npcs, data.biomes));
    });
});
