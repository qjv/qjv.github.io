/**
 * GW2 Armory Embeds
 * A modern library for embedding Guild Wars 2 armory data
 *
 * @version 0.1.0
 * @author Snow Crows Community
 * @license MIT
 */

(function(window, document) {
    'use strict';

    // Default configuration
    const defaultConfig = {
        lang: 'en',
        cache: {
            enabled: true,
            duration: 7 * 24 * 60 * 60 * 1000, // 7 days
            prefix: 'gw2armory_'
        },
        api: {
            base: 'https://api.guildwars2.com/v2',
            timeout: 10000
        },
        tooltip: {
            delay: 100,
            maxWidth: 350,
            offset: 10
        },
        debug: true
    };

    // Backward compatibility: Support old GW2A_EMBED_OPTIONS format
    let userConfig = window.GW2Armory || {};

    if (document.GW2A_EMBED_OPTIONS) {
        const oldConfig = document.GW2A_EMBED_OPTIONS;

        // Map old config properties to new format
        const mappedConfig = {
            lang: oldConfig.lang,
            cache: {
                enabled: oldConfig.persistToLocalStorage !== false,
                duration: defaultConfig.cache.duration,
                prefix: defaultConfig.cache.prefix
            }
        };

        // Handle forceCacheClearOnNextRun
        if (oldConfig.forceCacheClearOnNextRun) {
            const cacheKey = 'gw2armory_cache_clear_key';
            const lastKey = localStorage.getItem(cacheKey);

            if (lastKey !== oldConfig.forceCacheClearOnNextRun) {
                // Clear cache
                const keys = Object.keys(localStorage);
                const removed = keys.filter(k => k.startsWith(defaultConfig.cache.prefix));
                removed.forEach(k => localStorage.removeItem(k));
                localStorage.setItem(cacheKey, oldConfig.forceCacheClearOnNextRun);
                console.log(`[GW2Armory] Cache cleared via forceCacheClearOnNextRun`);
            }
        }

        userConfig = Object.assign({}, mappedConfig, userConfig);
    }

    // Merge user config with defaults
    const config = Object.assign({}, defaultConfig, userConfig);

    // Debug logger
    function log(message, type = 'info') {
        if (!config.debug) return;
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`[GW2Armory] ${prefix} ${message}`);

        // Also log to page debug console if it exists
        if (typeof debugLog === 'function') {
            debugLog(message, type);
        }
    }

    // Statistics tracking
    const stats = {
        apiCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        embedsRendered: 0
    };

    // Module instances
    let dataFetcher = null;
    let tooltipSystem = null;
    let renderer = null;
    let buildParser = null;

    /**
     * Initialize the library
     */
    function init() {
        log('Initializing GW2 Armory Embeds v0.1.0');
        log(`Language: ${config.lang}, Cache: ${config.cache.enabled ? 'enabled' : 'disabled'}`);

        // Initialize modules
        if (window.DataFetcher) {
            dataFetcher = new window.DataFetcher(config);
            log('DataFetcher initialized');
        } else {
            log('DataFetcher not loaded!', 'error');
            return;
        }

        if (window.TooltipSystem) {
            tooltipSystem = new window.TooltipSystem(config);
            log('TooltipSystem initialized');
        } else {
            log('TooltipSystem not loaded!', 'error');
            return;
        }

        if (window.Renderer) {
            renderer = new window.Renderer(config, tooltipSystem);
            log('Renderer initialized');
        } else {
            log('Renderer not loaded!', 'error');
            return;
        }

        if (window.BuildParser) {
            buildParser = new window.BuildParser();
            log('BuildParser initialized');
        } else {
            log('BuildParser not loaded (optional module)');
        }

        // Scan DOM for embeds when ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', scanAndInitialize);
        } else {
            scanAndInitialize();
        }

        log('Library initialized', 'success');
        updatePageStats();
    }

    /**
     * Scan DOM and initialize all embeds
     */
    async function scanAndInitialize() {
        log('Scanning DOM for embeds...');

        const embedElements = document.querySelectorAll('[data-armory-embed]');
        log(`Found ${embedElements.length} embed elements`);

        if (embedElements.length === 0) {
            log('No embeds found to initialize');
            return;
        }

        // Initialize all embeds
        for (let i = 0; i < embedElements.length; i++) {
            try {
                await initializeEmbed(embedElements[i], i);
            } catch (error) {
                log(`Failed to initialize embed ${i}: ${error.message}`, 'error');
            }
        }

        log(`Processed ${embedElements.length} embeds`, 'success');
        updatePageStats();
    }

    /**
     * Initialize a build template embed
     */
    async function initializeBuildEmbed(element, index, chatLink) {
        if (!buildParser) {
            log(`Build parser not available`, 'error');
            const errorEl = renderer.renderError(element, 'Build parser module not loaded');
            element.appendChild(errorEl);
            element.classList.remove('gw2armory-loading');
            return;
        }

        try {
            log(`Parsing build template: ${chatLink}`);

            // Parse build template
            const buildData = buildParser.parse(chatLink);
            log(`Build parsed: ${buildData.profession} with ${buildData.specializations.length} specs`);

            // Fetch all required data
            const specIds = buildData.specializations.map(s => s.id);
            const paletteIds = [];

            // Collect terrestrial skill PALETTE IDs
            if (buildData.skills.terrestrial && buildData.skills.isPalette) {
                Object.values(buildData.skills.terrestrial).forEach(id => {
                    if (id && id > 0) paletteIds.push(id);
                });
            }

            log(`Build has ${specIds.length} specs, ${paletteIds.length} palette IDs`);

            // Fetch specs
            let specsData = {};
            try {
                specsData = specIds.length > 0 ? await dataFetcher.getSpecializations(specIds) : {};
            } catch (error) {
                log(`Failed to fetch specializations: ${error.message}`, 'error');
            }

            // Resolve palette IDs to skill IDs
            let paletteMapping = {};
            if (paletteIds.length > 0) {
                try {
                    // Use profession name - API expects capitalized names (Guardian, Warrior, etc.)
                    paletteMapping = await dataFetcher.resolvePaletteIds(paletteIds, buildData.profession);
                    log(`Resolved ${Object.keys(paletteMapping).length} palette IDs`);
                } catch (error) {
                    log(`Failed to resolve palette IDs: ${error.message}`, 'error');
                }
            }

            // Convert palette IDs to skill IDs in buildData
            if (buildData.skills.isPalette && paletteMapping) {
                const resolvedSkills = { terrestrial: {} };
                Object.keys(buildData.skills.terrestrial).forEach(slot => {
                    const paletteId = buildData.skills.terrestrial[slot];
                    resolvedSkills.terrestrial[slot] = paletteMapping[paletteId] || paletteId;
                });
                buildData.skills = resolvedSkills;
            }

            // Now fetch the actual skill data
            const skillIds = [];
            if (buildData.skills.terrestrial) {
                Object.values(buildData.skills.terrestrial).forEach(id => {
                    if (id && id > 0) skillIds.push(id);
                });
            }

            let skillsData = {};
            if (skillIds.length > 0) {
                for (const skillId of skillIds) {
                    try {
                        const result = await dataFetcher.getSkills([skillId]);
                        if (result[skillId]) {
                            skillsData[skillId] = result[skillId];
                        }
                    } catch (error) {
                        log(`Skill ${skillId} not found, skipping`, 'error');
                    }
                }
            }

            // Fetch all traits for the specializations
            const allTraitIds = [];
            buildData.specializations.forEach(spec => {
                const specData = specsData[spec.id];
                if (specData) {
                    // Get selected trait IDs
                    const selectedIds = buildParser.getSelectedTraitIds(specData, spec.traits);
                    allTraitIds.push(...selectedIds);

                    // Also get minor traits
                    if (specData.minor_traits) {
                        allTraitIds.push(...specData.minor_traits);
                    }
                }
            });

            const traitsData = allTraitIds.length > 0 ?
                await dataFetcher.getTraits(allTraitIds) :
                {};

            // Fetch ranger pets if applicable
            let petsData = {};
            if (buildData.professionData && buildData.professionData.pets) {
                const petIds = [
                    ...buildData.professionData.pets.terrestrial,
                    ...buildData.professionData.pets.aquatic
                ].filter(id => id > 0);

                if (petIds.length > 0) {
                    try {
                        petsData = await dataFetcher.getPets(petIds);
                        log(`Fetched ${Object.keys(petsData).length} pets`);
                    } catch (error) {
                        log(`Failed to fetch pets: ${error.message}`, 'error');
                    }
                }
            }

            // Enhance build data with fetched info
            buildData.specsData = specsData;
            buildData.skillsData = skillsData;
            buildData.traitsData = traitsData;
            buildData.petsData = petsData;

            // Render the build
            const rendered = renderer.renderBuild(element, buildData, { chatLink: chatLink });
            element.appendChild(rendered);

            // Now fill in the placeholders with actual spec/skill embeds
            buildData.specializations.forEach((spec, idx) => {
                const specData = specsData[spec.id];
                if (specData) {
                    const selectedTraitIds = buildParser.getSelectedTraitIds(specData, spec.traits);
                    const placeholder = rendered.querySelector(`.gw2armory-build-spec-placeholder[data-spec-id="${spec.id}"]`);

                    if (placeholder) {
                        const specRendered = renderer.renderSpecialization(
                            placeholder,
                            specData,
                            {
                                selectedTraits: selectedTraitIds.join(','),
                                traitData: traitsData,
                                compact: true
                            }
                        );
                        placeholder.replaceWith(specRendered);
                    }
                }
            });

            // Fill in skill placeholders
            const skillOrder = ['heal', 'utility1', 'utility2', 'utility3', 'elite'];
            skillOrder.forEach(slot => {
                const skillId = buildData.skills.terrestrial[slot];
                if (skillId && skillId > 0) {
                    const skillData = skillsData[skillId];
                    const placeholder = rendered.querySelector(`.gw2armory-build-skill-placeholder[data-skill-id="${skillId}"]`);

                    if (placeholder) {
                        if (skillData) {
                            const skillRendered = renderer.renderSkill(placeholder, skillData, { size: 48 });
                            placeholder.replaceWith(skillRendered);
                        } else {
                            // Show error for missing skill
                            placeholder.textContent = `Skill ${skillId} not found`;
                            placeholder.style.fontSize = '0.75em';
                            placeholder.style.color = '#f44336';
                        }
                    }
                }
            });

            element.classList.remove('gw2armory-loading');
            stats.embedsRendered++;
            log(`Build template ${index} rendered successfully`, 'success');

        } catch (error) {
            element.classList.remove('gw2armory-loading');
            log(`Error rendering build template ${index}: ${error.message}`, 'error');

            const errorEl = renderer.renderError(element, error.message);
            element.appendChild(errorEl);
        }
    }

    /**
     * Initialize a single embed element
     */
    async function initializeEmbed(element, index) {
        const embedType = element.getAttribute('data-armory-embed');
        const idsAttr = element.getAttribute('data-armory-ids');

        if (!embedType || !idsAttr) {
            log(`Embed ${index} missing required attributes`, 'error');
            return;
        }

        // Clear existing content
        element.innerHTML = '';

        // Add loading class
        element.classList.add('gw2armory-loading');

        // Special handling for build templates
        if (embedType === 'builds') {
            return await initializeBuildEmbed(element, index, idsAttr);
        }

        // Parse IDs
        const ids = idsAttr.split(',').map(id => parseInt(id.trim()));

        // Get options
        const options = {
            size: parseInt(element.getAttribute('data-armory-size')) || 40,
            inlineText: element.getAttribute('data-armory-inline-text'),
            blankText: element.getAttribute('data-armory-blank-text')
        };

        log(`Initializing ${embedType} embed ${index} with IDs: ${ids.join(', ')}`);

        try {
            // Filter out blank slots (-1) for API fetching
            const validIds = ids.filter(id => id !== -1);

            // Fetch data based on embed type (only for valid IDs)
            let data = {};

            if (validIds.length > 0) {
                stats.apiCalls++;

                switch (embedType) {
                    case 'items':
                        data = await dataFetcher.getItems(validIds);

                        // Parse item-specific attributes for each item
                        for (const id of validIds) {
                            const itemData = data[id];
                            if (!itemData) continue;

                            // Get custom stat ID
                            const statId = element.getAttribute(`data-armory-${id}-stat`);
                            if (statId) {
                                itemData.customStatId = parseInt(statId);
                            }

                            // Get custom skin ID
                            const skinId = element.getAttribute(`data-armory-${id}-skin`);
                            if (skinId) {
                                itemData.customSkinId = parseInt(skinId);
                            }

                            // Get custom upgrades
                            const upgrades = element.getAttribute(`data-armory-${id}-upgrades`);
                            if (upgrades) {
                                itemData.customUpgrades = upgrades.split(',').map(u => parseInt(u.trim()));
                            }

                            // Get custom infusions
                            const infusions = element.getAttribute(`data-armory-${id}-infusions`);
                            if (infusions) {
                                itemData.customInfusions = infusions.split(',').map(i => parseInt(i.trim()));
                            }

                            // Get upgrade count
                            const upgradeCount = element.getAttribute(`data-armory-${id}-upgrade-count`);
                            if (upgradeCount) {
                                try {
                                    itemData.customUpgradeCount = JSON.parse(upgradeCount);
                                } catch (e) {
                                    log(`Failed to parse upgrade-count for item ${id}: ${e.message}`, 'error');
                                }
                            }
                        }

                        // Fetch additional data (stats, skins, upgrades, infusions)
                        const statIds = [];
                        const skinIds = [];
                        const upgradeIds = [];
                        const infusionIds = [];

                        for (const id of validIds) {
                            const itemData = data[id];
                            if (!itemData) continue;

                            if (itemData.customStatId) statIds.push(itemData.customStatId);
                            if (itemData.customSkinId) skinIds.push(itemData.customSkinId);
                            if (itemData.customUpgrades) upgradeIds.push(...itemData.customUpgrades);
                            if (itemData.customInfusions) infusionIds.push(...itemData.customInfusions);
                        }

                        // Fetch all additional data in parallel
                        const [statsData, skinsData, upgradesData, infusionsData] = await Promise.all([
                            statIds.length > 0 ? dataFetcher.getItemStats(statIds) : Promise.resolve({}),
                            skinIds.length > 0 ? dataFetcher.getSkins(skinIds) : Promise.resolve({}),
                            upgradeIds.length > 0 ? dataFetcher.getItems(upgradeIds) : Promise.resolve({}),
                            infusionIds.length > 0 ? dataFetcher.getItems(infusionIds) : Promise.resolve({})
                        ]);

                        // Apply custom data to items
                        for (const id of validIds) {
                            const itemData = data[id];
                            if (!itemData) continue;

                            if (itemData.customStatId && statsData[itemData.customStatId]) {
                                itemData.statData = statsData[itemData.customStatId];
                            }

                            if (itemData.customSkinId && skinsData[itemData.customSkinId]) {
                                itemData.skinData = skinsData[itemData.customSkinId];
                            }

                            if (itemData.customUpgrades) {
                                itemData.upgradesData = itemData.customUpgrades.map(uid => upgradesData[uid]).filter(Boolean);
                            }

                            if (itemData.customInfusions) {
                                itemData.infusionsData = itemData.customInfusions.map(iid => infusionsData[iid]).filter(Boolean);
                            }
                        }
                        break;
                    case 'skills':
                        data = await dataFetcher.getSkills(validIds);
                        break;
                    case 'traits':
                        data = await dataFetcher.getTraits(validIds);
                        break;
                    case 'specializations':
                        data = await dataFetcher.getSpecializations(validIds);
                        options.selectedTraits = element.getAttribute('data-armory-traits');

                        // Fetch trait data for the specialization (both major and minor)
                        if (data[validIds[0]]) {
                            const spec = data[validIds[0]];
                            const allTraitIds = [
                                ...(spec.major_traits || []),
                                ...(spec.minor_traits || [])
                            ];
                            if (allTraitIds.length > 0) {
                                options.traitData = await dataFetcher.getTraits(allTraitIds);
                            }
                        }
                        break;
                    case 'amulets':
                        data = await dataFetcher.getAmulets(validIds);
                        break;
                    default:
                        throw new Error(`Unknown embed type: ${embedType}`);
                }
            }

            // Render each item
            ids.forEach(id => {
                const itemData = data[id];

                if (!itemData && id !== -1) {
                    log(`No data found for ${embedType} ID ${id}`, 'error');
                    const errorEl = renderer.renderError(element, `Failed to load ${embedType} ${id}`);
                    element.appendChild(errorEl);
                    return;
                }

                let rendered = null;

                switch (embedType) {
                    case 'items':
                        rendered = renderer.renderItem(element, id === -1 ? { id: -1 } : itemData, options);
                        break;
                    case 'skills':
                        rendered = renderer.renderSkill(element, itemData, options);
                        break;
                    case 'traits':
                        rendered = renderer.renderTrait(element, itemData, options);
                        break;
                    case 'specializations':
                        rendered = renderer.renderSpecialization(element, itemData, options);
                        break;
                    case 'amulets':
                        rendered = renderer.renderAmulet(element, itemData, options);
                        break;
                }

                if (rendered) {
                    element.appendChild(rendered);
                    stats.embedsRendered++;
                }
            });

            element.classList.remove('gw2armory-loading');
            log(`Embed ${index} rendered successfully`, 'success');

        } catch (error) {
            element.classList.remove('gw2armory-loading');
            log(`Error rendering embed ${index}: ${error.message}`, 'error');

            const errorEl = renderer.renderError(element, error.message);
            element.appendChild(errorEl);
        }
    }

    /**
     * Update page statistics
     */
    function updatePageStats() {
        // Update status display if it exists
        if (typeof updateStatus === 'function') {
            updateStatus('Ready');
        }

        // Update cache count
        const cacheStats = dataFetcher ? dataFetcher.getCacheStats() : { entries: 0 };
        const cacheCountEl = document.getElementById('cache-count');
        if (cacheCountEl) {
            cacheCountEl.textContent = cacheStats.entries;
        }

        // Update API calls
        const apiCallsEl = document.getElementById('api-calls');
        if (apiCallsEl) {
            apiCallsEl.textContent = stats.apiCalls;
        }
    }

    /**
     * Public API
     */
    window.GW2Armory = {
        version: '0.1.0',
        init: init,
        config: config,
        stats: stats,
        log: log,
        dataFetcher: () => dataFetcher,
        clearCache: () => dataFetcher ? dataFetcher.clearCache() : 0
    };

    // Auto-initialize
    init();

})(window, document);
