# Casowa Highlight

[English](README.md) | [日本語](README.ja.md)

VS Code extension for word and search highlighting. Supports a highlight list view and save/load.

## Commands

- `Casowa Highlight: Add Word Highlight`<br>
  Highlights the word at the cursor or the current selection.

- `Casowa Highlight: Add Search Highlight`<br>
  Adds a highlight from an input box with search mode (`Text` / `Word` / `Regex`) and case sensitivity options, using the panel values as defaults.

- `Casowa Highlight: Toggle Highlight`<br>
  Adds a highlight when the current word is not highlighted, or removes the highlight at the cursor when it is.

- `Casowa Highlight: Remove Highlight`<br>
  Removes the highlight at the cursor position.

- `Casowa Highlight: Clear All Highlights`<br>
  Clears all highlights.

- `Casowa Highlight: Toggle Display`<br>
  Toggles highlight visibility.

- `Casowa Highlight: Select Highlighted Word`<br>
  Selects a highlight from the list.

- `Casowa Highlight: Open Highlighted Panel`<br>
  Opens the highlight list panel.

- `Casowa Highlight: Next Highlighted Match`<br>
  Moves to the next match for the selected highlight.

- `Casowa Highlight: Previous Highlighted Match`<br>
  Moves to the previous match for the selected highlight.

- `Casowa Highlight: Save Highlights`<br>
  Saves the current highlights.

- `Casowa Highlight: Load Highlights`<br>
  Loads a saved highlight state.

## Panel

- Shows the list of current highlights. Also shows the match count for each highlight.
- Click or Shift-click a highlight to move to the next or previous match.
- Jump to the previous or next match with the arrow buttons next to highlights. Toggle their visibility in settings.
- Save the current highlight state with the `Save` button. The 5 most recent saved states are kept. Right-click `Save` to choose which of the 5 saved slots to replace.
- Load the most recently saved highlight state with the `Load` button. Right-click `Load` to choose which saved state to load.

## Other Features

- Run Casowa Highlight actions from a single editor context submenu
- Supports up to 16 highlights. The first 8 use filled highlights, and the next 8 use outline highlights

## Settings

- `casowaHighlight.colorMode`<br>
  Switches the highlight color mode between `auto`, `light`, and `dark`. In `auto` mode, highlight colors follow the current VS Code theme.

- `casowaHighlight.showPanelJumpButtons`<br>
  Shows or hides the previous/next jump arrow buttons on highlight chips in the panel with `true` or `false`. The default is `true`.

- `casowaHighlight.light.patternN.backgroundColor`<br>
  Sets the background color for light theme highlight pattern `N`.

- `casowaHighlight.light.patternN.foregroundColor`<br>
  Sets the foreground color for light theme highlight pattern `N`.

- `casowaHighlight.dark.patternN.backgroundColor`<br>
  Sets the background color for dark theme highlight pattern `N`.

- `casowaHighlight.dark.patternN.foregroundColor`<br>
  Sets the foreground color for dark theme highlight pattern `N`.

`N` can be `1` to `8`. The configured 8 colors are used for both filled highlights and outline highlights.

## Default settings.json for light themes

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

## Default settings.json for dark themes

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

## Note

This extension was created with the help of OpenAI Codex (GPT-5 based).

## License

MIT
