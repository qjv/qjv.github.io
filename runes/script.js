document.addEventListener('DOMContentLoaded', async () => {
    // --- Global variables and constants ---
    const filterBar = document.getElementById('filter-bar');
    const sortMenuContainer = document.getElementById('sort-menu-container');
    const sortDirBtn = document.getElementById('sort-direction-btn');
    const resultsList = document.getElementById('results-list');
    const resultsSummary = document.getElementById('results-summary');
    const clearBtn = document.getElementById('clear-btn');
    const expandToggleBtn = document.getElementById('expand-toggle-btn');
    const copyNotification = document.getElementById('copy-notification');

    let isExpanded = false;
    let sortDirection = 'DESC';
    let sortBy = 'Name';

    const arrowDownSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>`;
    const arrowUpSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>`;
    const movementSpeedIcon = `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
    const statIcons = {'Power': 'other_images/Power.png', 'Precision': 'other_images/Precision.png', 'Toughness': 'other_images/Toughness.png', 'Vitality': 'other_images/Vitality.png', 'Boon Duration': 'other_images/Boon_Duration.png', 'Condition Damage': 'other_images/Condition_Damage.png', 'Condition Duration': 'other_images/Condition_Duration.png', 'Ferocity': 'other_images/Ferocity.png', 'Healing': 'other_images/Healing_Power.png', 'Fury': 'other_images/Fury.png', 'Might': 'other_images/Might.png', 'Protection': 'other_images/Protection.png', 'Quickness': 'other_images/Quickness.png', 'Regeneration': 'other_images/Regeneration.png', 'Swiftness': 'other_images/Swiftness.png', 'Bleeding': 'other_images/Bleeding.png', 'Burning': 'other_images/Burning.png', 'Chill': 'other_images/Chill.png', 'Confusion': 'other_images/Confusion.png', 'Fear': 'other_images/Fear.png', 'Poison': 'other_images/Poison.png', 'Torment': 'other_images/Torment.png', 'Weakness': 'other_images/Weakness.png', 'Daze': 'other_images/Daze.png'};
    
    // --- Data fetching and initialization ---
    try {
        const response = await fetch('database.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const runeDatabase = await response.json();
        initializeApp(runeDatabase);
    } catch (error) {
        console.error("Could not load the rune database:", error);
        resultsSummary.textContent = 'Error: Could not load rune data. Please try refreshing the page.';
    }

    // --- Main Application Logic ---
    function initializeApp(runeDatabase) {
        let allFilters = {};
        
        const parsedData = runeDatabase.map(rune => {
            const parsedStats = {};
            let totalAllStats = 0;
            rune.bonuses.forEach(bonus => {
                const parts = bonus.match(/^([+-]?\d+%?)\s*(.*)$/);
                if (!parts) return;
                const valueString = parts[1];
                const value = parseFloat(valueString);
                let statName = parts[2].trim();
                if (statName === 'All Stats') {
                    totalAllStats += value;
                    ['Power', 'Precision', 'Toughness', 'Vitality', 'Ferocity', 'Healing', 'Condition Damage'].forEach(s => {
                        parsedStats[s] = (parsedStats[s] || 0) + value;
                    });
                } else {
                    parsedStats[statName] = (parsedStats[statName] || 0) + value;
                }
            });
            if (totalAllStats > 0) {
                const durationBonus = totalAllStats / 15;
                parsedStats['Boon Duration'] = (parsedStats['Boon Duration'] || 0) + durationBonus;
                parsedStats['Condition Duration'] = (parsedStats['Condition Duration'] || 0) + durationBonus;
            }
            Object.keys(parsedStats).forEach(statName => { allFilters[statName] = true; });
            return { name: rune.shortName, fullName: rune.fullName, stats: parsedStats, icon: rune.icon };
        });

        const filterStructure = { "Primary Stats": ['Power', 'Precision', 'Ferocity', 'Condition Damage', 'Healing', 'Vitality', 'Toughness'], "Boon Duration": ['Boon Duration', 'Fury Duration', 'Might Duration', 'Protection Duration', 'Quickness Duration', 'Regeneration Duration', 'Swiftness Duration'], "Condition Duration": ['Condition Duration', 'Bleeding Duration', 'Burning Duration', 'Torment Duration', 'Poison Duration', 'Confusion Duration', 'Fear Duration', 'Chill Duration', 'Weakness Duration'], "Incoming Effects": Object.keys(allFilters).filter(f => f.includes('Incoming')).sort(), "Other Effects": Object.keys(allFilters).filter(f => !f.includes('Incoming') && !['Power', 'Precision', 'Ferocity', 'Condition Damage', 'Healing', 'Vitality', 'Toughness', 'Boon Duration', 'Condition Duration'].includes(f) && !f.includes('Duration') || f === 'Daze Duration').sort() };
        const sortOptions = { 'Name': null, 'Power': null, 'Precision': null, 'Ferocity': null, 'Condition Damage': null, 'Healing': null, 'Vitality': null, 'Toughness': null, 'Boon Duration': filterStructure['Boon Duration'], 'Condition Duration': filterStructure['Condition Duration'] };

        function getIconForStat(statName) {
            if (statName === 'Movement Speed') return movementSpeedIcon;
            if (statName.includes('Incoming')) return `<svg class="stat-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2"><path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15L12 9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12L12 15L9 12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            if (statIcons[statName]) return `<img src="${statIcons[statName]}" class="stat-icon" alt="${statName} icon" onerror="this.style.display='none'">`;
            const keyword = statName.replace(' Duration','').trim();
            if (statIcons[keyword]) return `<img src="${statIcons[keyword]}" class="stat-icon" alt="${keyword} icon" onerror="this.style.display='none'">`;
            return '';
        }

        function createFilterMenu(name, filterArray) {
            const availableFilters = filterArray.filter(f => allFilters[f]);
            if (availableFilters.length === 0) return;
            const container = document.createElement('div');
            container.className = 'menu-container';
            const button = document.createElement('button');
            button.className = 'menu-button';
            button.textContent = name;
            const dropdown = document.createElement('div');
            dropdown.className = 'menu-dropdown';
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'menu-dropdown-content';
            availableFilters.forEach(stat => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `filter-${stat.replace(/[^a-zA-Z0-9]/g, '-')}`;
                checkbox.value = stat;
                checkbox.className = 'filter-checkbox';
                checkbox.addEventListener('change', () => performSearch(parsedData));
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.innerHTML = `${getIconForStat(stat)}<span>${stat}</span>`;
                dropdownContent.appendChild(checkbox);
                dropdownContent.appendChild(label);
            });
            dropdown.appendChild(dropdownContent);
            container.appendChild(button);
            container.appendChild(dropdown);
            filterBar.appendChild(container);
        }
        
        function setSortBy(newSortBy, data) {
            sortBy = newSortBy;
            const sortButton = document.getElementById('sort-menu-button');
            sortButton.innerHTML = `${getIconForStat(sortBy)} Sort: ${sortBy}`;
            performSearch(data);
        }

        function createSortMenu(sortOptions, data) {
            const button = document.createElement('button');
            button.className = 'menu-button';
            button.id = 'sort-menu-button';
            button.innerHTML = `${getIconForStat(sortBy)} Sort: ${sortBy}`;
            const dropdown = document.createElement('div');
            dropdown.className = 'menu-dropdown';
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'menu-dropdown-content';

            for (const [key, value] of Object.entries(sortOptions)) {
                if (Array.isArray(value)) {
                    const availableSubItems = value.filter(item => allFilters[item]);
                    if (availableSubItems.length > 0) {
                        const menuItem = document.createElement('div');
                        menuItem.className = 'menu-item menu-item--has-submenu';
                        menuItem.innerHTML = `<span>${key}</span><span style="margin-left:auto;">&rsaquo;</span>`;
                        const submenu = document.createElement('div');
                        submenu.className = 'menu-dropdown submenu';
                        const submenuContent = document.createElement('div');
                        submenuContent.className = 'menu-dropdown-content';
                        availableSubItems.forEach(subItem => {
                            const subMenuItem = document.createElement('div');
                            subMenuItem.className = 'menu-item';
                            subMenuItem.innerHTML = `${getIconForStat(subItem)}<span>${subItem}</span>`;
                            subMenuItem.onclick = () => setSortBy(subItem, data);
                            submenuContent.appendChild(subMenuItem);
                        });
                        submenu.appendChild(submenuContent);
                        menuItem.appendChild(submenu);
                        dropdownContent.appendChild(menuItem);
                    }
                } else {
                    const menuItem = document.createElement('div');
                    menuItem.className = 'menu-item';
                    menuItem.innerHTML = `${getIconForStat(key)}<span>${key}</span>`;
                    menuItem.onclick = () => setSortBy(key, data);
                    dropdownContent.appendChild(menuItem);
                }
            }
            dropdown.appendChild(dropdownContent);
            sortMenuContainer.appendChild(button);
            sortMenuContainer.appendChild(dropdown);
        }

        function performSearch(data) {
            const selectedFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
            let filteredRunes = data;
            if (selectedFilters.length > 0) {
                filteredRunes = data.filter(rune => {
                    const runeStatKeys = Object.keys(rune.stats);
                    return selectedFilters.every(filter => runeStatKeys.includes(filter));
                });
            }
            filteredRunes.sort((a, b) => {
                if (sortBy === 'Name') return sortDirection === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                const statA = a.stats[sortBy] || 0;
                const statB = b.stats[sortBy] || 0;
                return sortDirection === 'ASC' ? statA - statB : statB - statA;
            });
            displayResults(filteredRunes, selectedFilters);
        }

        function displayResults(runes, filters) {
            resultsList.innerHTML = '';
            if (filters.length === 0) resultsSummary.textContent = `Showing all ${runes.length} runes. Select filters to narrow your search.`;
            else resultsSummary.textContent = `Found ${runes.length} rune(s) matching your criteria.`;
            
            runes.forEach(rune => {
                const row = document.createElement('div');
                row.className = 'result-row';
                const nameCell = document.createElement('div');
                nameCell.className = 'rune-name-cell';
                nameCell.title = rune.fullName;
                const icon = rune.icon ? `<img src="${rune.icon}" class="rune-icon" alt="${rune.name} icon" onerror="this.style.display='none'">` : `<div class="rune-icon"></div>`;
                nameCell.innerHTML = `${icon}<span class="rune-name">${rune.name}</span>`;
                nameCell.addEventListener('click', () => copyToClipboard(rune.fullName));
                const statsCell = document.createElement('div');
                statsCell.className = 'stats-cell';
                const sortedStats = Object.entries(rune.stats).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
                sortedStats.forEach(([stat, value]) => {
                    const statTag = document.createElement('div');
                    statTag.className = 'stat-tag';
                    statTag.title = stat;
                    const isDuration = stat.includes('Duration') || stat.includes('Speed');
                    const valueString = (value > 0 && !stat.includes('Incoming')) ? `+${Number(value.toFixed(1))}` : Number(value.toFixed(1));
                    const formattedValue = valueString.toString().replace(/\.0$/, '');
                    statTag.innerHTML = `${getIconForStat(stat)}<span class="stat-name">${stat}: </span><span class="value">${formattedValue}${isDuration ? '%' : ''}</span>`;
                    statsCell.appendChild(statTag);
                });
                row.appendChild(nameCell);
                row.appendChild(statsCell);
                resultsList.appendChild(row);
            });
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                copyNotification.style.opacity = '1';
                setTimeout(() => { copyNotification.style.opacity = '0'; }, 2000);
            });
        }

        function clearSearch(data) {
            document.querySelectorAll('.filter-checkbox:checked').forEach(cb => cb.checked = false);
            setSortBy('Name', data);
            sortDirection = 'DESC';
            sortDirBtn.innerHTML = arrowDownSVG;
            performSearch(data);
        }
        
        // --- Setup and Event Listeners ---
        for (const [menuName, filterList] of Object.entries(filterStructure)) createFilterMenu(menuName, filterList);
        createSortMenu(sortOptions, parsedData);
        
        clearBtn.addEventListener('click', () => clearSearch(parsedData));
        sortDirBtn.addEventListener('click', () => {
            sortDirection = sortDirection === 'DESC' ? 'ASC' : 'DESC';
            sortDirBtn.innerHTML = sortDirection === 'DESC' ? arrowDownSVG : arrowUpSVG;
            performSearch(parsedData);
        });
        expandToggleBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            resultsList.classList.toggle('collapsed', !isExpanded);
            expandToggleBtn.textContent = isExpanded ? 'Collapse' : 'Expand';
        });
        
        // Initial state
        sortDirBtn.innerHTML = arrowDownSVG;
        performSearch(parsedData);
    }
});
