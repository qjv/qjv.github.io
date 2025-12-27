/**
 * GW2 Build Template Encoder
 * Encodes build data to GW2 build template chat links ([&DQ...=])
 */

(function(window, document) {
    'use strict';

    class BuildEncoder {
        constructor() {
            this.HEADER_BYTE = 0x0D;
        }

        /**
         * Encode build data to chat link format
         * @param {Object} buildData - Build configuration
         * @returns {string} Chat link format: [&DQ...=]
         */
        encode(buildData) {
            const bytes = [];

            // Header byte
            bytes.push(this.HEADER_BYTE);

            // Profession (1 byte)
            bytes.push(buildData.professionCode || 0);

            // Specializations (3 × 2 bytes)
            for (let i = 0; i < 3; i++) {
                const spec = buildData.specializations[i];
                if (spec && spec.id) {
                    bytes.push(spec.id);
                    // Encode trait choices (2 bits each, 3 choices)
                    const traitByte =
                        (spec.traits[0] || 0) |
                        ((spec.traits[1] || 0) << 2) |
                        ((spec.traits[2] || 0) << 4);
                    bytes.push(traitByte);
                } else {
                    bytes.push(0, 0);
                }
            }

            // Skills (10 × 2 bytes, little-endian)
            // Order: terr heal, aqua heal, terr util1, aqua util1, ..., terr elite, aqua elite
            const terrestrial = buildData.skills.terrestrial || {};
            const aquatic = buildData.skills.aquatic || {};

            this.writeUInt16LE(bytes, terrestrial.heal || 0);
            this.writeUInt16LE(bytes, aquatic.heal || 0);
            this.writeUInt16LE(bytes, terrestrial.utility1 || 0);
            this.writeUInt16LE(bytes, aquatic.utility1 || 0);
            this.writeUInt16LE(bytes, terrestrial.utility2 || 0);
            this.writeUInt16LE(bytes, aquatic.utility2 || 0);
            this.writeUInt16LE(bytes, terrestrial.utility3 || 0);
            this.writeUInt16LE(bytes, aquatic.utility3 || 0);
            this.writeUInt16LE(bytes, terrestrial.elite || 0);
            this.writeUInt16LE(bytes, aquatic.elite || 0);

            // Profession-specific data (16 bytes)
            const professionData = buildData.professionData || {};

            if (buildData.profession === 'Ranger') {
                // Ranger pets (4 bytes)
                const pets = professionData.pets || {};
                bytes.push((pets.terrestrial && pets.terrestrial[0]) || 0);
                bytes.push((pets.terrestrial && pets.terrestrial[1]) || 0);
                bytes.push((pets.aquatic && pets.aquatic[0]) || 0);
                bytes.push((pets.aquatic && pets.aquatic[1]) || 0);
                // Padding (12 bytes)
                for (let i = 0; i < 12; i++) {
                    bytes.push(0);
                }
            } else if (buildData.profession === 'Revenant') {
                // Revenant legends (4 bytes)
                const legends = professionData.legends || {};

                // Helper to extract legend code from either number or object format
                const getLegendCode = (legend) => {
                    if (typeof legend === 'number') return legend;
                    if (typeof legend === 'object' && legend !== null) {
                        // Try to extract from object - look for known legend names
                        const legendMap = {
                            'Dragon': 1, 'Assassin': 2, 'Dwarf': 3, 'Demon': 4,
                            'Renegade': 5, 'Centaur': 6, 'Alliance': 7, 'Entity': 8
                        };
                        return legendMap[legend.name] || 0;
                    }
                    return 0;
                };

                bytes.push(getLegendCode(legends.terrestrial && legends.terrestrial[0]));
                bytes.push(getLegendCode(legends.terrestrial && legends.terrestrial[1]));
                bytes.push(getLegendCode(legends.aquatic && legends.aquatic[0]));
                bytes.push(getLegendCode(legends.aquatic && legends.aquatic[1]));
                // Inactive legend skills (6 × 2 bytes)
                const inactiveSkills = professionData.inactiveSkills || [];
                for (let i = 0; i < 6; i++) {
                    this.writeUInt16LE(bytes, inactiveSkills[i] || 0);
                }
            } else {
                // Other professions - 16 bytes of padding
                for (let i = 0; i < 16; i++) {
                    bytes.push(0);
                }
            }

            // Optional: Weapons array
            if (buildData.weapons && buildData.weapons.length > 0) {
                bytes.push(buildData.weapons.length);
                buildData.weapons.forEach(weapon => {
                    this.writeUInt16LE(bytes, weapon);
                });
            }

            // Convert to base64
            const uint8Array = new Uint8Array(bytes);
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binaryString);

            // Wrap in chat link format
            return `[&${base64}]`;
        }

        /**
         * Write 16-bit unsigned integer (little-endian)
         */
        writeUInt16LE(bytes, value) {
            bytes.push(value & 0xFF);
            bytes.push((value >> 8) & 0xFF);
        }

        /**
         * Write 32-bit unsigned integer (little-endian)
         */
        writeUInt32LE(bytes, value) {
            bytes.push(value & 0xFF);
            bytes.push((value >> 8) & 0xFF);
            bytes.push((value >> 16) & 0xFF);
            bytes.push((value >> 24) & 0xFF);
        }

        /**
         * Logger
         */
        log(message, type = 'info') {
            if (window.GW2Armory && window.GW2Armory.log) {
                window.GW2Armory.log(`[BuildEncoder] ${message}`, type);
            }
        }
    }

    // Export to global scope
    window.BuildEncoder = BuildEncoder;

})(window, document);
