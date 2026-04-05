# Casowa Highlight

Casowa Highlight is a VS Code extension for highlighting words, plain text, and regular-expression matches.  
The panel shows the current highlight list and provides navigation, save, and load actions.

## Commands

`Casowa Highlight: Add Word Highlight`  
Adds a highlight for the word at the current cursor position or the current selection.

`Casowa Highlight: Add Search Highlight`  
Adds a highlight from entered text or a regular expression.

`Casowa Highlight: Toggle Highlight`  
Removes the highlight at the current cursor position, or adds a word highlight for the word at the current cursor position when none exists.

`Casowa Highlight: Remove Highlight`  
Removes the highlight at the current cursor position.

`Casowa Highlight: Clear All Highlights`  
Removes every highlight.

`Casowa Highlight: Toggle Display`  
Turns highlight visibility on or off.

`Casowa Highlight: Select Highlighted Word`  
Selects an item from the highlight list and moves to the next match.

`Casowa Highlight: Next Highlighted Match`  
Moves to the next match of the selected highlight.

`Casowa Highlight: Previous Highlighted Match`  
Moves to the previous match of the selected highlight.

`Casowa Highlight: Open Highlighted Panel`  
Focuses the highlight list panel.

`Casowa Highlight: Save Highlights`  
Saves the current highlight list.

`Casowa Highlight: Load Highlights`  
Loads a previously saved highlight list.

## Features

- Supports word, plain text, and regular expression highlights.
- Supports saving and restoring highlight sets.

## Panel

- Adds a `Casowa Highlight` view to the panel.
- Shows highlighted text, match counts, and previous/next buttons.
- Supports save, load, and highlight selection from the panel.

## Settings

`casowaHighlight.colorMode`  
Sets how highlight colors are selected.

| Value | Description |
| --- | --- |
| `auto` | Uses the current theme colors. |
| `light` | Always uses the light color set. |
| `dark` | Always uses the dark color set. |

Default: `auto`

`casowaHighlight.showPanelJumpButtons`  
Controls whether previous and next buttons are shown for panel highlights.  
Default: `true`

`casowaHighlight.light.patternN.backgroundColor`  
Highlight background colors for items 1 through 8 in the light theme.

`casowaHighlight.light.patternN.foregroundColor`  
Highlight foreground colors for items 1 through 8 in the light theme.

`casowaHighlight.dark.patternN.backgroundColor`  
Highlight background colors for items 1 through 8 in the dark theme.

`casowaHighlight.dark.patternN.foregroundColor`  
Highlight foreground colors for items 1 through 8 in the dark theme.

## Defaults

```json
{
  "casowaHighlight.colorMode": "auto",
  "casowaHighlight.showPanelJumpButtons": true,
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
  "casowaHighlight.light.pattern8.foregroundColor": "#4A1830",
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
