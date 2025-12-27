/**
 * GW2 Skill Palette ID to Skill ID Mapping
 * Data sourced from: https://wiki.guildwars2.com/wiki/Chat_link_format/skill_palette_table
 *
 * This is a static mapping since the GW2 API doesn't provide easy access to palette mappings
 * and CORS prevents us from scraping the wiki directly.
 *
 * Format: paletteId -> skillId (terrestrial version)
 * Note: Some palette IDs map to multiple skills (terrestrial/aquatic variants)
 */

(function(window) {
    'use strict';

    // This is a partial mapping - will need to be expanded
    // Generated from wiki data: https://wiki.guildwars2.com/index.php?title=Chat_link_format/skill_palette_table&action=edit
    window.GW2_PALETTE_MAPPING = {
        // Common/Racial skills
        1: 12343,   // Artillery Barrage (Charr)

        // Warrior
        10: 14354,  // Throw Bolas
        112: 14389, // Healing Signet
        156: 14355, // Signet of Rage

        // Guardian
        254: 9093,  // Bane Signet
        312: 9158,  // Signet of Resolve
        326: 9150,  // Signet of Judgment
        4721: 30461, // Signet of Courage

        // Engineer
        134: 5805,  // Grenade Kit

        // Ranger
        // (Add ranger skills here)

        // Thief
        // (Add thief skills here)

        // Elementalist
        116: 5503,  // Signet of Restoration
        203: 5542,  // Signet of Fire

        // Mesmer
        384: 10236, // Signet of Inspiration
        410: 10245, // Mass Invisibility

        // Necromancer
        18: 10527,  // Well of Blood

        // Revenant
        // (Add revenant skills here)
    };

    // Export a function to resolve palette IDs
    window.resolvePaletteId = function(paletteId) {
        return window.GW2_PALETTE_MAPPING[paletteId] || null;
    };

})(window);
