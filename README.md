# Kasowa Highlight

Kasowa Highlight is a VS Code extension for highlighting words, plain text, and regular-expression matches.  
The panel shows the current highlight list and provides navigation, save, and load actions.

## Commands

`Kasowa Highlight: Add Word Highlight`  
Adds a highlight for the word at the current cursor position or the current selection.

`Kasowa Highlight: Add Search Highlight`  
Adds a highlight from entered text or a regular expression.

`Kasowa Highlight: Toggle Highlight`  
Removes the highlight at the current cursor position, or adds a word highlight for the word at the current cursor position when none exists.

`Kasowa Highlight: Remove Highlight`  
Removes the highlight at the current cursor position.

`Kasowa Highlight: Clear All Highlights`  
Removes every highlight.

`Kasowa Highlight: Toggle Display`  
Turns highlight visibility on or off.

`Kasowa Highlight: Select Highlighted Word`  
Selects an item from the highlight list and moves to the next match.

`Kasowa Highlight: Next Highlighted Match`  
Moves to the next match of the selected highlight.

`Kasowa Highlight: Previous Highlighted Match`  
Moves to the previous match of the selected highlight.

`Kasowa Highlight: Open Highlighted Panel`  
Focuses the highlight list panel.

`Kasowa Highlight: Save Highlights`  
Saves the current highlight list.

`Kasowa Highlight: Load Highlights`  
Loads a previously saved highlight list.

## Features

- Supports word, plain text, and regular expression highlights.
- Supports saving and restoring highlight sets.

## Panel

- Adds a `Kasowa Highlight` view to the panel.
- Shows highlighted text, match counts, and previous/next buttons.
- Supports save, load, and highlight selection from the panel.

## Settings

`kasowaHighlight.colorMode`  
Sets how highlight colors are selected.

| Value | Description |
| --- | --- |
| `auto` | Uses the current theme colors. |
| `light` | Always uses the light color set. |
| `dark` | Always uses the dark color set. |

Default: `auto`

`kasowaHighlight.showPanelJumpButtons`  
Controls whether previous and next buttons are shown for panel highlights.  
Default: `true`

`kasowaHighlight.light.patternN.backgroundColor`  
Highlight background colors for items 1 through 8 in the light theme.

`kasowaHighlight.light.patternN.foregroundColor`  
Highlight foreground colors for items 1 through 8 in the light theme.

`kasowaHighlight.dark.patternN.backgroundColor`  
Highlight background colors for items 1 through 8 in the dark theme.

`kasowaHighlight.dark.patternN.foregroundColor`  
Highlight foreground colors for items 1 through 8 in the dark theme.

## Defaults

```json
{
  "kasowaHighlight.colorMode": "auto",
  "kasowaHighlight.showPanelJumpButtons": true,
  "kasowaHighlight.light.pattern1.backgroundColor": "#FFE066",
  "kasowaHighlight.light.pattern1.foregroundColor": "#2B2200",
  "kasowaHighlight.light.pattern2.backgroundColor": "#FFB86B",
  "kasowaHighlight.light.pattern2.foregroundColor": "#3A1F00",
  "kasowaHighlight.light.pattern3.backgroundColor": "#7EE787",
  "kasowaHighlight.light.pattern3.foregroundColor": "#12311A",
  "kasowaHighlight.light.pattern4.backgroundColor": "#56D4DD",
  "kasowaHighlight.light.pattern4.foregroundColor": "#0F2E33",
  "kasowaHighlight.light.pattern5.backgroundColor": "#7CC7FF",
  "kasowaHighlight.light.pattern5.foregroundColor": "#0E2A40",
  "kasowaHighlight.light.pattern6.backgroundColor": "#8FA8FF",
  "kasowaHighlight.light.pattern6.foregroundColor": "#14264A",
  "kasowaHighlight.light.pattern7.backgroundColor": "#C7A6FF",
  "kasowaHighlight.light.pattern7.foregroundColor": "#261A52",
  "kasowaHighlight.light.pattern8.backgroundColor": "#FF8CC6",
  "kasowaHighlight.light.pattern8.foregroundColor": "#4A1830",
  "kasowaHighlight.dark.pattern1.backgroundColor": "#8A6A00",
  "kasowaHighlight.dark.pattern1.foregroundColor": "#FFF8D6",
  "kasowaHighlight.dark.pattern2.backgroundColor": "#A04F00",
  "kasowaHighlight.dark.pattern2.foregroundColor": "#FFF1DF",
  "kasowaHighlight.dark.pattern3.backgroundColor": "#1F7A32",
  "kasowaHighlight.dark.pattern3.foregroundColor": "#E6FFEC",
  "kasowaHighlight.dark.pattern4.backgroundColor": "#007A7A",
  "kasowaHighlight.dark.pattern4.foregroundColor": "#E2FFFB",
  "kasowaHighlight.dark.pattern5.backgroundColor": "#005FA3",
  "kasowaHighlight.dark.pattern5.foregroundColor": "#E7F6FF",
  "kasowaHighlight.dark.pattern6.backgroundColor": "#2E4FB8",
  "kasowaHighlight.dark.pattern6.foregroundColor": "#ECF2FF",
  "kasowaHighlight.dark.pattern7.backgroundColor": "#6B3FC9",
  "kasowaHighlight.dark.pattern7.foregroundColor": "#F0EBFF",
  "kasowaHighlight.dark.pattern8.backgroundColor": "#B03072",
  "kasowaHighlight.dark.pattern8.foregroundColor": "#FBEFFF"
}
```

## Development

### PowerShell

```powershell
npm.cmd install
npm.cmd run compile
npm.cmd run package
```

### Command Prompt

```cmd
npm install
npm run compile
npm run package
```

## Other

- This extension was created with Codex.

## License

MIT License

