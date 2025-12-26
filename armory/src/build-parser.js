/**
 * GW2 Build Template Parser
 * Parses GW2 build template chat links ([&DQ...=])
 */

(function(window, document) {
    'use strict';

    class BuildParser {
        constructor() {
            this.HEADER_BYTE = 0x0D;

            this.professions = {
                1: 'Guardian',
                2: 'Warrior',
                3: 'Engineer',
                4: 'Ranger',
                5: 'Thief',
                6: 'Elementalist',
                7: 'Mesmer',
                8: 'Necromancer',
                9: 'Revenant'
            };
        }

        /**
         * Parse a build template chat link
         * @param {string} chatLink - Format: [&DQ...=]
         * @returns {Object} Parsed build data
         */
        parse(chatLink) {
            try {
                // Remove brackets and ampersand
                let base64 = chatLink.trim();
                if (base64.startsWith('[&') && base64.endsWith(']')) {
                    base64 = base64.substring(2, base64.length - 1);
                }

                // Decode base64
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Verify header
                if (bytes[0] !== this.HEADER_BYTE) {
                    throw new Error('Invalid build template header');
                }

                // Parse sections
                let offset = 1;

                // Profession (1 byte)
                const professionCode = bytes[offset++];
                const profession = this.professions[professionCode];

                // Specializations (3 × 2 bytes)
                const specializations = [];
                for (let i = 0; i < 3; i++) {
                    const specId = bytes[offset++];
                    const traitByte = bytes[offset++];

                    if (specId > 0) {
                        // Decode trait choices (2 bits each, 3 choices)
                        const traits = [
                            (traitByte & 0x03),       // Adept (bits 0-1)
                            (traitByte >> 2) & 0x03,  // Master (bits 2-3)
                            (traitByte >> 4) & 0x03   // Grandmaster (bits 4-5)
                        ];

                        specializations.push({
                            id: specId,
                            traits: traits // 0=none, 1=top, 2=middle, 3=bottom
                        });
                    }
                }

                // Skills (10 × 2 bytes, little-endian)
                // These are PALETTE IDs, not skill IDs - need to resolve via API
                const skills = {
                    terrestrial: {
                        heal: this.readUInt16LE(bytes, offset),
                        utility1: this.readUInt16LE(bytes, offset + 4),
                        utility2: this.readUInt16LE(bytes, offset + 8),
                        utility3: this.readUInt16LE(bytes, offset + 12),
                        elite: this.readUInt16LE(bytes, offset + 16)
                    },
                    aquatic: {
                        heal: this.readUInt16LE(bytes, offset + 2),
                        utility1: this.readUInt16LE(bytes, offset + 6),
                        utility2: this.readUInt16LE(bytes, offset + 10),
                        utility3: this.readUInt16LE(bytes, offset + 14),
                        elite: this.readUInt16LE(bytes, offset + 18)
                    },
                    isPalette: true // Flag to indicate these need resolution
                };
                offset += 20;

                // Profession-specific data (16 bytes)
                const professionData = {};

                if (profession === 'Ranger') {
                    // Ranger pets (4 bytes)
                    professionData.pets = {
                        terrestrial: [bytes[offset], bytes[offset + 1]],
                        aquatic: [bytes[offset + 2], bytes[offset + 3]]
                    };
                } else if (profession === 'Revenant') {
                    // Revenant legends (4 bytes: 2 terrestrial + 2 aquatic + 12 bytes inactive skills)
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

                    professionData.legends = {
                        terrestrial: [
                            legendInfo[bytes[offset]] || { name: `Unknown (${bytes[offset]})`, icon: null },
                            legendInfo[bytes[offset + 1]] || { name: `Unknown (${bytes[offset + 1]})`, icon: null }
                        ],
                        aquatic: [
                            legendInfo[bytes[offset + 2]] || { name: `Unknown (${bytes[offset + 2]})`, icon: null },
                            legendInfo[bytes[offset + 3]] || { name: `Unknown (${bytes[offset + 3]})`, icon: null }
                        ]
                    };
                    // Inactive legend skills (6 × 2 bytes) - these are also palette IDs
                    professionData.inactiveSkills = [];
                    for (let i = 0; i < 6; i++) {
                        professionData.inactiveSkills.push(
                            this.readUInt16LE(bytes, offset + 4 + (i * 2))
                        );
                    }
                }
                offset += 16;

                // Extended data (if available)
                let weapons = [];
                let skillVariants = {};

                if (offset < bytes.length) {
                    // Weapons array
                    const weaponCount = bytes[offset++];
                    for (let i = 0; i < weaponCount; i++) {
                        weapons.push(this.readUInt16LE(bytes, offset));
                        offset += 2;
                    }

                    // Skill variants (if available)
                    if (offset < bytes.length) {
                        const variantCount = bytes[offset++];
                        for (let i = 0; i < variantCount; i++) {
                            const skillId = this.readUInt32LE(bytes, offset);
                            offset += 4;
                            skillVariants[i] = skillId;
                        }
                    }
                }

                return {
                    profession: profession,
                    professionCode: professionCode,
                    specializations: specializations,
                    skills: skills,
                    professionData: professionData,
                    weapons: weapons,
                    skillVariants: skillVariants
                };

            } catch (error) {
                throw new Error(`Failed to parse build template: ${error.message}`);
            }
        }

        /**
         * Read 16-bit unsigned integer (little-endian)
         */
        readUInt16LE(bytes, offset) {
            return bytes[offset] | (bytes[offset + 1] << 8);
        }

        /**
         * Read 32-bit unsigned integer (little-endian)
         */
        readUInt32LE(bytes, offset) {
            return bytes[offset] |
                   (bytes[offset + 1] << 8) |
                   (bytes[offset + 2] << 16) |
                   (bytes[offset + 3] << 24);
        }

        /**
         * Convert trait position (1-3) to trait IDs from specialization data
         * @param {Object} specData - Specialization data from API
         * @param {Array} choices - [1-3, 1-3, 1-3] for adept/master/grandmaster
         * @returns {Array} Array of selected trait IDs
         */
        getSelectedTraitIds(specData, choices) {
            const selectedIds = [];

            if (!specData || !specData.major_traits || !choices) {
                return selectedIds;
            }

            const tiers = [
                specData.major_traits.slice(0, 3),  // Adept
                specData.major_traits.slice(3, 6),  // Master
                specData.major_traits.slice(6, 9)   // Grandmaster
            ];

            choices.forEach((choice, tierIndex) => {
                if (choice > 0 && choice <= 3) {
                    const traitIndex = choice - 1; // Convert 1-3 to 0-2
                    selectedIds.push(tiers[tierIndex][traitIndex]);
                }
            });

            return selectedIds;
        }

        /**
         * Logger
         */
        log(message, type = 'info') {
            if (window.GW2Armory && window.GW2Armory.log) {
                window.GW2Armory.log(`[BuildParser] ${message}`, type);
            }
        }
    }

    // Export to global scope
    window.BuildParser = BuildParser;

})(window, document);
