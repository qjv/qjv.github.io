# GW2 Armory Embeds - Reimplementation Plan

## Project Overview

Recreate the armory-embeds library from scratch with:
- ✅ Simple, clean tooltips
- ✅ Modern, maintainable code
- ✅ No external dependencies (vanilla JS)
- ✅ Security-focused (no malicious links)
- ✅ Better performance
- ✅ Self-hosted GW2 data

## Current Library Analysis

### What It Does
- Embeds GW2 items, skills, traits, specializations, and amulets into web pages
- Shows tooltips on hover with game data
- Fetches data from GW2 API
- Caches data in localStorage
- Supports customization via data attributes

### Issues with Current Implementation
- ❌ Outdated (last update years ago)
- ❌ Links to potentially malicious sites
- ❌ Heavy webpack bundle
- ❌ External CDN dependency
- ❌ Limited customization
- ❌ No TypeScript/modern tooling

---

## Architecture Design

### Core Components

#### 1. **Data Fetcher** (`data-fetcher.js`)
- Fetch data from GW2 API v2
- Cache management (localStorage)
- Batch requests for performance
- Error handling

**API Endpoints:**
```
https://api.guildwars2.com/v2/items?ids=1,2,3
https://api.guildwars2.com/v2/skills?ids=1,2,3
https://api.guildwars2.com/v2/traits?ids=1,2,3
https://api.guildwars2.com/v2/specializations?ids=1,2,3
https://api.guildwars2.com/v2/pvp/amulets?ids=1,2,3
```

#### 2. **Embed Scanner** (`scanner.js`)
- Scan DOM for `[data-armory-embed]` elements
- Parse data attributes
- Initialize embeds
- MutationObserver for dynamic content

#### 3. **Tooltip System** (`tooltip.js`)
- Create tooltip element
- Position calculation (avoid viewport edges)
- Show/hide on hover
- Format tooltip content with game data
- Rarity-based styling

#### 4. **Renderer** (`renderer.js`)
- Render embed elements with icons
- Create clickable links
- Apply styles based on rarity
- Support inline vs block display

#### 5. **Main Entry** (`armory.js`)
- Initialize library
- Configuration management
- Public API
- Event coordination

---

## Supported Embeds

### 1. Items
**Attributes:**
- `data-armory-embed="items"`
- `data-armory-ids="12345,67890"`
- `data-armory-size="32"` (icon size in px)
- `data-armory-inline-text="wiki"` (show name + wiki link)
- `data-armory-blank-text="Empty Slot"` (for id=-1)

**Display:**
- Icon with rarity-colored border
- Optional item name link
- Tooltip: Name, rarity, type, description, stats

### 2. Skills
**Attributes:**
- `data-armory-embed="skills"`
- `data-armory-ids="5492,5495"`
- `data-armory-size="32"`
- `data-armory-inline-text="wiki"`

**Display:**
- Icon with profession coloring
- Optional skill name link
- Tooltip: Name, profession, description, facts (damage, cooldown, etc.)

### 3. Traits
**Attributes:**
- `data-armory-embed="traits"`
- `data-armory-ids="214,221"`
- Similar to skills

**Display:**
- Icon with tier indicator
- Tooltip: Name, specialization, tier, description

### 4. Specializations
**Attributes:**
- `data-armory-embed="specializations"`
- `data-armory-ids="5"`
- `data-armory-5-traits="214,221,222"` (selected traits)

**Display:**
- Full traitline with selected traits highlighted
- Tooltip for each trait
- Profession theming

### 5. Amulets
**Attributes:**
- `data-armory-embed="amulets"`
- `data-armory-ids="1"`

**Display:**
- Icon with stats
- Tooltip: Name, attributes

---

## File Structure

```
armory/
├── PLAN.md                    # This file
├── README.md                  # Usage documentation
├── src/
│   ├── armory.js             # Main entry point
│   ├── scanner.js            # DOM scanner
│   ├── data-fetcher.js       # GW2 API integration
│   ├── tooltip.js            # Tooltip system
│   ├── renderer.js           # Embed rendering
│   ├── utils.js              # Helper functions
│   └── config.js             # Configuration
├── styles/
│   ├── armory.css            # Main styles
│   ├── tooltips.css          # Tooltip styles
│   └── embeds.css            # Embed styles
├── test/
│   └── index.html            # Testing page
└── dist/
    └── armory-bundle.js      # Combined build (later)
```

---

## Implementation Phases

### Phase 1: Core Foundation ✅
- [x] Create folder structure
- [ ] Set up data fetcher with caching
- [ ] Create basic tooltip system
- [ ] Build DOM scanner
- [ ] Test with items only

### Phase 2: Basic Embeds
- [ ] Implement item embeds (full features)
- [ ] Implement skill embeds
- [ ] Implement trait embeds
- [ ] Add inline text support
- [ ] Test page with all basic embeds

### Phase 3: Advanced Features
- [ ] Specialization embeds (traitlines)
- [ ] Amulet embeds
- [ ] Rarity-based styling
- [ ] Profession-based theming
- [ ] Wiki link integration

### Phase 4: Polish & Optimization
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Mobile responsiveness
- [ ] Documentation

### Phase 5: Integration
- [ ] Update SC Editor to use new library
- [ ] Remove old armory-embeds dependency
- [ ] Production testing

---

## Configuration Options

```javascript
window.GW2Armory = {
  // Language support
  lang: 'en', // en, fr, de, es, zh, ru

  // Cache settings
  cache: {
    enabled: true,
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
    prefix: 'gw2armory_'
  },

  // API settings
  api: {
    base: 'https://api.guildwars2.com/v2',
    timeout: 10000
  },

  // Tooltip settings
  tooltip: {
    delay: 100, // ms before showing
    maxWidth: 350,
    offset: 10
  },

  // Link settings
  links: {
    wiki: 'https://wiki.guildwars2.com/wiki/',
    chatcode: true // support [&AgH...] format
  }
};
```

---

## Data Structures

### Item Data
```javascript
{
  id: 12345,
  name: "Berserker's Greatsword",
  description: "...",
  type: "Weapon",
  rarity: "Exotic",
  level: 80,
  icon: "https://render.guildwars2.com/...",
  details: {
    type: "Greatsword",
    damage_type: "Physical",
    min_power: 995,
    max_power: 1100,
    defense: 0,
    infusion_slots: [...],
    infix_upgrade: { attributes: [...] }
  }
}
```

### Skill Data
```javascript
{
  id: 5492,
  name: "Healing Signet",
  description: "...",
  icon: "https://render.guildwars2.com/...",
  type: "Heal",
  weapon_type: "None",
  professions: ["Warrior"],
  slot: "Heal",
  facts: [
    { text: "Healing", value: 3600, type: "AttributeAdjust" },
    { text: "Recharge", value: 20, type: "Recharge" }
  ]
}
```

---

## Styling Approach

### Rarity Colors (GW2 Standard)
```css
.rarity-junk { color: #aaa; border-color: #aaa; }
.rarity-basic { color: #000; border-color: #000; }
.rarity-fine { color: #62a4da; border-color: #62a4da; }
.rarity-masterwork { color: #1a9306; border-color: #1a9306; }
.rarity-rare { color: #fcd00b; border-color: #fcd00b; }
.rarity-exotic { color: #ffa405; border-color: #ffa405; }
.rarity-ascended { color: #fb3e8d; border-color: #fb3e8d; }
.rarity-legendary { color: #4c139d; border-color: #4c139d; }
```

### Profession Colors
```css
.prof-guardian { --prof-color: #72c1d9; }
.prof-warrior { --prof-color: #ffd166; }
.prof-engineer { --prof-color: #d09c59; }
.prof-ranger { --prof-color: #8cdc82; }
.prof-thief { --prof-color: #c08f95; }
.prof-elementalist { --prof-color: #f68a87; }
.prof-mesmer { --prof-color: #b679d5; }
.prof-necromancer { --prof-color: #52a76f; }
.prof-revenant { --prof-color: #d16e5a; }
```

---

## Security Considerations

1. **No External Links**: All links under our control
2. **XSS Prevention**: Sanitize all user input and API responses
3. **CSP Compatible**: No inline scripts or styles
4. **HTTPS Only**: API calls over secure connection
5. **Cache Validation**: Verify cached data integrity

---

## Performance Optimizations

1. **Lazy Loading**: Only fetch data when embed is visible
2. **Batch Requests**: Combine multiple ID requests
3. **Debouncing**: Limit API calls during rapid interactions
4. **Image Lazy Loading**: Use `loading="lazy"` on icons
5. **Minimal DOM**: Efficient rendering with minimal nodes

---

## Testing Strategy

### Test Page Sections
1. **Items**: Various rarities, types, sizes
2. **Skills**: Different professions, elite specs
3. **Traits**: All tiers and specializations
4. **Specializations**: Full traitlines with selections
5. **Edge Cases**: Missing data, invalid IDs, blank slots
6. **Performance**: 100+ embeds on one page

---

## Migration from Old Library

### Breaking Changes
- Different class names (`.gw2armory-*` instead of `.gw2a-*`)
- Configuration object name change
- No automatic chat code parsing (separate feature)

### Compatibility Layer
Option to provide compatibility mode that supports old attribute names.

---

## Future Enhancements

- [ ] Build/gear template support
- [ ] Chat code parsing
- [ ] Skin preview
- [ ] Achievement embeds
- [ ] Recipe embeds
- [ ] Currency embeds
- [ ] Dark mode support
- [ ] Animation effects
- [ ] Accessibility improvements

---

## Notes

- Keep it simple and focused
- Prioritize readability over cleverness
- Document everything
- Test thoroughly
- No frameworks - vanilla JS only
- Modern ES6+ features are fine (no IE11 support needed)
