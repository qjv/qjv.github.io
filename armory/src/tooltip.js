/**
 * GW2 Armory Embeds - Tooltip System
 * Handles tooltip creation, positioning, and display
 */

(function(window, document) {
    'use strict';

    class TooltipSystem {
        constructor(config) {
            this.config = config;
            this.tooltip = null;
            this.showTimeout = null;
            this.hideTimeout = null;
            this.currentElement = null;
            this.init();
        }

        /**
         * Initialize tooltip element
         */
        init() {
            // Create tooltip container
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'gw2armory-tooltip';
            document.body.appendChild(this.tooltip);

            // Handle mouse leaving tooltip
            this.tooltip.addEventListener('mouseenter', () => {
                clearTimeout(this.hideTimeout);
            });

            this.tooltip.addEventListener('mouseleave', () => {
                this.hide();
            });

            this.log('Tooltip system initialized');
        }

        /**
         * Show tooltip for an element
         */
        show(element, data, type) {
            clearTimeout(this.showTimeout);
            clearTimeout(this.hideTimeout);

            this.showTimeout = setTimeout(() => {
                this.currentElement = element;
                this.render(data, type);
                this.position(element);
                this.tooltip.classList.add('visible');
            }, this.config.tooltip.delay);
        }

        /**
         * Hide tooltip
         */
        hide() {
            clearTimeout(this.showTimeout);
            this.hideTimeout = setTimeout(() => {
                this.tooltip.classList.remove('visible');
                this.currentElement = null;
            }, 100);
        }

        /**
         * Render tooltip content based on data type
         */
        render(data, type) {
            let content = '';

            switch (type) {
                case 'items':
                    content = this.renderItem(data);
                    break;
                case 'skills':
                    content = this.renderSkill(data);
                    break;
                case 'traits':
                    content = this.renderTrait(data);
                    break;
                case 'specializations':
                    content = this.renderSpecialization(data);
                    break;
                default:
                    content = this.renderGeneric(data);
            }

            this.tooltip.innerHTML = content;
        }

        /**
         * Render item tooltip
         */
        renderItem(item) {
            let html = `<div class="gw2armory-tooltip-header" style="color: ${this.getRarityColor(item.rarity)}">${item.name}</div>`;

            // Type and rarity
            html += `<div class="gw2armory-tooltip-type">${item.type} • ${item.rarity}</div>`;

            // Description
            if (item.description) {
                html += `<div class="gw2armory-tooltip-description">${this.formatDescription(item.description)}</div>`;
            }

            // Stats (if weapon or armor)
            if (item.details) {
                html += this.renderItemStats(item);
            }

            // Level requirement
            if (item.level && item.level > 0) {
                html += `<div style="color: #999; margin-top: 0.5rem; font-size: 0.9em;">Required Level: ${item.level}</div>`;
            }

            // Item ID
            if (item.id) {
                html += `<div style="color: #666; margin-top: 0.5rem; font-size: 0.85em; border-top: 1px solid #333; padding-top: 0.5rem;">ID: ${item.id}</div>`;
            }

            return html;
        }

        /**
         * Render item stats
         */
        renderItemStats(item) {
            let html = '<div class="gw2armory-tooltip-stats">';

            const details = item.details;

            // Weapon stats
            if (details.type && details.min_power) {
                html += `<div class="gw2armory-tooltip-stat">
                    <span>Weapon Strength</span>
                    <span class="gw2armory-tooltip-stat-value">${details.min_power} - ${details.max_power}</span>
                </div>`;
            }

            // Defense
            if (details.defense) {
                html += `<div class="gw2armory-tooltip-stat">
                    <span>Defense</span>
                    <span class="gw2armory-tooltip-stat-value">${details.defense}</span>
                </div>`;
            }

            // Attributes from infix upgrade
            if (details.infix_upgrade && details.infix_upgrade.attributes) {
                details.infix_upgrade.attributes.forEach(attr => {
                    html += `<div class="gw2armory-tooltip-stat">
                        <span>+${attr.attribute.replace('_', ' ')}</span>
                        <span class="gw2armory-tooltip-stat-value">${attr.modifier}</span>
                    </div>`;
                });
            }

            html += '</div>';
            return html;
        }

        /**
         * Render skill tooltip
         */
        renderSkill(skill) {
            let html = `<div class="gw2armory-tooltip-header">${skill.name}</div>`;

            // Type and professions
            let typeInfo = [];
            if (skill.professions && skill.professions.length > 0) {
                typeInfo.push(skill.professions.join(', '));
            }
            if (skill.type) {
                typeInfo.push(skill.type);
            }
            if (skill.weapon_type && skill.weapon_type !== 'None') {
                typeInfo.push(skill.weapon_type);
            }
            if (typeInfo.length > 0) {
                html += `<div class="gw2armory-tooltip-type">${typeInfo.join(' • ')}</div>`;
            }

            // Slot (Elite, Utility, Weapon, etc.) and special costs
            let slotInfo = [];
            if (skill.slot && skill.slot !== 'Weapon_1') {
                slotInfo.push(skill.slot.replace(/_/g, ' '));
            }
            if (skill.initiative !== undefined) {
                slotInfo.push(`Initiative: ${skill.initiative}`);
            }
            if (skill.cost !== undefined) {
                slotInfo.push(`Energy: ${skill.cost}`);
            }
            if (slotInfo.length > 0) {
                html += `<div class="gw2armory-tooltip-slot">${slotInfo.join(' • ')}</div>`;
            }

            // Description
            if (skill.description) {
                html += `<div class="gw2armory-tooltip-description">${this.formatDescription(skill.description)}</div>`;
            }

            // Facts with icons
            if (skill.facts && skill.facts.length > 0) {
                html += '<div class="gw2armory-tooltip-stats">';
                skill.facts.forEach(fact => {
                    html += this.renderFact(fact);
                });
                html += '</div>';
            }

            // Traited facts
            if (skill.traited_facts && skill.traited_facts.length > 0) {
                html += '<div class="gw2armory-tooltip-section">';
                html += '<div class="gw2armory-tooltip-section-title">With Traits:</div>';
                html += '<div class="gw2armory-tooltip-stats">';
                skill.traited_facts.forEach(fact => {
                    html += this.renderFact(fact);
                });
                html += '</div></div>';
            }

            // Flags (Ground targeting, No underwater, etc.)
            if (skill.flags && skill.flags.length > 0) {
                const flagNames = skill.flags.map(flag => flag.replace(/_/g, ' '));
                html += `<div class="gw2armory-tooltip-flags">${flagNames.join(', ')}</div>`;
            }

            // Categories
            if (skill.categories && skill.categories.length > 0) {
                html += `<div class="gw2armory-tooltip-categories">Categories: ${skill.categories.join(', ')}</div>`;
            }

            // Skill ID
            if (skill.id) {
                html += `<div style="color: #666; margin-top: 0.5rem; font-size: 0.85em; border-top: 1px solid #333; padding-top: 0.5rem;">ID: ${skill.id}</div>`;
            }

            return html;
        }

        /**
         * Render trait tooltip
         */
        renderTrait(trait) {
            let html = `<div class="gw2armory-tooltip-header">${trait.name}</div>`;

            // Tier and slot info
            let tierInfo = [];
            if (trait.tier) {
                const tierNames = { 1: 'Adept', 2: 'Master', 3: 'Grandmaster' };
                tierInfo.push(tierNames[trait.tier] || `Tier ${trait.tier}`);
            }
            if (trait.slot) {
                tierInfo.push(trait.slot);
            }
            if (tierInfo.length > 0) {
                html += `<div class="gw2armory-tooltip-type">${tierInfo.join(' • ')}</div>`;
            }

            // Description
            if (trait.description) {
                html += `<div class="gw2armory-tooltip-description">${this.formatDescription(trait.description)}</div>`;
            }

            // Facts with icons
            if (trait.facts && trait.facts.length > 0) {
                html += '<div class="gw2armory-tooltip-stats">';
                trait.facts.forEach(fact => {
                    html += this.renderFact(fact);
                });
                html += '</div>';
            }

            // Traited facts (facts that change when trait is selected)
            if (trait.traited_facts && trait.traited_facts.length > 0) {
                html += '<div class="gw2armory-tooltip-section">';
                html += '<div class="gw2armory-tooltip-section-title">With Trait:</div>';
                html += '<div class="gw2armory-tooltip-stats">';
                trait.traited_facts.forEach(fact => {
                    html += this.renderFact(fact);
                });
                html += '</div></div>';
            }

            // Trait ID
            if (trait.id) {
                html += `<div style="color: #666; margin-top: 0.5rem; font-size: 0.85em; border-top: 1px solid #333; padding-top: 0.5rem;">ID: ${trait.id}</div>`;
            }

            return html;
        }

        /**
         * Render specialization tooltip
         */
        renderSpecialization(spec) {
            let html = `<div class="gw2armory-tooltip-header">${spec.name}</div>`;

            if (spec.profession) {
                html += `<div class="gw2armory-tooltip-type">${spec.profession} Specialization</div>`;
            }

            // Specialization ID
            if (spec.id) {
                html += `<div style="color: #666; margin-top: 0.5rem; font-size: 0.85em; border-top: 1px solid #333; padding-top: 0.5rem;">ID: ${spec.id}</div>`;
            }

            return html;
        }

        /**
         * Render generic tooltip
         */
        renderGeneric(data) {
            return `<div class="gw2armory-tooltip-header">${data.name || 'Unknown'}</div>
                    <div class="gw2armory-tooltip-type">ID: ${data.id}</div>`;
        }

        /**
         * Position tooltip relative to element
         */
        position(element) {
            const rect = element.getBoundingClientRect();
            const offset = this.config.tooltip.offset;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Reset max-height to allow tooltip to size naturally first
            this.tooltip.style.maxHeight = '';
            const tooltipRect = this.tooltip.getBoundingClientRect();

            // Calculate available space above and below element
            const spaceBelow = viewportHeight - rect.bottom - offset;
            const spaceAbove = rect.top - offset;

            let top = rect.bottom + offset;
            let maxHeight = null;

            // Determine if tooltip should go below or above
            if (spaceBelow >= tooltipRect.height) {
                // Fits below - use default position
                top = rect.bottom + offset;
                maxHeight = spaceBelow;
            } else if (spaceAbove >= tooltipRect.height) {
                // Fits above - position above element
                top = rect.top - tooltipRect.height - offset;
                maxHeight = spaceAbove;
            } else {
                // Doesn't fit either way - use the larger space
                if (spaceBelow > spaceAbove) {
                    top = rect.bottom + offset;
                    maxHeight = spaceBelow;
                } else {
                    top = offset;
                    maxHeight = spaceAbove;
                }
            }

            // Ensure top is within viewport
            if (top < offset) {
                top = offset;
                maxHeight = viewportHeight - (offset * 2);
            }

            // Set max-height if tooltip is taller than available space
            if (maxHeight && tooltipRect.height > maxHeight) {
                this.tooltip.style.maxHeight = `${maxHeight}px`;
            }

            // Calculate horizontal position
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

            // Adjust if tooltip would go off right edge
            if (left + tooltipRect.width > viewportWidth - offset) {
                left = viewportWidth - tooltipRect.width - offset;
            }

            // Adjust if tooltip would go off left edge
            if (left < offset) {
                left = offset;
            }

            this.tooltip.style.top = `${top}px`;
            this.tooltip.style.left = `${left}px`;
        }

        /**
         * Format description text (handle HTML entities)
         */
        formatDescription(text) {
            if (!text) return '';
            // Remove <c=@...> color tags but keep the content
            return text
                .replace(/<c=@[^>]+>/g, '<span style="color: inherit;">')
                .replace(/<\/c>/g, '</span>')
                .replace(/\n/g, '<br>');
        }

        /**
         * Render a single fact with icon
         */
        renderFact(fact) {
            if (!fact.text && !fact.type) return '';

            const icon = this.getFactIcon(fact);
            const value = this.formatFactValue(fact);

            // Prefer status name over generic "Apply Buff/Condition" text
            let text;
            if (fact.status) {
                // Use the status name (e.g., "Might", "Quickness", "Bleeding")
                text = fact.status;
            } else if (fact.type === 'ComboFinisher' && fact.finisher_type) {
                text = `Combo Finisher: ${fact.finisher_type}`;
            } else if (fact.type === 'ComboField' && fact.field_type) {
                text = `Combo Field: ${fact.field_type}`;
            } else if (fact.type === 'PrefixedBuff' && fact.prefix && fact.prefix.text) {
                text = fact.prefix.text;
            } else if (fact.type === 'BuffConversion' && fact.source && fact.target) {
                text = `Gain ${fact.target} based on ${fact.source}`;
            } else {
                text = fact.text || this.getFactTypeLabel(fact.type);
            }

            let html = '<div class="gw2armory-tooltip-stat">';

            // Icon
            if (icon) {
                html += `<img src="${icon}" alt="" class="gw2armory-fact-icon">`;
            }

            // Text
            html += `<span class="gw2armory-fact-text">${text}</span>`;

            // Value
            if (value !== null && value !== undefined && value !== '') {
                html += `<span class="gw2armory-tooltip-stat-value">${value}</span>`;
            }

            html += '</div>';

            // Add description for boons/conditions/effects
            if (fact.description && fact.status) {
                html += `<div class="gw2armory-tooltip-stat-desc">${fact.description}</div>`;
            }

            return html;
        }

        /**
         * Get icon URL for a fact
         */
        getFactIcon(fact) {
            // Icon is provided directly in fact
            if (fact.icon) {
                return fact.icon;
            }

            // PrefixedBuff - use the prefix icon
            if (fact.type === 'PrefixedBuff' && fact.prefix && fact.prefix.icon) {
                return fact.prefix.icon;
            }

            // Map fact types to GW2 render URLs
            const iconMap = {
                // Boons
                'Aegis': 'https://render.guildwars2.com/file/DFB4D600AEFA470164F892DE0B27CF6759F0D0F9/102854.png',
                'Alacrity': 'https://render.guildwars2.com/file/4FFB6DA0A867CADD0A3D9FB5D0BC17BD41C891C5/1938787.png',
                'Fury': 'https://render.guildwars2.com/file/96D90DF84CAFE008233DD1C480E31B0FFE537E7B/102842.png',
                'Might': 'https://render.guildwars2.com/file/2FA9DF9D6BC17839BBEA14723F1C53D645DDB5E1/102852.png',
                'Protection': 'https://render.guildwars2.com/file/CD77D1FAB7B270223538A8F8ECDA1CFB044D65F4/102834.png',
                'Quickness': 'https://render.guildwars2.com/file/2FBCC0D037B258C4EB6A8DD1FDF4E6C1B8FE2EAF/1012835.png',
                'Regeneration': 'https://render.guildwars2.com/file/F69996772B9E18FD18AD0AABCC60D1AA5E24C33F/102835.png',
                'Resistance': 'https://render.guildwars2.com/file/50BAC1B8E10CFAB9E749337442B1B7FF9A6D7937/961398.png',
                'Resolution': 'https://render.guildwars2.com/file/B47E5E1CBEE8D3D72A5D7FE2E0B1FE3FB9A1B29A/2440717.png',
                'Retaliation': 'https://render.guildwars2.com/file/A0289035491A1F8BE3C4833C2D616F433B34C3F6/102837.png',
                'Stability': 'https://render.guildwars2.com/file/3D3A1C0D6D791C05085C6E53C4A0000CF56F1D37/102853.png',
                'Swiftness': 'https://render.guildwars2.com/file/20CFC14967E67F7A3FD4A4B8722B4CF5B8565E11/102836.png',
                'Vigor': 'https://render.guildwars2.com/file/58E92EBAF0DB4DA7C4AC04D9B22BCA5ECF0100DE/102843.png',

                // Conditions
                'Bleeding': 'https://render.guildwars2.com/file/79FF0046A5F9ADA3B4C4EC19ADB4CB124D5F0021/102848.png',
                'Blind': 'https://render.guildwars2.com/file/09770136BB76FD0DBE1CC4267DEED54774CB20F6/102837.png',
                'Burning': 'https://render.guildwars2.com/file/B47BF5803FED2718D7474EAF9617629AD068EE10/102849.png',
                'Chilled': 'https://render.guildwars2.com/file/28C4EC547A3516AE9B22C4119E4B8E1C1FCAB5A3/102840.png',
                'Confusion': 'https://render.guildwars2.com/file/289AA0A4644B8E7E99B9444CFCA74F0FA0BCE4D8/102880.png',
                'Crippled': 'https://render.guildwars2.com/file/070325E519C1AC114921CB4A3EAC9E3F85FA4C3E/102838.png',
                'Fear': 'https://render.guildwars2.com/file/30307019056C05161A35E2A00A5A63C31686B6EA/102847.png',
                'Immobile': 'https://render.guildwars2.com/file/397A613F3C6173EEA8AF24F815FF6E9584952D5F/102844.png',
                'Poison': 'https://render.guildwars2.com/file/559B0AF9FB5E1243D2649FAAE660CCB338AACC19/102840.png',
                'Slow': 'https://render.guildwars2.com/file/F60D1EF5271D7B9319610855676D320CD25F01C6/961397.png',
                'Taunt': 'https://render.guildwars2.com/file/02EED459AD65FAF7DF32A260E479C625070841B9/1228472.png',
                'Torment': 'https://render.guildwars2.com/file/10BABF2708CA3575730AC662A2E72EC292565B08/598887.png',
                'Vulnerability': 'https://render.guildwars2.com/file/3A394C1A0A3257EB27A44842DDEEF0DF000E1241/102850.png',
                'Weakness': 'https://render.guildwars2.com/file/6CB0E64AF9AA292E332A38C1770CE577E2CDE0E8/102853.png',

                // Control Effects
                'Daze': 'https://render.guildwars2.com/file/9AE125E930C92FEA0DD99E7EBAEDE4CF5EC556B6/433474.png',
                'Float': 'https://render.guildwars2.com/file/7C3A1F2F67E0B4536A8C0B97C3E9EA35DCCE85A3/156659.png',
                'Knockback': 'https://render.guildwars2.com/file/72FB6F220AA5C0D477C82C666FD6704E4A94D703/433474.png',
                'Knockdown': 'https://render.guildwars2.com/file/FA5E3B78C0C506FE4A59BD3BC234C648B41F7C2C/433474.png',
                'Launch': 'https://render.guildwars2.com/file/6ECB861BAB3209E6159F9C75BCB1D85D3256BE16/433474.png',
                'Pull': 'https://render.guildwars2.com/file/8C7E69A6C46505CDFB2DB167E0E5C8CF78E127C4/433474.png',
                'Stun': 'https://render.guildwars2.com/file/EA7E4BBD21B7A3C6AA180A8D9E6630F5757E7C13/522727.png',

                // Other
                'Stealth': 'https://render.guildwars2.com/file/79D36142E9DEF434A70E9C3FBE60C0DCC9B972B0/102848.png',
                'Superspeed': 'https://render.guildwars2.com/file/B8994710EF5F4E6024027C4883D09E6AA5E59A84/1012835.png',
                'Barrier': 'https://render.guildwars2.com/file/57FBF46ADF3DECBB6BF0C8DCA1F4D35BAB7BC22F/1770208.png'
            };

            // Check if fact has a status
            if (fact.status) {
                return iconMap[fact.status] || null;
            }

            // Check fact text for boon/condition names
            if (fact.text) {
                for (const [key, url] of Object.entries(iconMap)) {
                    if (fact.text.includes(key)) {
                        return url;
                    }
                }
            }

            return null;
        }

        /**
         * Get readable label for fact type
         */
        getFactTypeLabel(type) {
            const labels = {
                'Recharge': 'Cooldown',
                'Distance': 'Range',
                'Radius': 'Radius',
                'Duration': 'Duration',
                'Number': 'Number of Targets',
                'Percent': 'Percent',
                'Time': 'Cast Time',
                'Damage': 'Damage',
                'Buff': 'Buff',
                'AttributeAdjust': 'Attribute Bonus',
                'ComboField': 'Combo Field',
                'ComboFinisher': 'Combo Finisher',
                'NoData': '',
                'PrefixedBuff': 'Buff',
                'BuffConversion': 'Converts',
                'Heal': 'Healing',
                'HealingAdjust': 'Healing Power',
                'Range': 'Range',
                'Unblockable': 'Unblockable',
                'StunBreak': 'Breaks Stun'
            };
            return labels[type] || type;
        }

        /**
         * Format fact value
         */
        formatFactValue(fact) {
            // Recharge/Cooldown
            if (fact.type === 'Recharge' && fact.value !== undefined) {
                return `${fact.value}s`;
            }

            // Distance/Range/Radius
            if ((fact.type === 'Distance' || fact.type === 'Radius' || fact.type === 'Range') && fact.distance !== undefined) {
                return fact.distance;
            }

            // Duration (for buffs/conditions)
            if (fact.duration !== undefined) {
                return `${fact.duration}s`;
            }

            // Percent
            if (fact.percent !== undefined) {
                return `${fact.percent}%`;
            }

            // Damage/Healing with hit count
            if ((fact.type === 'Damage' || fact.type === 'Heal') && fact.hit_count !== undefined) {
                return `${fact.hit_count}×`;
            }

            // Apply count (for stacking boons/conditions)
            if (fact.apply_count !== undefined && fact.apply_count > 1) {
                return `(${fact.apply_count})`;
            }

            // Combo finisher percent
            if (fact.type === 'ComboFinisher' && fact.percent !== undefined) {
                return `${fact.percent}%`;
            }

            // Buff conversion
            if (fact.type === 'BuffConversion') {
                if (fact.source && fact.target && fact.percent) {
                    return `${fact.percent}% ${fact.source} → ${fact.target}`;
                }
            }

            // Attribute adjust
            if (fact.type === 'AttributeAdjust' && fact.value !== undefined) {
                return `+${fact.value}`;
            }

            // Stun break
            if (fact.type === 'StunBreak') {
                return 'Yes';
            }

            // Unblockable
            if (fact.type === 'Unblockable') {
                return 'Yes';
            }

            // Generic value
            if (fact.value !== undefined) {
                return fact.value;
            }

            return '';
        }

        /**
         * Get color for rarity
         */
        getRarityColor(rarity) {
            const colors = {
                'Junk': '#aaa',
                'Basic': '#fff',
                'Common': '#fff',
                'Fine': '#62a4da',
                'Masterwork': '#1a9306',
                'Rare': '#fcd00b',
                'Exotic': '#ffa405',
                'Ascended': '#fb3e8d',
                'Legendary': '#4c139d'
            };
            return colors[rarity] || '#fff';
        }

        /**
         * Logger
         */
        log(message, type = 'info') {
            if (window.GW2Armory && window.GW2Armory.log) {
                window.GW2Armory.log(`[Tooltip] ${message}`, type);
            }
        }
    }

    // Export to global scope
    window.TooltipSystem = TooltipSystem;

})(window, document);
