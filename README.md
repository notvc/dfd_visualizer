# DFD-Terminal — Retro Data Flow Diagram Visualizer

> A zero-dependency, interactive **Data Flow Diagram (DFD)** editor and visualizer built with pure HTML, CSS, and JavaScript — styled as a vintage CRT computer terminal.

![Status](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Dependencies](https://img.shields.io/badge/Dependencies-0-orange)

---

## ✨ Features

### Interactive Visual Canvas
- **Drag-and-drop** nodes with 10px grid snapping
- **Draw connections** by dragging from one node to another
- **Pan & zoom** the canvas with mouse wheel and drag
- **Animated data packets** — glowing dots pulse along flow arrows in real time
- **Click-to-inspect** any element to edit its properties
- **Cursor feedback** — cursor changes based on active tool (pointer, cell, crosshair)

### Dual-Mode Editing
- **Visual Editor** — place and connect nodes directly on the SVG canvas
- **Script Editor** — write diagrams using a simple text-based DSL (Domain-Specific Language):
  ```text
  # Nodes
  E1[Customer]
  P1(Process Order)
  S1|Orders Store|

  # Flows
  E1 -> P1 : Order Details
  P1 -> S1 : Save Order
  ```
- Changes sync **bidirectionally** — edit the script and the canvas updates; drag a node and the script updates.

### DFD Element Types
| Element | Syntax | Shape |
|---|---|---|
| **External Entity** | `E1[Name]` | Double-bordered rectangle |
| **Process** | `P1(Name)` | Split circle (ID top, label bottom) |
| **Data Store** | `S1\|Name\|` | Gane-Sarson open-right box with ID column |
| **Data Flow** | `E1 -> P1 : Label` | Curved arrow with label |

### 8 Color Themes
| Theme | Description |
|---|---|
| 🟢 **Green Phosphor** | Classic terminal green-on-black |
| 🟠 **Amber Phosphor** | Warm amber CRT monitor |
| 🔵 **Blueprint CAD** | Engineering blueprint blue |
| 📄 **Vintage Paper** | Light retro computer paper |
| ⚫ **Sleek Dark** | Modern dark mode with blue accents |
| 💜 **Cyberpunk Neon** | Hot pink, cyan, and purple neons |
| 🎮 **Gameboy** | Classic handheld dot-matrix green |
| 🟩 **The Matrix** | Hacker-style bright green on black |

### CRT Screen Effects
- Scanline overlay
- Subtle screen flicker animation
- Corner vignette shadow
- Phosphor text glow
- All effects togglable with the **CRT FX** button

### Retro Audio Feedback
- Synthesized sound effects via the **Web Audio API** (no audio files needed)
- Click beeps, success chimes, error buzzes, delete slides, and a pitch-modulated dragging hum
- Toggle on/off with the **SOUND** button

### Export Formats
| Format | Description |
|---|---|
| **JSON** | Full project state backup (re-importable via LOAD) |
| **SVG** | Self-contained vector diagram with embedded styles |
| **PNG** | Rasterized image with theme-accurate colors |
| **PDF** | High-resolution vector print via system print dialog |
| **TXT** | Raw DSL script for version control or sharing |
| **Markdown** | Formatted `.md` document with embedded DSL code block |

### Built-in Example Templates
- **ATM System** — card authentication, transactions, balance inquiries
- **E-Commerce** — checkout, payment, inventory, fulfillment
- **Library Management** — lending, returns, overdue alerts

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- No build tools, no package managers, no server required

### Run It
1. Clone or download this repository
2. Open `index.html` in your browser

That's it. Zero dependencies. Zero build steps.

---

## 🗂️ Project Structure

```
dfd-visualizer/
├── index.html      # Main HTML layout (CRT shell, panels, SVG canvas)
├── styles.css      # Design system, 8 themes, CRT effects, responsive & print styles
├── sound.js        # Web Audio API synthesizer for UI sound effects
├── diagram.js      # Data model, DSL parser/serializer, undo/redo history
├── canvas.js       # SVG rendering, drag/drop, zoom/pan, connections, cursor feedback
├── templates.js    # Built-in DFD example presets (ATM, E-Commerce, Library)
├── app.js          # Application glue: event bindings, exports, bidirectional sync
└── README.md       # This file
```

### Module Dependency Order
Scripts are loaded in this order (each depends on the ones above it):
1. `sound.js` — standalone audio engine
2. `diagram.js` — standalone data model & parser
3. `templates.js` — standalone template strings
4. `canvas.js` — depends on `DiagramModel` and `SoundManager`
5. `app.js` — orchestrates all modules

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Compile DSL script |
| `Escape` | Reset tool to Select mode / deselect |
| Mouse wheel | Zoom in/out |
| Click + drag (canvas bg) | Pan the viewport |

---

## 📐 DSL Syntax Reference

### Defining Nodes
```text
# External Entity — square brackets
E1[Customer Name]

# Process — parentheses
P1(Process Name)

# Data Store — pipes
S1|Store Name|
```

### Defining Flows
```text
# Basic flow
E1 -> P1

# Flow with label
E1 -> P1 : Order Details
```

### Position Metadata
Positions are auto-generated and appended to the script when you drag nodes:
```text
# Positions
E1: 80, 220
P1: 280, 120
S1: 480, 120
```

### Comments
Lines starting with `#` are treated as comments or section headers.

### Auto-Layout
Nodes without explicit positions are arranged in a circular layout centered on the canvas. Once you drag a node, its position is saved into the `# Positions` block in the DSL script.

---

## 🎨 Theming

All themes are implemented as CSS custom properties on the `<body>` class:

```css
.crt-theme-green {
    --bg-color: #000b00;
    --text-color: #33ff33;
    --border-color: #33ff33;
    --glow-color: rgba(51, 255, 51, 0.6);
    /* ... */
}
```

Each theme defines 12 CSS variables:
| Variable | Purpose |
|---|---|
| `--bg-color` | Main background |
| `--card-bg` | Panel/card backgrounds |
| `--text-color` | Primary text and strokes |
| `--text-dim` | Dimmed/secondary text |
| `--text-bright` | Bright highlights |
| `--border-color` | Panel borders |
| `--border-dim` | Subtle borders |
| `--grid-line-color` | SVG canvas grid |
| `--selection-bg` | Active/selected state fill |
| `--accent-color` | Accent highlights |
| `--glow-color` | SVG glow filter color |
| `--danger-color` | Delete/error states |

To add a custom theme:
1. Define a new `.crt-theme-yourname` block in `styles.css` with all 12 variables
2. Add an `<option value="yourname">` in the theme `<select>` in `index.html`

---

## 📤 Export Details

### SVG Export
- Self-contained with embedded `<style>` block
- Cropped to a bounding box around your diagram (snapped to 40px grid)
- Theme-accurate colors baked in via CSS variables

### PNG Export
- Rendered via offscreen HTML5 Canvas from the SVG clone
- Auto-cropped to diagram bounds
- Background color matches active theme

### PDF Export
- Opens a print-optimized window with just the diagram
- Uses the browser's native "Save as PDF" for lossless vector output
- Landscape orientation with `@page` rules
- Requires popups to be allowed in the browser

### TXT Export
- Raw DSL script including node definitions, flows, and position metadata
- Can be re-imported by pasting into the Script Editor and clicking RUN

### Markdown Export
- Formatted `.md` document with generation timestamp
- Embeds the full DSL script in a fenced code block
- Includes instructions for re-importing

---

## 🛠️ Technical Notes

### Architecture
- **Zero external dependencies** — everything is vanilla JS/CSS/HTML
- **SVG-based rendering** — all diagram elements are vector, scalable, and exportable
- **Module pattern** — each JS file exposes a singleton via IIFE (`SoundManager`, `DiagramModel`, `CanvasManager`, `TemplateRegistry`)
- **Bidirectional sync** — the Script Editor and Visual Canvas stay in sync through `DiagramModel.registerOnChange()` callbacks

### Rendering Pipeline
1. User edits DSL script → `parseDSL()` validates and updates model → `triggerChange()` → `CanvasManager.draw()` rebuilds SVG
2. User drags node → `updateNode()` modifies model → `triggerChange()` → `generateDSL()` updates editor text

### Undo/Redo
- History snapshots are stored as JSON string serializations of the full diagram state
- Maximum 50 undo levels
- Drag operations save one snapshot at drag-start (continuous moves skip history to avoid flooding)

### Fonts
- **Share Tech Mono** and **VT323** loaded from Google Fonts CDN
- Falls back to system `monospace` if fonts fail to load

### Grid Pattern
- Dual-layer SVG pattern (40px major lines / 20px dashed minor lines)
- `patternTransform` syncs with viewport transform for smooth pan/zoom

### Browser Compatibility
- Modern browsers with ES6+ support (Chrome 60+, Firefox 55+, Edge 79+, Safari 12+)
- Web Audio API required for sound (gracefully degrades if unavailable)
- Clipboard API used for copy with `execCommand` fallback for older browsers

---

## 📜 License

MIT License — free for personal and commercial use.
