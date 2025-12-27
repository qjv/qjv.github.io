/**
 * GW2 Build Template Generator
 * Main application logic
 */

(function(window, document) {
    'use strict';

    class BuildGeneratorApp {
        constructor() {
            this.parser = new BuildParser();
            this.encoder = new BuildEncoder();

            // Initialize DataFetcher with config
            const config = {
                lang: 'en',
                cache: {
                    enabled: true,
                    duration: 7 * 24 * 60 * 60 * 1000,
                    prefix: 'gw2armory_'
                },
                api: {
                    base: 'https://api.guildwars2.com/v2',
                    timeout: 10000
                },
                debug: true
            };
            this.dataFetcher = new DataFetcher(config);

            this.professions = {
                1: 'Guardian', 2: 'Warrior', 3: 'Engineer',
                4: 'Ranger', 5: 'Thief', 6: 'Elementalist',
                7: 'Mesmer', 8: 'Necromancer', 9: 'Revenant'
            };

            this.legendCodes = {
                1: 'Dragon', 2: 'Assassin', 3: 'Dwarf', 4: 'Demon',
                5: 'Renegade', 6: 'Centaur', 7: 'Alliance', 8: 'Entity'
            };

            this.currentBuild = this.getEmptyBuild();
            this.allSpecs = {};
            this.allSkills = {};
            this.allPets = [];
            this.resolvedSkillIds = {}; // Cache for palette ID → skill ID mapping
            this.traitCache = {}; // Cache for trait data

            this.currentModalContext = null;

            this.init();
        }

        init() {
            console.log('Build Generator initialized');
        }

        getEmptyBuild() {
            return {
                professionCode: 0,
                profession: null,
                specializations: [null, null, null],
                skills: {
                    terrestrial: { heal: 0, utility1: 0, utility2: 0, utility3: 0, elite: 0 },
                    aquatic: { heal: 0, utility1: 0, utility2: 0, utility3: 0, elite: 0 }
                },
                professionData: {},
                weapons: []
            };
        }

        async importBuild() {
            const input = document.getElementById('import-input');
            const code = input.value.trim();

            if (!code) {
                alert('Please enter a build template code');
                return;
            }

            try {
                const parsed = this.parser.parse(code);
                console.log('Parsed build:', parsed);

                // Convert parsed data to our build format
                this.currentBuild = {
                    professionCode: parsed.professionCode,
                    profession: parsed.profession,
                    specializations: parsed.specializations || [null, null, null],
                    skills: {
                        terrestrial: parsed.skills.terrestrial || { heal: 0, utility1: 0, utility2: 0, utility3: 0, elite: 0 },
                        aquatic: parsed.skills.aquatic || { heal: 0, utility1: 0, utility2: 0, utility3: 0, elite: 0 }
                    },
                    professionData: parsed.professionData || {},
                    weapons: parsed.weapons || []
                };

                console.log('Converted build:', this.currentBuild);

                // Hide profession selector since we have a profession
                document.getElementById('profession-selector').style.display = 'none';

                // Show template output
                document.getElementById('template-output').style.display = 'block';

                await this.loadBuild();
            } catch (error) {
                alert(`Failed to import build: ${error.message}`);
                console.error(error);
            }
        }

        createNew() {
            document.getElementById('profession-selector').style.display = 'block';
            document.getElementById('build-editor').classList.remove('active');
            document.getElementById('template-output').style.display = 'none';
        }

        async selectProfession(code) {
            // Update UI
            document.querySelectorAll('.profession-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-profession="${code}"]`).classList.add('active');

            // Set build
            this.currentBuild = this.getEmptyBuild();
            this.currentBuild.professionCode = code;
            this.currentBuild.profession = this.professions[code];

            // Initialize profession-specific data
            if (this.currentBuild.profession === 'Ranger') {
                this.currentBuild.professionData.pets = {
                    terrestrial: [0, 0],
                    aquatic: [0, 0]
                };
            } else if (this.currentBuild.profession === 'Revenant') {
                this.currentBuild.professionData.legends = {
                    terrestrial: [0, 0],
                    aquatic: [0, 0]
                };
                this.currentBuild.professionData.inactiveSkills = [0, 0, 0, 0, 0, 0];
            }

            await this.loadBuild();
        }

        async loadBuild() {
            // Show editor
            const editor = document.getElementById('build-editor');
            editor.classList.add('active');
            editor.innerHTML = '<div class="loading">Loading build data</div>';

            // Show template output
            document.getElementById('template-output').style.display = 'block';

            try {
                // Load profession data
                await this.loadProfessionData();

                // Resolve all palette IDs to skill IDs upfront
                await this.resolvePaletteIdsInBuild();

                // Restore editor content
                editor.innerHTML = `
                    <!-- Specializations -->
                    <div class="section">
                        <h3>Specializations</h3>
                        <div class="specs-grid">
                            <div class="spec-slot empty" onclick="buildGenerator.selectSpec(0)">
                                Click to select specialization
                            </div>
                            <div class="spec-slot empty" onclick="buildGenerator.selectSpec(1)">
                                Click to select specialization
                            </div>
                            <div class="spec-slot empty" onclick="buildGenerator.selectSpec(2)">
                                Click to select specialization
                            </div>
                        </div>
                    </div>

                    <!-- Skills -->
                    <div class="section">
                        <h3>Skills <span style="font-size: 0.9rem; color: #a0aec0;">(Terrestrial)</span></h3>
                        <div class="skills-grid" id="skills-terrestrial">
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('terrestrial', 'heal')">
                                <span class="label">Heal</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('terrestrial', 'utility1')">
                                <span class="label">Utility 1</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('terrestrial', 'utility2')">
                                <span class="label">Utility 2</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('terrestrial', 'utility3')">
                                <span class="label">Utility 3</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('terrestrial', 'elite')">
                                <span class="label">Elite</span>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h3>Skills <span class="aquatic-label">Aquatic</span></h3>
                        <div class="skills-grid" id="skills-aquatic">
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('aquatic', 'heal')">
                                <span class="label">Heal</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('aquatic', 'utility1')">
                                <span class="label">Utility 1</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('aquatic', 'utility2')">
                                <span class="label">Utility 2</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('aquatic', 'utility3')">
                                <span class="label">Utility 3</span>
                            </div>
                            <div class="skill-slot" onclick="buildGenerator.selectSkill('aquatic', 'elite')">
                                <span class="label">Elite</span>
                            </div>
                        </div>
                    </div>

                    <!-- Ranger Pets -->
                    <div class="section" id="ranger-pets" style="display: ${this.currentBuild.profession === 'Ranger' ? 'block' : 'none'};">
                        <h3>Ranger Pets</h3>
                        <div class="pets-grid">
                            <div class="pet-group">
                                <h4>Terrestrial</h4>
                                <div class="pet-slot">
                                    <div onclick="buildGenerator.selectPet('terrestrial', 0)"></div>
                                    <div onclick="buildGenerator.selectPet('terrestrial', 1)"></div>
                                </div>
                            </div>
                            <div class="pet-group">
                                <h4 class="aquatic-label" style="display: inline;">Aquatic</h4>
                                <div class="pet-slot">
                                    <div onclick="buildGenerator.selectPet('aquatic', 0)"></div>
                                    <div onclick="buildGenerator.selectPet('aquatic', 1)"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Revenant Legends -->
                    <div class="section" id="revenant-legends" style="display: ${this.currentBuild.profession === 'Revenant' ? 'block' : 'none'};">
                        <h3>Revenant Legends</h3>
                        <div class="legends-grid">
                            <div class="legend-group">
                                <h4>Terrestrial</h4>
                                <div class="legend-slot">
                                    <div onclick="buildGenerator.selectLegend('terrestrial', 0)"></div>
                                    <div onclick="buildGenerator.selectLegend('terrestrial', 1)"></div>
                                </div>
                            </div>
                            <div class="legend-group">
                                <h4 class="aquatic-label" style="display: inline;">Aquatic</h4>
                                <div class="legend-slot">
                                    <div onclick="buildGenerator.selectLegend('aquatic', 0)"></div>
                                    <div onclick="buildGenerator.selectLegend('aquatic', 1)"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // Render build
                await this.renderSpecializations();
                await this.renderSkills();
                if (this.currentBuild.profession === 'Ranger') {
                    this.renderPets();
                } else if (this.currentBuild.profession === 'Revenant') {
                    this.renderLegends();
                }

                // Initialize armory embeds ONCE after all rendering is done (for skills only)
                await new Promise(resolve => setTimeout(resolve, 50));
                if (window.GW2Armory && window.GW2Armory.init) {
                    console.log('Initializing armory embeds for skills');
                    window.GW2Armory.init();
                }

                this.updateExport();
            } catch (error) {
                editor.innerHTML = `<div style="color: #f56565; text-align: center; padding: 2rem;">Error loading build: ${error.message}</div>`;
                console.error(error);
            }
        }

        async loadProfessionData() {
            // Only fetch specializations that are actually used in the build
            this.allSpecs = {};
            const specIds = this.currentBuild.specializations
                .filter(s => s && s.id)
                .map(s => s.id);

            if (specIds.length > 0) {
                const specsData = await this.dataFetcher.getSpecializations(specIds);
                this.allSpecs = specsData;
            }

            // Skills will be resolved via palette mapping - no need to pre-fetch all
            this.allSkills = {};

            // Only fetch pets if Ranger and if pets are used
            if (this.currentBuild.profession === 'Ranger') {
                const pets = this.currentBuild.professionData.pets || { terrestrial: [0, 0], aquatic: [0, 0] };
                const petIds = [
                    ...pets.terrestrial.filter(id => id > 0),
                    ...pets.aquatic.filter(id => id > 0)
                ];

                if (petIds.length > 0) {
                    const petsData = await this.dataFetcher.getPets(petIds);
                    this.allPets = Object.values(petsData);
                } else {
                    this.allPets = [];
                }
            }
        }

        async resolvePaletteIdsInBuild() {
            // Collect all palette IDs from the build
            const paletteIds = new Set();

            ['terrestrial', 'aquatic'].forEach(env => {
                const skills = this.currentBuild.skills[env];
                Object.values(skills).forEach(paletteId => {
                    if (paletteId && paletteId > 0) {
                        paletteIds.add(paletteId);
                    }
                });
            });

            if (paletteIds.size === 0) {
                console.log('No palette IDs to resolve');
                return;
            }

            console.log('Resolving palette IDs:', Array.from(paletteIds));

            // First, try using static palette mapping
            const resolved = {};
            const unresolvedIds = [];

            paletteIds.forEach(paletteId => {
                // Try static mapping first
                const skillId = window.resolvePaletteId ? window.resolvePaletteId(paletteId) : null;

                if (skillId) {
                    resolved[paletteId] = skillId;
                    console.log(`Static mapping: Palette ${paletteId} → Skill ${skillId}`);
                } else {
                    unresolvedIds.push(paletteId);
                }
            });

            // For any unresolved IDs, try API fallback
            if (unresolvedIds.length > 0) {
                console.log('Falling back to API for palette IDs:', unresolvedIds);

                try {
                    const apiResolved = await this.dataFetcher.resolvePaletteIds(
                        unresolvedIds,
                        this.currentBuild.profession
                    );

                    Object.assign(resolved, apiResolved);
                } catch (error) {
                    console.error('Failed to resolve palette IDs via API:', error);
                    // Last fallback: use palette IDs as skill IDs
                    unresolvedIds.forEach(paletteId => {
                        resolved[paletteId] = paletteId;
                    });
                }
            }

            // Store the mapping
            this.resolvedSkillIds = resolved;
            console.log('Final resolved skill IDs:', this.resolvedSkillIds);
        }

        async renderSpecializations() {
            const slots = document.querySelectorAll('.spec-slot');

            for (let i = 0; i < 3; i++) {
                const slot = slots[i];
                const spec = this.currentBuild.specializations[i];

                if (spec && spec.id) {
                    // Fetch spec data if we don't have it
                    if (!this.allSpecs[spec.id]) {
                        const data = await this.dataFetcher.getSpecializations([spec.id]);
                        this.allSpecs[spec.id] = data[spec.id];
                    }

                    const specData = this.allSpecs[spec.id];
                    if (specData) {
                        // Fetch trait data for all traits in this spec
                        const allTraitIds = [
                            ...(specData.major_traits || []),
                            ...(specData.minor_traits || [])
                        ];

                        if (!this.traitCache) {
                            this.traitCache = {};
                        }

                        // Fetch traits we don't have cached
                        const uncachedTraits = allTraitIds.filter(id => !this.traitCache[id]);
                        if (uncachedTraits.length > 0) {
                            const traitsData = await this.dataFetcher.getTraits(uncachedTraits);
                            Object.assign(this.traitCache, traitsData);
                        }

                        slot.classList.remove('empty');
                        slot.classList.add('filled');

                        // Render custom traitline
                        slot.innerHTML = this.renderCustomTraitline(specData, spec, i);
                    }
                } else {
                    slot.classList.add('empty');
                    slot.classList.remove('filled');
                    slot.innerHTML = 'Click to select specialization';
                }
            }
        }

        renderCustomTraitline(specData, spec, slotIndex) {
            const majorTraits = specData.major_traits || [];
            const minorTraits = specData.minor_traits || [];

            // Get trait choices for each tier (Adept, Master, Grandmaster)
            const tiers = [
                { name: 'Adept', traits: majorTraits.slice(0, 3), choiceIndex: 0 },
                { name: 'Master', traits: majorTraits.slice(3, 6), choiceIndex: 1 },
                { name: 'Grandmaster', traits: majorTraits.slice(6, 9), choiceIndex: 2 }
            ];

            let html = `
                <div class="custom-traitline">
                    <img src="${specData.background}" class="traitline-background" alt="">
                    <div class="traitline-content">
                        <div class="traitline-icon">
                            <img src="${specData.icon}" alt="${specData.name}">
                        </div>
                        <div class="traitline-info">
                            <div class="traitline-name">${specData.name}</div>
                            <div class="traitline-tiers">`;

            tiers.forEach(tier => {
                html += `<div class="trait-tier">`;

                tier.traits.forEach((traitId, choiceNum) => {
                    const selected = spec.traits[tier.choiceIndex] === (choiceNum + 1);
                    const selectedClass = selected ? 'selected' : 'inactive';
                    const traitData = this.traitCache[traitId];
                    const traitName = traitData ? traitData.name : `Trait ${traitId}`;

                    html += `
                        <div class="trait-choice ${selectedClass}"
                             onclick="buildGenerator.selectTrait(${slotIndex}, ${tier.choiceIndex}, ${choiceNum + 1})"
                             data-trait-id="${traitId}"
                             title="${traitName}">
                            <img src="https://render.guildwars2.com/file/${this.getTraitIcon(traitId)}"
                                 alt="${traitName}"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect fill=%22%232d3748%22 width=%2264%22 height=%2264%22/%3E%3C/svg%3E'">
                        </div>`;
                });

                html += `</div>`;
            });

            html += `
                            </div>
                        </div>
                    </div>
                </div>`;

            return html;
        }

        getTraitIcon(traitId) {
            if (!this.traitCache || !this.traitCache[traitId]) {
                return ''; // Return empty if trait not cached
            }

            const trait = this.traitCache[traitId];
            if (!trait.icon) return '';

            // Extract the file signature from the icon URL
            // Format: https://render.guildwars2.com/file/SIGNATURE/SIGNATURE.png
            const match = trait.icon.match(/file\/([A-F0-9]+)\//);
            return match ? match[1] + '/' + match[1] + '.png' : '';
        }

        selectTrait(slotIndex, tierIndex, choice) {
            if (!this.currentBuild.specializations[slotIndex]) return;

            // Update the trait choice
            this.currentBuild.specializations[slotIndex].traits[tierIndex] = choice;

            // Re-render this specialization
            this.renderSpecializations();
            this.updateExport();
        }

        getTraitIdsString(specData, choices) {
            const traitIds = this.parser.getSelectedTraitIds(specData, choices);
            return traitIds.join(',');
        }

        async renderSkills() {
            for (const type of ['terrestrial', 'aquatic']) {
                const container = document.getElementById(`skills-${type}`);
                const slots = container.querySelectorAll('.skill-slot');
                const skills = this.currentBuild.skills[type];
                const skillOrder = ['heal', 'utility1', 'utility2', 'utility3', 'elite'];

                for (let index = 0; index < skillOrder.length; index++) {
                    const skillType = skillOrder[index];
                    const slot = slots[index];
                    const paletteId = skills[skillType];

                    if (paletteId && paletteId > 0) {
                        // Get resolved skill ID from our cache
                        const skillId = this.resolvedSkillIds[paletteId];

                        if (skillId && skillId > 0) {
                            slot.classList.add('filled');
                            slot.classList.remove('empty');
                            const label = slot.querySelector('.label');
                            const labelText = label ? label.textContent : '';

                            slot.innerHTML = `<div data-armory-embed="skills" data-armory-ids="${skillId}"></div>`;

                            // Re-add label
                            if (labelText) {
                                const newLabel = document.createElement('span');
                                newLabel.className = 'label';
                                newLabel.textContent = labelText;
                                slot.appendChild(newLabel);
                            }
                        } else {
                            console.warn(`No skill ID resolved for palette ID ${paletteId}`);
                            this.renderEmptySkillSlot(slot, index);
                        }
                    } else {
                        this.renderEmptySkillSlot(slot, index);
                    }
                }
            }
        }

        renderEmptySkillSlot(slot, index) {
            const labels = ['Heal', 'Utility 1', 'Utility 2', 'Utility 3', 'Elite'];
            slot.classList.remove('filled');
            slot.classList.add('empty');
            slot.innerHTML = `<span class="label">${labels[index]}</span>`;
        }

        renderPets() {
            const pets = this.currentBuild.professionData.pets || { terrestrial: [0, 0], aquatic: [0, 0] };

            ['terrestrial', 'aquatic'].forEach(type => {
                // Find the correct pet group
                const groups = document.querySelectorAll('.pet-group');
                let targetGroup;
                groups.forEach(g => {
                    const h4Text = g.querySelector('h4').textContent.toLowerCase();
                    if ((type === 'terrestrial' && h4Text.includes('terrestrial')) ||
                        (type === 'aquatic' && h4Text.includes('aquatic'))) {
                        targetGroup = g;
                    }
                });

                if (targetGroup) {
                    const petSlots = targetGroup.querySelectorAll('.pet-slot > div');
                    [0, 1].forEach(index => {
                        const petId = pets[type][index];
                        const slot = petSlots[index];

                        if (petId && petId > 0) {
                            // Try to find pet in loaded data
                            const pet = this.allPets.find(p => p.id === petId);
                            if (pet) {
                                slot.classList.add('filled');
                                slot.style.backgroundImage = `url(${pet.icon})`;
                                slot.style.backgroundSize = 'cover';
                                slot.title = pet.name;
                                slot.innerHTML = '';
                            } else {
                                // If not loaded yet, fetch it
                                this.dataFetcher.getPets([petId]).then(data => {
                                    const petData = data[petId];
                                    if (petData) {
                                        this.allPets.push(petData);
                                        slot.classList.add('filled');
                                        slot.style.backgroundImage = `url(${petData.icon})`;
                                        slot.style.backgroundSize = 'cover';
                                        slot.title = petData.name;
                                        slot.innerHTML = '';
                                    }
                                });
                            }
                        } else {
                            slot.classList.remove('filled');
                            slot.style.backgroundImage = '';
                            slot.title = '';
                            slot.innerHTML = '';
                        }
                    });
                }
            });
        }

        renderLegends() {
            const legends = this.currentBuild.professionData.legends || { terrestrial: [0, 0], aquatic: [0, 0] };
            const legendInfo = {
                1: { name: 'Dragon', icon: 'https://render.guildwars2.com/file/27B5D1D4127A2EE73866E54F5A43E9102618B90B/1058605.png' },
                2: { name: 'Assassin', icon: 'https://render.guildwars2.com/file/67CDD35F6BC3072E0837715A5E0A90646529BAA2/1030005.png' },
                3: { name: 'Dwarf', icon: 'https://render.guildwars2.com/file/03C66FA8A89697A0C4D309484172080E3A1141EF/961410.png' },
                4: { name: 'Demon', icon: 'https://render.guildwars2.com/file/1A1407F7D34E5ED41B59A25F39EBF728CC926423/961413.png' },
                5: { name: 'Renegade', icon: 'https://render.guildwars2.com/file/6B3205EF5ED0802DB74BBF7F0CAE04FAA2089B74/1770592.png' },
                6: { name: 'Centaur', icon: 'https://render.guildwars2.com/file/6CFF31B50AA00CAF3D35A02562964802B55AD292/1024105.png' },
                7: { name: 'Alliance', icon: 'https://render.guildwars2.com/file/E1910F4C5C74E0B00AB262D2D3DBA3FB51BE90CA/2491626.png' },
                8: { name: 'Entity', icon: 'https://render.guildwars2.com/file/3FEE4B97282956F1F3654BE36119A0030E08C1D7/3680200.png' }
            };

            ['terrestrial', 'aquatic'].forEach(type => {
                const groups = document.querySelectorAll('.legend-group');
                let targetGroup;
                groups.forEach(g => {
                    const h4Text = g.querySelector('h4').textContent.toLowerCase();
                    if ((type === 'terrestrial' && h4Text.includes('terrestrial')) ||
                        (type === 'aquatic' && h4Text.includes('aquatic'))) {
                        targetGroup = g;
                    }
                });

                if (targetGroup) {
                    const legendSlots = targetGroup.querySelectorAll('.legend-slot > div');
                    [0, 1].forEach(index => {
                        const legendData = legends[type] && legends[type][index];
                        const slot = legendSlots[index];

                        // Handle both formats: object (from parser) or number (from encoder)
                        let legend = null;
                        let legendCode = 0;

                        if (typeof legendData === 'object' && legendData !== null) {
                            // Parsed format - already has name and icon
                            legend = legendData;
                            // Try to find the code from the name
                            for (const code in legendInfo) {
                                if (legendInfo[code].name === legendData.name) {
                                    legendCode = parseInt(code);
                                    break;
                                }
                            }
                        } else if (typeof legendData === 'number' && legendData > 0) {
                            // Encoder format - just a code
                            legendCode = legendData;
                            legend = legendInfo[legendCode];
                        }

                        if (legend && legend.icon) {
                            slot.classList.add('filled');
                            slot.style.backgroundImage = `url(${legend.icon})`;
                            slot.style.backgroundSize = 'cover';
                            slot.title = legend.name;
                            slot.innerHTML = '';
                            slot.dataset.legendCode = legendCode;
                        } else {
                            slot.classList.remove('filled');
                            slot.style.backgroundImage = '';
                            slot.title = '';
                            slot.innerHTML = '';
                            delete slot.dataset.legendCode;
                        }
                    });
                }
            });
        }

        async selectSpec(slotIndex) {
            this.currentModalContext = { type: 'spec', index: slotIndex };

            const modal = document.getElementById('selection-modal');
            const title = document.getElementById('modal-title');
            const items = document.getElementById('modal-items');

            title.textContent = 'Select Specialization';
            items.innerHTML = '<div style="text-align: center; padding: 2rem; color: #a0aec0;">Loading specializations...</div>';

            // Fetch all specializations for this profession if not already loaded
            if (Object.keys(this.allSpecs).length === 0) {
                try {
                    const allSpecsData = await this.dataFetcher.fetchAllSpecializations();

                    // Filter to only this profession's specs
                    for (const spec of allSpecsData) {
                        if (spec.profession === this.currentBuild.profession) {
                            this.allSpecs[spec.id] = spec;
                        }
                    }
                } catch (error) {
                    console.error('Failed to load specializations:', error);
                    items.innerHTML = '<div style="text-align: center; padding: 2rem; color: #f56565;">Failed to load specializations</div>';
                    return;
                }
            }

            items.innerHTML = '';

            // Add "None" option to clear the slot
            const noneItem = document.createElement('div');
            noneItem.className = 'item-option';
            noneItem.style.background = '#1a1a1a';
            noneItem.style.border = '2px dashed #444';
            noneItem.style.display = 'flex';
            noneItem.style.alignItems = 'center';
            noneItem.style.justifyContent = 'center';
            noneItem.textContent = 'None';
            noneItem.style.color = '#666';
            noneItem.onclick = () => this.applySpec(slotIndex, null);
            items.appendChild(noneItem);

            // List all specs for this profession
            for (const specId in this.allSpecs) {
                const spec = this.allSpecs[specId];
                const item = document.createElement('div');
                item.className = 'item-option';
                item.style.backgroundImage = `url(${spec.icon})`;
                item.style.backgroundSize = 'cover';
                item.title = spec.name;
                item.onclick = () => this.applySpec(slotIndex, spec);
                items.appendChild(item);
            }

            modal.classList.add('active');
        }

        async applySpec(slotIndex, spec) {
            if (spec === null) {
                // Clear the specialization slot
                this.currentBuild.specializations[slotIndex] = null;
            } else {
                this.currentBuild.specializations[slotIndex] = {
                    id: spec.id,
                    traits: [1, 1, 1] // Default to top trait in each tier
                };

                // Store spec data if not already loaded
                if (!this.allSpecs[spec.id]) {
                    this.allSpecs[spec.id] = spec;
                }
            }

            this.closeModal();
            await this.renderSpecializations();
            this.updateExport();
        }

        async selectSkill(environment, skillType) {
            this.currentModalContext = { type: 'skill', environment, skillType };

            const modal = document.getElementById('selection-modal');
            const title = document.getElementById('modal-title');
            const items = document.getElementById('modal-items');
            const searchInput = document.getElementById('modal-search');

            const typeNames = {
                heal: 'Heal',
                utility1: 'Utility',
                utility2: 'Utility',
                utility3: 'Utility',
                elite: 'Elite'
            };

            title.textContent = `Select ${typeNames[skillType]} Skill`;
            items.innerHTML = '<div style="text-align: center; padding: 2rem; color: #a0aec0;">Loading skills...</div>';

            // Fetch skills for this profession if not already loaded
            if (Object.keys(this.allSkills).length === 0) {
                try {
                    // Fetch skills from profession endpoint (more efficient)
                    const professionData = await this.dataFetcher.fetchSingle('professions', this.currentBuild.profession);
                    const skillIds = [...new Set([
                        ...(professionData.skills || []).map(s => s.id),
                        ...(professionData.training || [])
                            .filter(t => t.type === 'Skill')
                            .map(t => t.skill_id)
                    ])];

                    const skillsData = await this.dataFetcher.getSkills(skillIds);
                    this.allSkills = skillsData;
                } catch (error) {
                    console.error('Failed to load skills:', error);
                    items.innerHTML = '<div style="text-align: center; padding: 2rem; color: #f56565;">Failed to load skills</div>';
                    return;
                }
            }

            // Get active specialization IDs
            const activeSpecIds = this.currentBuild.specializations
                .filter(s => s && s.id)
                .map(s => s.id);

            // Filter skills by type and categorize them
            const skillTypeFilter = skillType === 'heal' ? 'Heal' : skillType === 'elite' ? 'Elite' : 'Utility';

            const categorizeSkill = (skill) => {
                // Check if skill is racial (belongs to no profession)
                if (!skill.professions || skill.professions.length === 0) {
                    return 'racial';
                }

                // Check if skill belongs to a specialization
                if (skill.specialization) {
                    // Only show if it's one of the active specializations
                    if (activeSpecIds.includes(skill.specialization)) {
                        return 'specialization';
                    }
                    return null; // Don't show skills from inactive specializations
                }

                // Base profession skill
                if (skill.professions && skill.professions.includes(this.currentBuild.profession)) {
                    return 'base';
                }

                return null;
            };

            const skillsByCategory = {
                racial: [],
                base: [],
                specialization: []
            };

            Object.values(this.allSkills).forEach(skill => {
                if (skill.type !== skillTypeFilter) return;

                const category = categorizeSkill(skill);
                if (category) {
                    skillsByCategory[category].push(skill);
                }
            });

            const renderSkills = (filter = '') => {
                items.innerHTML = '';
                const searchTerm = filter.toLowerCase();

                // Add "None" option to clear the slot
                const noneItem = document.createElement('div');
                noneItem.className = 'item-option';
                noneItem.style.background = '#1a1a1a';
                noneItem.style.border = '2px dashed #444';
                noneItem.style.display = 'flex';
                noneItem.style.alignItems = 'center';
                noneItem.style.justifyContent = 'center';
                noneItem.textContent = 'None';
                noneItem.style.color = '#666';
                noneItem.onclick = () => this.applySkill(environment, skillType, null);
                items.appendChild(noneItem);

                const createSeparator = (text) => {
                    const separator = document.createElement('div');
                    separator.style.cssText = 'padding: 0.5rem 1rem; color: #a0aec0; font-size: 0.85rem; font-weight: 600; border-bottom: 1px solid #2d3748; margin-bottom: 0.5rem; background: #1a202c;';
                    separator.textContent = text;
                    return separator;
                };

                const createSkillItem = (skill) => {
                    const item = document.createElement('div');
                    item.className = 'item-option';
                    item.style.backgroundImage = `url(${skill.icon})`;
                    item.style.backgroundSize = 'cover';
                    item.title = skill.name;
                    item.onclick = () => this.applySkill(environment, skillType, skill);
                    return item;
                };

                // Render racial skills
                const filteredRacial = skillsByCategory.racial.filter(s => s.name.toLowerCase().includes(searchTerm));
                if (filteredRacial.length > 0) {
                    items.appendChild(createSeparator('Racial Skills'));
                    filteredRacial.forEach(skill => items.appendChild(createSkillItem(skill)));
                }

                // Render base profession skills
                const filteredBase = skillsByCategory.base.filter(s => s.name.toLowerCase().includes(searchTerm));
                if (filteredBase.length > 0) {
                    items.appendChild(createSeparator(this.currentBuild.profession + ' Skills'));
                    filteredBase.forEach(skill => items.appendChild(createSkillItem(skill)));
                }

                // Render specialization skills
                const filteredSpec = skillsByCategory.specialization.filter(s => s.name.toLowerCase().includes(searchTerm));
                if (filteredSpec.length > 0) {
                    items.appendChild(createSeparator('Specialization Skills'));
                    filteredSpec.forEach(skill => items.appendChild(createSkillItem(skill)));
                }

                if (items.children.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.style.cssText = 'text-align: center; padding: 2rem; color: #a0aec0;';
                    noResults.textContent = 'No skills found';
                    items.appendChild(noResults);
                }
            };

            searchInput.value = '';
            searchInput.oninput = (e) => renderSkills(e.target.value);
            renderSkills();

            modal.classList.add('active');
        }

        async applySkill(environment, skillType, skill) {
            if (skill === null) {
                // Clear the skill slot
                this.currentBuild.skills[environment][skillType] = 0;
            } else {
                // Try to get palette ID from reverse mapping
                let paletteId = window.getPaletteIdForSkill ? window.getPaletteIdForSkill(skill.id) : null;

                // If not in static mapping, try to fetch from API
                if (!paletteId) {
                    try {
                        const professionData = await this.dataFetcher.fetchSingle('professions', this.currentBuild.profession);

                        if (professionData.skills_by_palette) {
                            // Find palette ID for this skill ID
                            const entry = professionData.skills_by_palette.find(pair =>
                                Array.isArray(pair) && pair[1] === skill.id
                            );

                            if (entry && entry[0]) {
                                paletteId = entry[0];
                                console.log(`API mapping: Skill ${skill.id} → Palette ${paletteId}`);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to fetch palette mapping:', error);
                    }
                }

                // Last fallback: use skill ID as palette ID (may not work correctly)
                if (!paletteId) {
                    paletteId = skill.id;
                    console.warn(`No palette ID found for skill ${skill.id}, using skill ID directly`);
                }

                this.currentBuild.skills[environment][skillType] = paletteId;

                // Store the resolved mapping so we can render it
                this.resolvedSkillIds[paletteId] = skill.id;
            }

            this.closeModal();
            await this.renderSkills();

            // Re-initialize armory for the new skill
            await new Promise(resolve => setTimeout(resolve, 50));
            if (window.GW2Armory && window.GW2Armory.init) {
                window.GW2Armory.init();
            }

            this.updateExport();
        }

        async selectPet(environment, slotIndex) {
            this.currentModalContext = { type: 'pet', environment, index: slotIndex };

            const modal = document.getElementById('selection-modal');
            const title = document.getElementById('modal-title');
            const items = document.getElementById('modal-items');
            const searchInput = document.getElementById('modal-search');

            title.textContent = 'Select Pet';
            items.innerHTML = '<div style="text-align: center; padding: 2rem; color: #a0aec0;">Loading pets...</div>';

            // Fetch all pets if not already loaded
            if (!this.allPets || this.allPets.length === 0) {
                try {
                    this.allPets = await this.dataFetcher.fetchAllPets();
                } catch (error) {
                    console.error('Failed to load pets:', error);
                    items.innerHTML = '<div style="text-align: center; padding: 2rem; color: #f56565;">Failed to load pets</div>';
                    return;
                }
            }

            const renderPets = (filter = '') => {
                items.innerHTML = '';

                // Add "None" option
                const noneItem = document.createElement('div');
                noneItem.className = 'item-option';
                noneItem.style.background = '#1a1a1a';
                noneItem.style.border = '2px dashed #444';
                noneItem.style.display = 'flex';
                noneItem.style.alignItems = 'center';
                noneItem.style.justifyContent = 'center';
                noneItem.textContent = 'None';
                noneItem.style.color = '#666';
                noneItem.onclick = () => this.applyPet(environment, slotIndex, null);
                items.appendChild(noneItem);

                this.allPets
                    .filter(pet => pet.name.toLowerCase().includes(filter.toLowerCase()))
                    .forEach(pet => {
                        const item = document.createElement('div');
                        item.className = 'item-option';
                        item.style.backgroundImage = `url(${pet.icon})`;
                        item.style.backgroundSize = 'cover';
                        item.title = pet.name;
                        item.onclick = () => this.applyPet(environment, slotIndex, pet);
                        items.appendChild(item);
                    });
            };

            searchInput.value = '';
            searchInput.oninput = (e) => renderPets(e.target.value);
            renderPets();

            modal.classList.add('active');
        }

        applyPet(environment, slotIndex, pet) {
            if (!this.currentBuild.professionData.pets) {
                this.currentBuild.professionData.pets = {
                    terrestrial: [0, 0],
                    aquatic: [0, 0]
                };
            }

            this.currentBuild.professionData.pets[environment][slotIndex] = pet ? pet.id : 0;

            this.closeModal();
            this.renderPets();
            this.updateExport();
        }

        async selectLegend(environment, slotIndex) {
            this.currentModalContext = { type: 'legend', environment, index: slotIndex };

            const modal = document.getElementById('selection-modal');
            const title = document.getElementById('modal-title');
            const items = document.getElementById('modal-items');

            title.textContent = 'Select Legend';
            items.innerHTML = '';

            const legendInfo = {
                1: { name: 'Dragon', icon: 'https://render.guildwars2.com/file/27B5D1D4127A2EE73866E54F5A43E9102618B90B/1058605.png' },
                2: { name: 'Assassin', icon: 'https://render.guildwars2.com/file/67CDD35F6BC3072E0837715A5E0A90646529BAA2/1030005.png' },
                3: { name: 'Dwarf', icon: 'https://render.guildwars2.com/file/03C66FA8A89697A0C4D309484172080E3A1141EF/961410.png' },
                4: { name: 'Demon', icon: 'https://render.guildwars2.com/file/1A1407F7D34E5ED41B59A25F39EBF728CC926423/961413.png' },
                5: { name: 'Renegade', icon: 'https://render.guildwars2.com/file/6B3205EF5ED0802DB74BBF7F0CAE04FAA2089B74/1770592.png' },
                6: { name: 'Centaur', icon: 'https://render.guildwars2.com/file/6CFF31B50AA00CAF3D35A02562964802B55AD292/1024105.png' },
                7: { name: 'Alliance', icon: 'https://render.guildwars2.com/file/E1910F4C5C74E0B00AB262D2D3DBA3FB51BE90CA/2491626.png' },
                8: { name: 'Entity', icon: 'https://render.guildwars2.com/file/3FEE4B97282956F1F3654BE36119A0030E08C1D7/3680200.png' }
            };

            for (const code in legendInfo) {
                const legend = legendInfo[code];
                const item = document.createElement('div');
                item.className = 'item-option';
                item.style.backgroundImage = `url(${legend.icon})`;
                item.style.backgroundSize = 'cover';
                item.title = legend.name;
                item.onclick = () => this.applyLegend(environment, slotIndex, parseInt(code));
                items.appendChild(item);
            }

            modal.classList.add('active');
        }

        applyLegend(environment, slotIndex, legendCode) {
            if (!this.currentBuild.professionData.legends) {
                this.currentBuild.professionData.legends = {
                    terrestrial: [0, 0],
                    aquatic: [0, 0]
                };
            }

            this.currentBuild.professionData.legends[environment][slotIndex] = legendCode;

            this.closeModal();
            this.renderLegends();
            this.updateExport();
        }

        closeModal() {
            document.getElementById('selection-modal').classList.remove('active');
            this.currentModalContext = null;
        }

        updateExport() {
            try {
                const chatLink = this.encoder.encode(this.currentBuild);
                const displayElement = document.getElementById('build-code-display');
                const templateSection = document.getElementById('template-output');

                if (displayElement) {
                    displayElement.textContent = chatLink;
                }

                if (templateSection) {
                    templateSection.style.display = 'block';
                }
            } catch (error) {
                const displayElement = document.getElementById('build-code-display');
                if (displayElement) {
                    displayElement.textContent = 'Error generating build code';
                }
                console.error(error);
            }
        }

        copyCode() {
            const code = document.getElementById('build-code-display').textContent;
            navigator.clipboard.writeText(code).then(() => {
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }).catch(err => {
                alert('Failed to copy: ' + err);
            });
        }
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.buildGenerator = new BuildGeneratorApp();
    });

})(window, document);
