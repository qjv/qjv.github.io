/**
 * GW2 Armory Embeds - Renderer
 * Handles rendering of embed elements
 */

(function(window, document) {
    'use strict';

    class Renderer {
        constructor(config, tooltipSystem) {
            this.config = config;
            this.tooltipSystem = tooltipSystem;
        }

        /**
         * Render item embed
         */
        renderItem(element, item, options = {}) {
            const size = options.size || 40;
            const inlineText = options.inlineText;
            const isBlank = item.id === -1;

            // Create container
            const container = document.createElement('div');
            container.className = 'gw2armory-embed';

            // Create icon
            const icon = document.createElement('div');
            icon.className = isBlank ? 'gw2armory-icon blank' : 'gw2armory-icon';
            icon.setAttribute('data-size', size);

            if (!isBlank) {
                icon.style.backgroundImage = `url(${item.icon})`;
                icon.setAttribute('data-rarity', item.rarity);

                // Add hover events for tooltip
                icon.addEventListener('mouseenter', () => {
                    this.tooltipSystem.show(icon, item, 'items');
                });

                icon.addEventListener('mouseleave', () => {
                    this.tooltipSystem.hide();
                });
            } else {
                // Blank slot
                icon.style.width = `${size}px`;
                icon.style.height = `${size}px`;
                icon.title = options.blankText || 'Empty Slot';
            }

            container.appendChild(icon);

            // Add inline text if requested
            if (inlineText && !isBlank) {
                if (inlineText === 'wiki') {
                    const link = document.createElement('a');
                    link.className = 'gw2armory-link';
                    link.href = `https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name)}`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = item.name;
                    link.setAttribute('data-rarity', item.rarity);
                    container.appendChild(link);
                } else {
                    const text = document.createElement('span');
                    text.textContent = item.name;
                    text.setAttribute('data-rarity', item.rarity);
                    container.appendChild(text);
                }
            }

            return container;
        }

        /**
         * Render skill embed
         */
        renderSkill(element, skill, options = {}) {
            const size = options.size || 40;
            const inlineText = options.inlineText;

            const container = document.createElement('div');
            container.className = 'gw2armory-embed';

            const icon = document.createElement('div');
            icon.className = 'gw2armory-icon';
            icon.setAttribute('data-size', size);
            icon.style.backgroundImage = `url(${skill.icon})`;

            // Add profession-based styling if available
            if (skill.professions && skill.professions.length > 0) {
                icon.setAttribute('data-profession', skill.professions[0].toLowerCase());
            }

            // Add hover events
            icon.addEventListener('mouseenter', () => {
                this.tooltipSystem.show(icon, skill, 'skills');
            });

            icon.addEventListener('mouseleave', () => {
                this.tooltipSystem.hide();
            });

            container.appendChild(icon);

            // Add inline text if requested
            if (inlineText) {
                if (inlineText === 'wiki') {
                    const link = document.createElement('a');
                    link.className = 'gw2armory-link';
                    link.href = `https://wiki.guildwars2.com/wiki/${encodeURIComponent(skill.name)}`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = skill.name;

                    // Add profession theming
                    if (skill.professions && skill.professions.length > 0) {
                        link.setAttribute('data-profession', skill.professions[0].toLowerCase());
                    }

                    container.appendChild(link);
                } else {
                    const text = document.createElement('span');
                    text.textContent = skill.name;

                    // Add profession theming
                    if (skill.professions && skill.professions.length > 0) {
                        text.setAttribute('data-profession', skill.professions[0].toLowerCase());
                    }

                    container.appendChild(text);
                }
            }

            return container;
        }

        /**
         * Render trait embed
         */
        renderTrait(element, trait, options = {}) {
            const size = options.size || 40;
            const inlineText = options.inlineText;

            const container = document.createElement('div');
            container.className = 'gw2armory-embed';

            const icon = document.createElement('div');
            icon.className = 'gw2armory-icon';
            icon.setAttribute('data-size', size);
            icon.style.backgroundImage = `url(${trait.icon})`;

            // Add hover events
            icon.addEventListener('mouseenter', () => {
                this.tooltipSystem.show(icon, trait, 'traits');
            });

            icon.addEventListener('mouseleave', () => {
                this.tooltipSystem.hide();
            });

            container.appendChild(icon);

            // Add inline text if requested
            if (inlineText) {
                if (inlineText === 'wiki') {
                    const link = document.createElement('a');
                    link.className = 'gw2armory-link';
                    link.href = `https://wiki.guildwars2.com/wiki/${encodeURIComponent(trait.name)}`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = trait.name;
                    container.appendChild(link);
                } else {
                    const text = document.createElement('span');
                    text.textContent = trait.name;
                    container.appendChild(text);
                }
            }

            return container;
        }

        /**
         * Render specialization (traitline) embed
         */
        renderSpecialization(element, spec, options = {}) {
            const selectedTraits = options.selectedTraits ?
                options.selectedTraits.split(',').map(t => parseInt(t.trim())) : [];
            const traitData = options.traitData || {};

            const container = document.createElement('div');
            container.className = 'gw2armory-specialization';

            // Create background div
            const backgroundDiv = document.createElement('div');
            backgroundDiv.className = 'gw2armory-spec-background';
            if (spec.background) {
                // Crop to 600x180 from bottom-center using canvas
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Handle CORS
                img.onload = function() {
                    try {
                        // Create canvas to crop the image
                        const cropWidth = 600;
                        const cropHeight = 180;
                        const canvas = document.createElement('canvas');
                        canvas.width = cropWidth;
                        canvas.height = cropHeight;
                        const ctx = canvas.getContext('2d');

                        // Draw the bottom-left 600x180 portion
                        const sourceX = 0;
                        const sourceY = Math.max(0, this.height - cropHeight);
                        const sourceWidth = Math.min(cropWidth, this.width);
                        const sourceHeight = Math.min(cropHeight, this.height);

                        ctx.drawImage(
                            this,
                            sourceX, sourceY, sourceWidth, sourceHeight,  // source rectangle
                            0, 0, cropWidth, cropHeight  // destination rectangle
                        );

                        // Convert to data URL and use as background
                        const croppedImage = canvas.toDataURL('image/png');
                        backgroundDiv.style.backgroundImage = `url(${croppedImage})`;
                        backgroundDiv.style.backgroundSize = 'cover';
                        backgroundDiv.style.backgroundPosition = 'left bottom';
                    } catch (e) {
                        // If canvas fails (CORS or other), fall back to original image
                        console.warn('Failed to crop background:', e);
                        backgroundDiv.style.backgroundImage = `url(${spec.background})`;
                        backgroundDiv.style.backgroundSize = 'cover';
                        backgroundDiv.style.backgroundPosition = 'left bottom';
                    }
                };
                img.onerror = function() {
                    // If image fails to load, just use it directly
                    backgroundDiv.style.backgroundImage = `url(${spec.background})`;
                    backgroundDiv.style.backgroundSize = 'cover';
                    backgroundDiv.style.backgroundPosition = 'left bottom';
                };
                img.src = spec.background;
            }
            container.appendChild(backgroundDiv);

            // Create content wrapper
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'gw2armory-spec-content';
            container.appendChild(contentWrapper);

            // Only render if we have trait data
            if (spec.major_traits && spec.major_traits.length >= 9 && Object.keys(traitData).length > 0) {
                // Spec icon on the left
                const specIcon = document.createElement('div');
                specIcon.className = 'gw2armory-spec-icon';

                const icon = document.createElement('div');
                icon.className = 'gw2armory-icon';
                icon.setAttribute('data-size', '48');
                icon.style.backgroundImage = `url(${spec.icon})`;

                if (spec.profession) {
                    icon.setAttribute('data-profession', spec.profession.toLowerCase());
                }

                specIcon.appendChild(icon);
                contentWrapper.appendChild(specIcon);

                // Traits container - alternating minor/major
                const traitsContainer = document.createElement('div');
                traitsContainer.className = 'gw2armory-traits-container';

                // Group traits into tiers (3 per tier: adept, master, grandmaster)
                const tiers = [
                    { name: 'Adept', major: spec.major_traits.slice(0, 3), minor: spec.minor_traits ? spec.minor_traits[0] : null },
                    { name: 'Master', major: spec.major_traits.slice(3, 6), minor: spec.minor_traits ? spec.minor_traits[1] : null },
                    { name: 'Grandmaster', major: spec.major_traits.slice(6, 9), minor: spec.minor_traits ? spec.minor_traits[2] : null }
                ];

                tiers.forEach((tier, tierIndex) => {
                    // Minor trait first
                    if (tier.minor && traitData[tier.minor]) {
                        const minorTrait = traitData[tier.minor];
                        const minorEl = document.createElement('div');
                        minorEl.className = 'gw2armory-trait-group minor';

                        const minorIcon = document.createElement('div');
                        minorIcon.className = 'gw2armory-icon';
                        minorIcon.setAttribute('data-size', '28');
                        minorIcon.style.backgroundImage = `url(${minorTrait.icon})`;

                        if (spec.profession) {
                            minorIcon.setAttribute('data-profession', spec.profession.toLowerCase());
                        }

                        minorIcon.addEventListener('mouseenter', () => {
                            this.tooltipSystem.show(minorIcon, minorTrait, 'traits');
                        });

                        minorIcon.addEventListener('mouseleave', () => {
                            this.tooltipSystem.hide();
                        });

                        minorEl.appendChild(minorIcon);
                        traitsContainer.appendChild(minorEl);
                    }

                    // Major traits (3 choices) in a column
                    const majorGroup = document.createElement('div');
                    majorGroup.className = 'gw2armory-trait-group major';

                    tier.major.forEach(traitId => {
                        const trait = traitData[traitId];
                        const isSelected = selectedTraits.includes(traitId);

                        const traitEl = document.createElement('div');
                        traitEl.className = isSelected ? 'gw2armory-trait selected' : 'gw2armory-trait';

                        if (trait) {
                            const traitIcon = document.createElement('div');
                            traitIcon.className = 'gw2armory-icon';
                            traitIcon.setAttribute('data-size', '32');
                            traitIcon.style.backgroundImage = `url(${trait.icon})`;

                            if (spec.profession) {
                                traitIcon.setAttribute('data-profession', spec.profession.toLowerCase());
                            }

                            traitIcon.addEventListener('mouseenter', () => {
                                this.tooltipSystem.show(traitIcon, trait, 'traits');
                            });

                            traitIcon.addEventListener('mouseleave', () => {
                                this.tooltipSystem.hide();
                            });

                            traitEl.appendChild(traitIcon);
                        }

                        majorGroup.appendChild(traitEl);
                    });

                    traitsContainer.appendChild(majorGroup);
                });

                contentWrapper.appendChild(traitsContainer);
            } else {
                // Loading state
                const note = document.createElement('div');
                note.style.color = '#888';
                note.style.fontSize = '0.9em';
                note.style.padding = '1rem';
                note.textContent = 'Loading traitline...';
                contentWrapper.appendChild(note);
            }

            return container;
        }

        /**
         * Render build template
         */
        renderBuild(element, buildData, options = {}) {
            const container = document.createElement('div');
            container.className = 'gw2armory-build';

            // Build header - Profession
            const header = document.createElement('div');
            header.className = 'gw2armory-build-header';
            header.setAttribute('data-profession', buildData.profession.toLowerCase());

            const professionName = document.createElement('h3');
            professionName.className = 'gw2armory-build-profession';
            professionName.textContent = buildData.profession;
            header.appendChild(professionName);

            // Add copy button if chat link available
            if (options.chatLink) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'gw2armory-copy-btn';
                copyBtn.textContent = 'Copy Build Code';
                copyBtn.title = 'Click to copy build template to clipboard';

                copyBtn.addEventListener('click', () => {
                    this.copyToClipboard(options.chatLink, copyBtn);
                });

                header.appendChild(copyBtn);
            }

            container.appendChild(header);

            // Specializations section
            if (buildData.specializations && buildData.specializations.length > 0) {
                const specsSection = document.createElement('div');
                specsSection.className = 'gw2armory-build-section';

                const specsTitle = document.createElement('h4');
                specsTitle.textContent = 'Specializations';
                specsSection.appendChild(specsTitle);

                const specsContainer = document.createElement('div');
                specsContainer.className = 'gw2armory-build-specs';

                buildData.specializations.forEach(spec => {
                    // Create a placeholder that will be replaced with actual spec rendering
                    const specPlaceholder = document.createElement('div');
                    specPlaceholder.className = 'gw2armory-build-spec-placeholder';
                    specPlaceholder.setAttribute('data-spec-id', spec.id);
                    specPlaceholder.setAttribute('data-spec-traits', JSON.stringify(spec.traits));
                    specsContainer.appendChild(specPlaceholder);
                });

                specsSection.appendChild(specsContainer);
                container.appendChild(specsSection);
            }

            // Skills section (terrestrial only for now)
            if (buildData.skills && buildData.skills.terrestrial) {
                const skillsSection = document.createElement('div');
                skillsSection.className = 'gw2armory-build-section';

                const skillsTitle = document.createElement('h4');
                skillsTitle.textContent = 'Skills';
                skillsSection.appendChild(skillsTitle);

                const skillBar = document.createElement('div');
                skillBar.className = 'gw2armory-build-skillbar';

                const skillOrder = ['heal', 'utility1', 'utility2', 'utility3', 'elite'];
                skillOrder.forEach(slot => {
                    const skillId = buildData.skills.terrestrial[slot];
                    if (skillId && skillId > 0) {
                        const skillPlaceholder = document.createElement('div');
                        skillPlaceholder.className = 'gw2armory-build-skill-placeholder';
                        skillPlaceholder.setAttribute('data-skill-id', skillId);
                        skillPlaceholder.setAttribute('data-skill-slot', slot);
                        skillBar.appendChild(skillPlaceholder);
                    }
                });

                skillsSection.appendChild(skillBar);
                container.appendChild(skillsSection);
            }

            // Ranger pets section
            if (buildData.professionData && buildData.professionData.pets) {
                const petsSection = document.createElement('div');
                petsSection.className = 'gw2armory-build-section';

                const petsTitle = document.createElement('h4');
                petsTitle.textContent = 'Pets (Terrestrial)';
                petsSection.appendChild(petsTitle);

                const petsContainer = document.createElement('div');
                petsContainer.className = 'gw2armory-build-skillbar';

                buildData.professionData.pets.terrestrial.forEach(petId => {
                    if (petId > 0) {
                        const petData = buildData.petsData ? buildData.petsData[petId] : null;

                        if (petData) {
                            const petIcon = document.createElement('div');
                            petIcon.className = 'gw2armory-icon';
                            petIcon.setAttribute('data-size', '48');
                            petIcon.style.backgroundImage = `url(${petData.icon})`;
                            petIcon.setAttribute('data-profession', 'ranger');
                            petIcon.title = petData.name;

                            petsContainer.appendChild(petIcon);
                        } else {
                            const placeholder = document.createElement('div');
                            placeholder.className = 'gw2armory-icon';
                            placeholder.setAttribute('data-size', '48');
                            placeholder.style.background = '#1a1a1a';
                            placeholder.style.border = '2px dashed #666';
                            placeholder.title = `Pet ${petId}`;
                            petsContainer.appendChild(placeholder);
                        }
                    }
                });

                petsSection.appendChild(petsContainer);
                container.appendChild(petsSection);
            }

            // Revenant legends section
            if (buildData.professionData && buildData.professionData.legends) {
                const legendsSection = document.createElement('div');
                legendsSection.className = 'gw2armory-build-section';

                const legendsTitle = document.createElement('h4');
                legendsTitle.textContent = 'Legends (Terrestrial)';
                legendsSection.appendChild(legendsTitle);

                const legendsContainer = document.createElement('div');
                legendsContainer.className = 'gw2armory-build-skillbar';

                // Terrestrial legends (2 legends)
                const terrestrialLegends = buildData.professionData.legends.terrestrial;
                if (Array.isArray(terrestrialLegends)) {
                    terrestrialLegends.forEach(legend => {
                        if (legend) {
                            const legendIcon = document.createElement('div');
                            legendIcon.className = 'gw2armory-icon';
                            legendIcon.setAttribute('data-size', '48');
                            if (legend.icon) {
                                legendIcon.style.backgroundImage = `url(${legend.icon})`;
                            }
                            legendIcon.setAttribute('data-profession', 'revenant');
                            legendIcon.title = legend.name;

                            legendsContainer.appendChild(legendIcon);
                        }
                    });
                }

                legendsSection.appendChild(legendsContainer);
                container.appendChild(legendsSection);
            }

            return container;
        }

        /**
         * Copy text to clipboard
         */
        copyToClipboard(text, button) {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = '#2d7a2d';

                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '';
                }, 2000);

                this.log('Build code copied to clipboard', 'success');
            }).catch(err => {
                button.textContent = 'Copy failed';
                button.style.background = '#7a2d2d';

                setTimeout(() => {
                    button.textContent = 'Copy Build Code';
                    button.style.background = '';
                }, 2000);

                this.log(`Failed to copy: ${err.message}`, 'error');
            });
        }

        /**
         * Render error state
         */
        renderError(element, errorMessage) {
            const container = document.createElement('div');
            container.className = 'gw2armory-embed';

            const icon = document.createElement('div');
            icon.className = 'gw2armory-icon gw2armory-error';
            icon.setAttribute('data-size', '40');
            icon.style.width = '40px';
            icon.style.height = '40px';
            icon.style.display = 'flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
            icon.style.color = '#f44336';
            icon.style.fontSize = '20px';
            icon.textContent = '⚠';
            icon.title = errorMessage;

            container.appendChild(icon);

            const text = document.createElement('span');
            text.style.color = '#f44336';
            text.style.fontSize = '12px';
            text.textContent = 'Error loading data';

            container.appendChild(text);

            return container;
        }

        /**
         * Render loading state
         */
        renderLoading(size = 40) {
            const container = document.createElement('div');
            container.className = 'gw2armory-embed gw2armory-loading';

            const icon = document.createElement('div');
            icon.className = 'gw2armory-icon';
            icon.setAttribute('data-size', size);
            icon.style.width = `${size}px`;
            icon.style.height = `${size}px`;
            icon.style.background = '#333';
            icon.style.border = '2px solid #666';

            container.appendChild(icon);

            return container;
        }

        /**
         * Logger
         */
        log(message, type = 'info') {
            if (window.GW2Armory && window.GW2Armory.log) {
                window.GW2Armory.log(`[Renderer] ${message}`, type);
            }
        }
    }

    // Export to global scope
    window.Renderer = Renderer;

})(window, document);
