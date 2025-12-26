# GW2 Armory Embeds

A modern, lightweight library for embedding Guild Wars 2 armory data (items, skills, traits, specializations) into web pages.

## Features

- ✅ Vanilla JavaScript (no dependencies)
- ✅ Simple tooltip system
- ✅ GW2 API v2 integration
- ✅ LocalStorage caching
- ✅ Rarity-based styling
- ✅ Responsive design
- ✅ Security-focused

## Quick Start

### 1. Include the Library

```html
<link rel="stylesheet" href="styles/armory.css">
<script src="src/armory.js"></script>
```

### 2. Add Embeds to Your HTML

```html
<!-- Single Item -->
<div data-armory-embed="items" data-armory-ids="30704"></div>

<!-- Multiple Skills -->
<div data-armory-embed="skills" data-armory-ids="5492,5495,5502"></div>

<!-- Inline with Wiki Link -->
<div data-armory-embed="items" data-armory-ids="30704" data-armory-inline-text="wiki"></div>
```

### 3. Initialize (Optional)

The library auto-initializes when the DOM is ready. For custom configuration:

```html
<script>
window.GW2Armory = {
  lang: 'en',
  cache: { enabled: true, duration: 604800000 },
  tooltip: { delay: 100 }
};
</script>
```

## Supported Embed Types

### Items
```html
<div data-armory-embed="items"
     data-armory-ids="12345"
     data-armory-size="48"
     data-armory-inline-text="wiki"></div>
```

### Skills
```html
<div data-armory-embed="skills"
     data-armory-ids="5492"
     data-armory-inline-text="wiki"></div>
```

### Traits
```html
<div data-armory-embed="traits"
     data-armory-ids="214"></div>
```

### Specializations
```html
<div data-armory-embed="specializations"
     data-armory-ids="5"
     data-armory-5-traits="214,221,222"></div>
```

## Data Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-armory-embed` | Type of embed | `items`, `skills`, `traits`, `specializations` |
| `data-armory-ids` | Comma-separated IDs | `12345,67890` |
| `data-armory-size` | Icon size in pixels | `32`, `48`, `64` |
| `data-armory-inline-text` | Show name inline | `wiki` for wiki link |
| `data-armory-blank-text` | Text for empty slots (id=-1) | `"Empty Slot"` |

## Configuration

```javascript
window.GW2Armory = {
  // Language (en, fr, de, es, zh, ru)
  lang: 'en',

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
    delay: 100,
    maxWidth: 350,
    offset: 10
  }
};
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development Status

🚧 **Work in Progress** - Currently implementing core features.

See [PLAN.md](PLAN.md) for detailed implementation plan.

## License

MIT
