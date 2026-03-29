import * as vscode from 'vscode';

const PATTERN_COUNT = 16;

type PatternDefinition = {
  backgroundColor: string;
  foregroundColor: string;
};

type HighlightEntry = {
  patternIndex: number;
  word: string;
};

const highlightStore = new Map<string, HighlightEntry[]>();
const reuseStartIndexStore = new Map<string, number>();
let decorationTypes: vscode.TextEditorDecorationType[] = [];

export function activate(context: vscode.ExtensionContext): void {
  decorationTypes = createDecorationTypes();

  context.subscriptions.push(
    vscode.commands.registerCommand('casowaHighlight.highlightCurrentWord', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const word = getWordAtCursor(editor);
      if (!word) {
        vscode.window.showInformationMessage('Cursor is not on a word.');
        return;
      }

      addHighlight(editor.document, word);
      renderHighlightsForDocument(editor.document);
    }),
    vscode.commands.registerCommand('casowaHighlight.highlightInputWord', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const defaultWord = getWordAtCursor(editor) ?? '';
      const input = await vscode.window.showInputBox({
        prompt: 'Enter the word to highlight',
        value: defaultWord,
        ignoreFocusOut: true
      });

      const word = input?.trim();
      if (!word) {
        return;
      }

      addHighlight(editor.document, word);
      renderHighlightsForDocument(editor.document);
    }),
    vscode.commands.registerCommand('casowaHighlight.clearCurrentWordHighlight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const word = getWordAtCursor(editor);
      if (!word) {
        vscode.window.showInformationMessage('Cursor is not on a word.');
        return;
      }

      removeHighlight(editor.document, word);
      renderHighlightsForDocument(editor.document);
    }),
    vscode.commands.registerCommand('casowaHighlight.clearAllHighlights', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      clearAllHighlights(editor.document);
      renderHighlightsForDocument(editor.document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (highlightStore.has(event.document.uri.toString())) {
        renderHighlightsForDocument(event.document);
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) {
        renderHighlightsForDocument(editor.document);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('casowaHighlight')) {
        return;
      }

      for (const decorationType of decorationTypes) {
        decorationType.dispose();
      }

      decorationTypes = createDecorationTypes();

      for (const editor of vscode.window.visibleTextEditors) {
        renderHighlightsForDocument(editor.document);
      }
    }),
    ...decorationTypes
  );

  for (const editor of vscode.window.visibleTextEditors) {
    renderHighlightsForDocument(editor.document);
  }
}

export function deactivate(): void {
  for (const decorationType of decorationTypes) {
    decorationType.dispose();
  }
}

function addHighlight(document: vscode.TextDocument, word: string): void {
  const documentKey = document.uri.toString();
  const entries = highlightStore.get(documentKey) ?? [];
  const existingEntry = entries.find((entry) => entry.word === word);

  if (existingEntry) {
    return;
  }

  const usedPatternIndexes = new Set(entries.map((entry) => entry.patternIndex));
  let patternIndex = -1;

  for (let index = 0; index < PATTERN_COUNT; index += 1) {
    if (!usedPatternIndexes.has(index)) {
      patternIndex = index;
      break;
    }
  }

  if (patternIndex === -1) {
    patternIndex = reuseStartIndexStore.get(documentKey) ?? 0;
    const replaceIndex = entries.findIndex((entry) => entry.patternIndex === patternIndex);
    if (replaceIndex >= 0) {
      entries.splice(replaceIndex, 1);
    }

    reuseStartIndexStore.set(documentKey, (patternIndex + 1) % PATTERN_COUNT);
  }

  entries.push({
    patternIndex,
    word
  });

  entries.sort((left, right) => left.patternIndex - right.patternIndex);
  highlightStore.set(documentKey, entries);
}

function removeHighlight(document: vscode.TextDocument, word: string): void {
  const documentKey = document.uri.toString();
  const entries = highlightStore.get(documentKey);

  if (!entries) {
    return;
  }

  const nextEntries = entries.filter((entry) => entry.word !== word);
  if (nextEntries.length === 0) {
    clearAllHighlights(document);
    return;
  }

  highlightStore.set(documentKey, nextEntries);
}

function clearAllHighlights(document: vscode.TextDocument): void {
  const documentKey = document.uri.toString();
  highlightStore.delete(documentKey);
  reuseStartIndexStore.delete(documentKey);
}

function renderHighlightsForDocument(document: vscode.TextDocument): void {
  const documentKey = document.uri.toString();
  const entries = highlightStore.get(documentKey) ?? [];
  const rangesByPattern = new Map<number, vscode.Range[]>();

  for (const entry of entries) {
    rangesByPattern.set(entry.patternIndex, findWordRanges(document, entry.word));
  }

  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.toString() !== documentKey) {
      continue;
    }

    for (let index = 0; index < PATTERN_COUNT; index += 1) {
      editor.setDecorations(decorationTypes[index], rangesByPattern.get(index) ?? []);
    }
  }
}

function getWordAtCursor(editor: vscode.TextEditor): string | undefined {
  const selection = editor.selection.active;
  const range = editor.document.getWordRangeAtPosition(selection);

  if (!range) {
    return undefined;
  }

  return editor.document.getText(range);
}

function findWordRanges(document: vscode.TextDocument, word: string): vscode.Range[] {
  const text = document.getText();
  if (!word) {
    return [];
  }

  const ranges: vscode.Range[] = [];
  let searchIndex = 0;

  while (searchIndex < text.length) {
    const matchIndex = text.indexOf(word, searchIndex);
    if (matchIndex === -1) {
      break;
    }

    const previousCharacter = matchIndex > 0 ? text[matchIndex - 1] : undefined;
    const nextIndex = matchIndex + word.length;
    const nextCharacter = nextIndex < text.length ? text[nextIndex] : undefined;

    if (isWordBoundary(previousCharacter) && isWordBoundary(nextCharacter)) {
      const start = document.positionAt(matchIndex);
      const end = document.positionAt(nextIndex);
      ranges.push(new vscode.Range(start, end));
    }

    searchIndex = matchIndex + word.length;
  }

  return ranges;
}

function isWordBoundary(character: string | undefined): boolean {
  if (!character) {
    return true;
  }

  return !/[\p{L}\p{N}_]/u.test(character);
}

function createDecorationTypes(): vscode.TextEditorDecorationType[] {
  const configuration = vscode.workspace.getConfiguration('casowaHighlight');
  const nextDecorationTypes: vscode.TextEditorDecorationType[] = [];

  for (let index = 1; index <= PATTERN_COUNT; index += 1) {
    const definition: PatternDefinition = {
      backgroundColor: configuration.get<string>(`pattern${index}.backgroundColor`, '#FFF59D'),
      foregroundColor: configuration.get<string>(`pattern${index}.foregroundColor`, '#1F1F1F')
    };

    nextDecorationTypes.push(
      vscode.window.createTextEditorDecorationType({
        backgroundColor: definition.backgroundColor,
        color: definition.foregroundColor,
        borderRadius: '2px'
      })
    );
  }

  return nextDecorationTypes;
}
