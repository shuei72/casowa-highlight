# Casowa Highlight

VS Code extension to highlight words in the active editor with up to 16 configurable color patterns.

## Features

- Highlight the word under the cursor
- Highlight a word entered from an input box
- Clear only the highlighted word under the cursor
- Clear all highlights in the active editor
- Configure background and foreground colors for 16 highlight patterns
- Prefer unused highlight patterns, then reuse from the first pattern when all 16 are in use

## Development

```bash
npm install
npm run compile
```

## Commands

- `Casowa Highlight: Highlight Current Word`
- `Casowa Highlight: Highlight Word from Input`
- `Casowa Highlight: Clear Current Word Highlight`
- `Casowa Highlight: Clear All Highlights`

## Settings

Each highlight pattern has these settings:

- `casowaHighlight.patternN.backgroundColor`
- `casowaHighlight.patternN.foregroundColor`

`N` can be `1` to `16`.

## Sample settings.json for light themes

```json
{
  "casowaHighlight.pattern1.backgroundColor": "#FFF1A8",
  "casowaHighlight.pattern1.foregroundColor": "#2B2200",
  "casowaHighlight.pattern2.backgroundColor": "#FFD7A8",
  "casowaHighlight.pattern2.foregroundColor": "#3A1F00",
  "casowaHighlight.pattern3.backgroundColor": "#CDECCF",
  "casowaHighlight.pattern3.foregroundColor": "#12311A",
  "casowaHighlight.pattern4.backgroundColor": "#BFECE5",
  "casowaHighlight.pattern4.foregroundColor": "#10302C",
  "casowaHighlight.pattern5.backgroundColor": "#BEE3FF",
  "casowaHighlight.pattern5.foregroundColor": "#0E2A40",
  "casowaHighlight.pattern6.backgroundColor": "#CADBFF",
  "casowaHighlight.pattern6.foregroundColor": "#14264A",
  "casowaHighlight.pattern7.backgroundColor": "#D9CCFF",
  "casowaHighlight.pattern7.foregroundColor": "#261A52",
  "casowaHighlight.pattern8.backgroundColor": "#E8C9F3",
  "casowaHighlight.pattern8.foregroundColor": "#3B1745",
  "casowaHighlight.pattern9.backgroundColor": "#F8C6DD",
  "casowaHighlight.pattern9.foregroundColor": "#4A1830",
  "casowaHighlight.pattern10.backgroundColor": "#FFC8C8",
  "casowaHighlight.pattern10.foregroundColor": "#4A1A1A",
  "casowaHighlight.pattern11.backgroundColor": "#FFD2C2",
  "casowaHighlight.pattern11.foregroundColor": "#4A2418",
  "casowaHighlight.pattern12.backgroundColor": "#FFE3A3",
  "casowaHighlight.pattern12.foregroundColor": "#4A360E",
  "casowaHighlight.pattern13.backgroundColor": "#E7F0B2",
  "casowaHighlight.pattern13.foregroundColor": "#34400F",
  "casowaHighlight.pattern14.backgroundColor": "#D4EDBA",
  "casowaHighlight.pattern14.foregroundColor": "#244115",
  "casowaHighlight.pattern15.backgroundColor": "#C9EAE6",
  "casowaHighlight.pattern15.foregroundColor": "#163C38",
  "casowaHighlight.pattern16.backgroundColor": "#D5DDE3",
  "casowaHighlight.pattern16.foregroundColor": "#1E2A32"
}
```

## Sample settings.json for dark themes

```json
{
  "casowaHighlight.pattern1.backgroundColor": "#7A6400",
  "casowaHighlight.pattern1.foregroundColor": "#FFF8D6",
  "casowaHighlight.pattern2.backgroundColor": "#8A4E00",
  "casowaHighlight.pattern2.foregroundColor": "#FFF1DF",
  "casowaHighlight.pattern3.backgroundColor": "#1F6A3A",
  "casowaHighlight.pattern3.foregroundColor": "#E6FFEC",
  "casowaHighlight.pattern4.backgroundColor": "#0F6A63",
  "casowaHighlight.pattern4.foregroundColor": "#E2FFFB",
  "casowaHighlight.pattern5.backgroundColor": "#0A5D91",
  "casowaHighlight.pattern5.foregroundColor": "#E7F6FF",
  "casowaHighlight.pattern6.backgroundColor": "#254E9B",
  "casowaHighlight.pattern6.foregroundColor": "#ECF2FF",
  "casowaHighlight.pattern7.backgroundColor": "#5A43A8",
  "casowaHighlight.pattern7.foregroundColor": "#F0EBFF",
  "casowaHighlight.pattern8.backgroundColor": "#7C3C8D",
  "casowaHighlight.pattern8.foregroundColor": "#FBEFFF",
  "casowaHighlight.pattern9.backgroundColor": "#8D345E",
  "casowaHighlight.pattern9.foregroundColor": "#FFEAF3",
  "casowaHighlight.pattern10.backgroundColor": "#8A3030",
  "casowaHighlight.pattern10.foregroundColor": "#FFEAEA",
  "casowaHighlight.pattern11.backgroundColor": "#8A4528",
  "casowaHighlight.pattern11.foregroundColor": "#FFF0E8",
  "casowaHighlight.pattern12.backgroundColor": "#876300",
  "casowaHighlight.pattern12.foregroundColor": "#FFF8E1",
  "casowaHighlight.pattern13.backgroundColor": "#5F7415",
  "casowaHighlight.pattern13.foregroundColor": "#F6FFD9",
  "casowaHighlight.pattern14.backgroundColor": "#466F1E",
  "casowaHighlight.pattern14.foregroundColor": "#F1FFE7",
  "casowaHighlight.pattern15.backgroundColor": "#246B62",
  "casowaHighlight.pattern15.foregroundColor": "#E8FFFB",
  "casowaHighlight.pattern16.backgroundColor": "#4C5B66",
  "casowaHighlight.pattern16.foregroundColor": "#F1F6FA"
}
```

## Note

This extension was created with the help of OpenAI Codex (GPT-5 based).

## License

MIT
