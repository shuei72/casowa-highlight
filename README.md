# Casowa Highlight

Casowa Highlight is a VS Code extension for persistent word, text, and regex highlighting.
It adds a docked highlight panel, quick match navigation, and save/load slots so you can keep important terms visible while you work.

## Features

- Highlight the current word, the current selection, or a custom search query
- Support `Text`, `Word`, and `Regex` search modes with case sensitivity options
- Browse all active highlights in a docked panel with per-highlight match counts
- Jump to the next or previous match from the panel or command palette
- Save highlight sets and load them later
- Keep up to 16 highlights at once: 8 filled styles and 8 outline styles
- Run the main actions from a single editor context submenu

## Quick Start

1. Run `Casowa Highlight: Add Word Highlight` to highlight the word at the cursor or the current selection.
2. Run `Casowa Highlight: Add Search Highlight` when you want text, whole-word, or regex matching.
3. Open the `Casowa Highlight` panel to review active highlights and jump through matches.
4. Use `Save` and `Load` in the panel to keep reusable highlight sets.

## Commands

- `Casowa Highlight: Add Word Highlight`
- `Casowa Highlight: Add Search Highlight`
- `Casowa Highlight: Toggle Highlight`
- `Casowa Highlight: Remove Highlight`
- `Casowa Highlight: Clear All Highlights`
- `Casowa Highlight: Toggle Display`
- `Casowa Highlight: Select Highlighted Word`
- `Casowa Highlight: Open Highlighted Panel`
- `Casowa Highlight: Next Highlighted Match`
- `Casowa Highlight: Previous Highlighted Match`
- `Casowa Highlight: Save Highlights`
- `Casowa Highlight: Load Highlights`

## Panel

- Shows all current highlights with their match counts in the active editor
- Click a highlight chip to jump to the next match
- Shift-click a highlight chip to jump to the previous match
- Use the arrow buttons on each chip for explicit previous/next navigation
- Use `Save` to keep the current state; the 5 most recent saved states are retained
- Right-click `Save` to choose which slot to overwrite
- Use `Load` to restore the latest saved state
- Right-click `Load` to choose a saved slot

## Settings

- `casowaHighlight.colorMode`
  Switches highlight colors between `auto`, `light`, and `dark`.
- `casowaHighlight.showPanelJumpButtons`
  Shows or hides the previous/next jump buttons in the panel.
- `casowaHighlight.light.patternN.backgroundColor`
  Sets the light theme background color for pattern `N`.
- `casowaHighlight.light.patternN.foregroundColor`
  Sets the light theme foreground color for pattern `N`.
- `casowaHighlight.dark.patternN.backgroundColor`
  Sets the dark theme background color for pattern `N`.
- `casowaHighlight.dark.patternN.foregroundColor`
  Sets the dark theme foreground color for pattern `N`.

`N` can be `1` to `8`. The same eight configured color pairs are reused for both filled and outline highlights.

## Default Light Theme Colors

```json
{
  "casowaHighlight.light.pattern1.backgroundColor": "#FFE066",
  "casowaHighlight.light.pattern1.foregroundColor": "#2B2200",
  "casowaHighlight.light.pattern2.backgroundColor": "#FFB86B",
  "casowaHighlight.light.pattern2.foregroundColor": "#3A1F00",
  "casowaHighlight.light.pattern3.backgroundColor": "#7EE787",
  "casowaHighlight.light.pattern3.foregroundColor": "#12311A",
  "casowaHighlight.light.pattern4.backgroundColor": "#56D4DD",
  "casowaHighlight.light.pattern4.foregroundColor": "#0F2E33",
  "casowaHighlight.light.pattern5.backgroundColor": "#7CC7FF",
  "casowaHighlight.light.pattern5.foregroundColor": "#0E2A40",
  "casowaHighlight.light.pattern6.backgroundColor": "#8FA8FF",
  "casowaHighlight.light.pattern6.foregroundColor": "#14264A",
  "casowaHighlight.light.pattern7.backgroundColor": "#C7A6FF",
  "casowaHighlight.light.pattern7.foregroundColor": "#261A52",
  "casowaHighlight.light.pattern8.backgroundColor": "#FF8CC6",
  "casowaHighlight.light.pattern8.foregroundColor": "#4A1830"
}
```

## Default Dark Theme Colors

```json
{
  "casowaHighlight.dark.pattern1.backgroundColor": "#8A6A00",
  "casowaHighlight.dark.pattern1.foregroundColor": "#FFF8D6",
  "casowaHighlight.dark.pattern2.backgroundColor": "#A04F00",
  "casowaHighlight.dark.pattern2.foregroundColor": "#FFF1DF",
  "casowaHighlight.dark.pattern3.backgroundColor": "#1F7A32",
  "casowaHighlight.dark.pattern3.foregroundColor": "#E6FFEC",
  "casowaHighlight.dark.pattern4.backgroundColor": "#007A7A",
  "casowaHighlight.dark.pattern4.foregroundColor": "#E2FFFB",
  "casowaHighlight.dark.pattern5.backgroundColor": "#005FA3",
  "casowaHighlight.dark.pattern5.foregroundColor": "#E7F6FF",
  "casowaHighlight.dark.pattern6.backgroundColor": "#2E4FB8",
  "casowaHighlight.dark.pattern6.foregroundColor": "#ECF2FF",
  "casowaHighlight.dark.pattern7.backgroundColor": "#6B3FC9",
  "casowaHighlight.dark.pattern7.foregroundColor": "#F0EBFF",
  "casowaHighlight.dark.pattern8.backgroundColor": "#B03072",
  "casowaHighlight.dark.pattern8.foregroundColor": "#FBEFFF"
}
```

## Development

### PowerShell

```powershell
npm.cmd install
npm.cmd run compile
npx.cmd @vscode/vsce package
```

### Command Prompt

```cmd
npm install
npm run compile
npx @vscode/vsce package
```

Press `F5` in VS Code to launch the extension in Extension Development Host.

## License

MIT
