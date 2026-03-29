import * as vscode from 'vscode';

const PATTERN_COUNT = 16;
const COLOR_COUNT = 8;

type PatternDefinition = {
  backgroundColor: string;
  foregroundColor: string;
};

type HighlightSearchMode = 'text' | 'word' | 'regex';

type HighlightEntry = {
  caseSensitive: boolean;
  mode: HighlightSearchMode;
  patternIndex: number;
  query: string;
};

type HighlightQuickPickItem = vscode.QuickPickItem & {
  entry: HighlightEntry;
};

type MatchedHighlightRange = {
  endOffset: number;
  entry: HighlightEntry;
  matchLength: number;
  patternIndex: number;
  startOffset: number;
};

type InputHighlightDefaults = {
  caseSensitive: boolean;
  mode: HighlightSearchMode;
};

const highlightStore: HighlightEntry[] = [];
let reuseStartIndexStore = 0;
let selectedHighlightedWordStore: string | undefined;
let inputHighlightDefaults: InputHighlightDefaults = {
  caseSensitive: false,
  mode: 'text'
};
let decorationTypes: vscode.TextEditorDecorationType[] = [];

export function activate(context: vscode.ExtensionContext): void {
  decorationTypes = createDecorationTypes();
  const highlightedWordsPanelProvider = new HighlightedWordsPanelProvider();

  context.subscriptions.push(
    highlightedWordsPanelProvider,
    vscode.window.registerWebviewViewProvider(
      'casowa-highlighted-words-panel',
      highlightedWordsPanelProvider
    ),
    vscode.commands.registerCommand('casowaHighlight.highlightWordFromContext', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const word = getSelectedOrCurrentWord(editor);
      if (!word) {
        vscode.window.showInformationMessage('No word is available to highlight.');
        return;
      }

      addHighlight({
        caseSensitive: true,
        mode: 'word',
        query: word
      });
      renderHighlightsForVisibleEditors();
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.highlightInputWord', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const defaultWord = getWordAtCursor(editor) ?? '';
      const input = await vscode.window.showInputBox({
        prompt: 'Enter the text to highlight',
        value: defaultWord,
        ignoreFocusOut: true
      });

      const query = input?.trim();
      if (!query) {
        return;
      }

      const mode = await pickHighlightSearchMode();
      if (!mode) {
        return;
      }

      const caseSensitive = await pickCaseSensitivity();
      if (caseSensitive === undefined) {
        return;
      }

      const entry: HighlightEntry = {
        caseSensitive,
        mode,
        patternIndex: -1,
        query
      };

      if (entry.mode === 'regex' && !createSearchPattern(entry)) {
        vscode.window.showErrorMessage('The regular expression is invalid.');
        return;
      }

      inputHighlightDefaults = {
        caseSensitive,
        mode
      };

      addHighlight(entry);
      renderHighlightsForVisibleEditors();
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.clearCurrentWordHighlight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const entry = getHighlightEntryAtPosition(editor.document, editor.selection.active);
      if (!entry) {
        vscode.window.showInformationMessage('There is no highlight at the cursor position.');
        return;
      }

      removeHighlight(entry);
      renderHighlightsForVisibleEditors();
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.clearAllHighlights', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      clearAllHighlights();
      renderHighlightsForVisibleEditors();
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.showHighlightedWords', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const entries = getHighlightEntries();
      if (entries.length === 0) {
        vscode.window.showInformationMessage('There is no highlighted text in the active editor.');
        return;
      }

      const items: HighlightQuickPickItem[] = entries.map((entry) => {
        const ranges = findHighlightRanges(editor.document, entry);
        const pattern = getPatternDefinition(entry.patternIndex + 1);

        return {
          label: entry.query,
          description: getHighlightEntryDescription(entry, ranges.length),
          iconPath: createHighlightIconUri(pattern),
          entry
        };
      });

      const selectedItem = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select highlighted text to jump to the next match',
        ignoreFocusOut: true
      });

      if (!selectedItem) {
        return;
      }

      const ranges = findHighlightRanges(editor.document, selectedItem.entry);
      if (ranges.length === 0) {
        vscode.window.showInformationMessage('The selected highlighted text was not found.');
        return;
      }

      selectHighlightedWord(selectedItem.entry);
      jumpToNextRange(editor, ranges);
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.showHighlightedPanel', async () => {
      await vscode.commands.executeCommand('casowa-highlighted-words-panel.focus');
    }),
    vscode.commands.registerCommand('casowaHighlight.jumpToNextSelectedHighlightedWord', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selectedEntry = getSelectedHighlightedWord();
      if (!selectedEntry) {
        vscode.window.showInformationMessage('No highlighted text is currently selected.');
        return;
      }

      const ranges = findHighlightRanges(editor.document, selectedEntry);
      if (ranges.length === 0) {
        vscode.window.showInformationMessage('The selected highlighted text was not found.');
        return;
      }

      jumpToNextRange(editor, ranges);
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.copyHighlightedWord', async (entryKey: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const entry = getHighlightEntries().find((item) => getHighlightEntryKey(item) === entryKey);
      if (!entry) {
        return;
      }

      await vscode.env.clipboard.writeText(entry.query);
    }),
    vscode.commands.registerCommand('casowaHighlight.copyAllHighlightedWords', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const words = getHighlightEntries().map((entry) => entry.query);
      if (words.length === 0) {
        return;
      }

      await vscode.env.clipboard.writeText(words.join('\n'));
    }),
    vscode.commands.registerCommand('casowaHighlight.removeHighlightedWord', async (entryKey: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const entry = getHighlightEntries().find((item) => getHighlightEntryKey(item) === entryKey);
      if (!entry) {
        return;
      }

      removeHighlight(entry);
      renderHighlightsForVisibleEditors();
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (highlightStore.length > 0) {
        renderHighlightsForDocument(event.document);
        highlightedWordsPanelProvider.refresh();
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) {
        renderHighlightsForDocument(editor.document);
      }

      highlightedWordsPanelProvider.refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      highlightedWordsPanelProvider.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('casowaHighlight')) {
        return;
      }

      for (const decorationType of decorationTypes) {
        decorationType.dispose();
      }

      decorationTypes = createDecorationTypes();

      renderHighlightsForVisibleEditors();
      highlightedWordsPanelProvider.refresh();
    }),
    ...decorationTypes
  );

  renderHighlightsForVisibleEditors();
}

export function deactivate(): void {
  for (const decorationType of decorationTypes) {
    decorationType.dispose();
  }
}

function addHighlight(entryInput: Omit<HighlightEntry, 'patternIndex'> | HighlightEntry): void {
  const normalizedEntry = normalizeHighlightEntry(entryInput);
  const existingEntry = highlightStore.find((entry) => getHighlightEntryKey(entry) === getHighlightEntryKey(normalizedEntry));

  if (existingEntry) {
    return;
  }

  const usedPatternIndexes = new Set(highlightStore.map((entry) => entry.patternIndex));
  let patternIndex = -1;

  for (let index = 0; index < PATTERN_COUNT; index += 1) {
    if (!usedPatternIndexes.has(index)) {
      patternIndex = index;
      break;
    }
  }

  if (patternIndex === -1) {
    patternIndex = reuseStartIndexStore;
    const replaceIndex = highlightStore.findIndex((entry) => entry.patternIndex === patternIndex);
    if (replaceIndex >= 0) {
      highlightStore.splice(replaceIndex, 1);
    }

    reuseStartIndexStore = (patternIndex + 1) % PATTERN_COUNT;
  }

  highlightStore.push({
    ...normalizedEntry,
    patternIndex
  });

  highlightStore.sort((left, right) => left.patternIndex - right.patternIndex);
}

function removeHighlight(entryToRemove: HighlightEntry): void {
  const entryKey = getHighlightEntryKey(entryToRemove);
  const nextEntries = highlightStore.filter((entry) => getHighlightEntryKey(entry) !== entryKey);
  if (nextEntries.length === 0) {
    clearAllHighlights();
    return;
  }

  highlightStore.length = 0;
  highlightStore.push(...nextEntries);

  const selectedEntry = getSelectedHighlightedWord();
  if (selectedEntry && getHighlightEntryKey(selectedEntry) === entryKey) {
    selectedHighlightedWordStore = undefined;
  }
}

function clearAllHighlights(): void {
  highlightStore.length = 0;
  reuseStartIndexStore = 0;
  selectedHighlightedWordStore = undefined;
}

function getHighlightEntries(): HighlightEntry[] {
  return highlightStore;
}

function normalizeHighlightEntry(entry: Omit<HighlightEntry, 'patternIndex'> | HighlightEntry): Omit<HighlightEntry, 'patternIndex'> {
  return {
    caseSensitive: entry.caseSensitive,
    mode: entry.mode,
    query: entry.query
  };
}

function getHighlightEntryKey(entry: Omit<HighlightEntry, 'patternIndex'> | HighlightEntry): string {
  return `${entry.mode}:${entry.caseSensitive ? 'sensitive' : 'insensitive'}:${entry.query}`;
}

function getHighlightEntryDescription(entry: HighlightEntry, matchCount: number): string {
  const parts = [entry.mode === 'text' ? 'text' : entry.mode, entry.caseSensitive ? 'Aa' : 'aA', `${matchCount} matches`];
  return parts.join(' · ');
}

async function pickHighlightSearchMode(): Promise<HighlightSearchMode | undefined> {
  const options = [
    { label: 'Text', description: 'Match text anywhere', mode: 'text' as const },
    { label: 'Word', description: 'Match whole words only', mode: 'word' as const },
    { label: 'Regular Expression', description: 'Match with a regex pattern', mode: 'regex' as const }
  ];

  const selected = await showSingleSelectQuickPick(
    options,
    (item) => item.mode === inputHighlightDefaults.mode,
    'Choose how to search for the text'
  );

  return selected?.mode;
}

async function pickCaseSensitivity(): Promise<boolean | undefined> {
  const selected = await showSingleSelectQuickPick(
    [
      { label: 'Case-insensitive', value: false },
      { label: 'Case-sensitive', value: true }
    ],
    (item) => item.value === inputHighlightDefaults.caseSensitive,
    'Choose case sensitivity'
  );

  return selected?.value;
}

async function showSingleSelectQuickPick<T extends vscode.QuickPickItem>(
  items: T[],
  isDefault: (item: T) => boolean,
  placeHolder: string
): Promise<T | undefined> {
  const quickPick = vscode.window.createQuickPick<T>();

  quickPick.items = items;
  quickPick.placeholder = placeHolder;
  quickPick.ignoreFocusOut = true;

  const defaultItem = items.find(isDefault);
  if (defaultItem) {
    quickPick.activeItems = [defaultItem];
  }

  return new Promise<T | undefined>((resolve) => {
    const disposables: vscode.Disposable[] = [];

    const dispose = () => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
      quickPick.dispose();
    };

    disposables.push(
      quickPick.onDidAccept(() => {
        const [selectedItem] = quickPick.selectedItems.length > 0 ? quickPick.selectedItems : quickPick.activeItems;
        dispose();
        resolve(selectedItem);
      }),
      quickPick.onDidHide(() => {
        dispose();
        resolve(undefined);
      })
    );

    quickPick.show();
  });
}

function getSelectedHighlightedWord(): HighlightEntry | undefined {
  const entryKey = selectedHighlightedWordStore;
  if (!entryKey) {
    return undefined;
  }

  return getHighlightEntries().find((entry) => getHighlightEntryKey(entry) === entryKey);
}

function selectHighlightedWord(entry: HighlightEntry): void {
  selectedHighlightedWordStore = getHighlightEntryKey(entry);
}

function renderHighlightsForDocument(document: vscode.TextDocument): void {
  const entries = getHighlightEntries();
  const rangesByPattern = getVisibleRangesByPattern(document, entries);

  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document !== document) {
      continue;
    }

    for (let index = 0; index < PATTERN_COUNT; index += 1) {
      editor.setDecorations(decorationTypes[index], rangesByPattern.get(index) ?? []);
    }
  }
}

function renderHighlightsForVisibleEditors(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    renderHighlightsForDocument(editor.document);
  }
}

function getVisibleRangesByPattern(
  document: vscode.TextDocument,
  entries: HighlightEntry[]
): Map<number, vscode.Range[]> {
  const matchedRanges: MatchedHighlightRange[] = [];

  for (const entry of entries) {
    for (const range of findHighlightRanges(document, entry)) {
      matchedRanges.push({
        entry,
        patternIndex: entry.patternIndex,
        startOffset: document.offsetAt(range.start),
        endOffset: document.offsetAt(range.end),
        matchLength: document.offsetAt(range.end) - document.offsetAt(range.start)
      });
    }
  }

  matchedRanges.sort((left, right) => {
    const lengthDifference = left.matchLength - right.matchLength;
    if (lengthDifference !== 0) {
      return lengthDifference;
    }

    if (left.startOffset !== right.startOffset) {
      return left.startOffset - right.startOffset;
    }

    return left.patternIndex - right.patternIndex;
  });

  const occupiedRanges: Array<{ startOffset: number; endOffset: number }> = [];
  const rangesByPattern = new Map<number, vscode.Range[]>();

  for (const match of matchedRanges) {
    const visibleSegments = subtractOccupiedSegments(match.startOffset, match.endOffset, occupiedRanges);
    if (visibleSegments.length === 0) {
      continue;
    }

    const patternRanges = rangesByPattern.get(match.patternIndex) ?? [];
    for (const segment of visibleSegments) {
      patternRanges.push(new vscode.Range(document.positionAt(segment.startOffset), document.positionAt(segment.endOffset)));
      occupiedRanges.push(segment);
    }

    rangesByPattern.set(match.patternIndex, patternRanges);
    mergeOccupiedRanges(occupiedRanges);
  }

  return rangesByPattern;
}

function subtractOccupiedSegments(
  startOffset: number,
  endOffset: number,
  occupiedRanges: Array<{ startOffset: number; endOffset: number }>
): Array<{ startOffset: number; endOffset: number }> {
  let segments = [{ startOffset, endOffset }];

  for (const occupiedRange of occupiedRanges) {
    const nextSegments: Array<{ startOffset: number; endOffset: number }> = [];

    for (const segment of segments) {
      if (occupiedRange.endOffset <= segment.startOffset || occupiedRange.startOffset >= segment.endOffset) {
        nextSegments.push(segment);
        continue;
      }

      if (occupiedRange.startOffset > segment.startOffset) {
        nextSegments.push({
          startOffset: segment.startOffset,
          endOffset: occupiedRange.startOffset
        });
      }

      if (occupiedRange.endOffset < segment.endOffset) {
        nextSegments.push({
          startOffset: occupiedRange.endOffset,
          endOffset: segment.endOffset
        });
      }
    }

    segments = nextSegments;
    if (segments.length === 0) {
      break;
    }
  }

  return segments;
}

function mergeOccupiedRanges(occupiedRanges: Array<{ startOffset: number; endOffset: number }>): void {
  occupiedRanges.sort((left, right) => left.startOffset - right.startOffset);

  const mergedRanges: Array<{ startOffset: number; endOffset: number }> = [];
  for (const occupiedRange of occupiedRanges) {
    const lastRange = mergedRanges[mergedRanges.length - 1];
    if (!lastRange || occupiedRange.startOffset > lastRange.endOffset) {
      mergedRanges.push({ ...occupiedRange });
      continue;
    }

    lastRange.endOffset = Math.max(lastRange.endOffset, occupiedRange.endOffset);
  }

  occupiedRanges.length = 0;
  occupiedRanges.push(...mergedRanges);
}

function getWordAtCursor(editor: vscode.TextEditor): string | undefined {
  const selection = editor.selection.active;
  const range = editor.document.getWordRangeAtPosition(selection);

  if (!range) {
    return undefined;
  }

  return editor.document.getText(range);
}

function getSelectedOrCurrentWord(editor: vscode.TextEditor): string | undefined {
  const selectedText = editor.document.getText(editor.selection).trim();
  if (selectedText) {
    return selectedText;
  }

  return getWordAtCursor(editor);
}

function getHighlightEntryAtPosition(document: vscode.TextDocument, position: vscode.Position): HighlightEntry | undefined {
  const offset = document.offsetAt(position);
  const entries = getHighlightEntries();
  const matches = entries
    .flatMap((entry) =>
      findHighlightRanges(document, entry).map((range) => ({
        entry,
        matchLength: document.offsetAt(range.end) - document.offsetAt(range.start),
        patternIndex: entry.patternIndex,
        startOffset: document.offsetAt(range.start),
        endOffset: document.offsetAt(range.end)
      }))
    )
    .filter((match) => match.startOffset <= offset && offset < match.endOffset);

  matches.sort((left, right) => {
    const lengthDifference = left.matchLength - right.matchLength;
    if (lengthDifference !== 0) {
      return lengthDifference;
    }

    return left.patternIndex - right.patternIndex;
  });

  return matches[0]?.entry;
}

function jumpToNextRange(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
  const currentPosition = editor.selection.active;
  const nextRange = ranges.find((range) => range.start.isAfter(currentPosition)) ?? ranges[0];

  editor.selection = new vscode.Selection(nextRange.start, nextRange.end);
  editor.revealRange(nextRange, vscode.TextEditorRevealType.InCenter);
}

function findHighlightRanges(document: vscode.TextDocument, entry: HighlightEntry): vscode.Range[] {
  const text = document.getText();
  if (!entry.query) {
    return [];
  }

  if (entry.mode === 'regex') {
    const pattern = createSearchPattern(entry);
    if (!pattern) {
      return [];
    }

    return findRegexRanges(document, text, pattern);
  }

  const ranges: vscode.Range[] = [];
  let searchIndex = 0;
  const sourceText = entry.caseSensitive ? text : text.toLocaleLowerCase();
  const searchValue = entry.caseSensitive ? entry.query : entry.query.toLocaleLowerCase();

  while (searchIndex < text.length) {
    const matchIndex = sourceText.indexOf(searchValue, searchIndex);
    if (matchIndex === -1) {
      break;
    }

    const nextIndex = matchIndex + entry.query.length;
    if (entry.mode === 'word') {
      const previousCharacter = matchIndex > 0 ? text[matchIndex - 1] : undefined;
      const nextCharacter = nextIndex < text.length ? text[nextIndex] : undefined;
      if (!isWordBoundary(previousCharacter) || !isWordBoundary(nextCharacter)) {
        searchIndex = matchIndex + Math.max(entry.query.length, 1);
        continue;
      }
    }

    const start = document.positionAt(matchIndex);
    const end = document.positionAt(nextIndex);
    ranges.push(new vscode.Range(start, end));
    searchIndex = matchIndex + Math.max(entry.query.length, 1);
  }

  return ranges;
}

function createSearchPattern(entry: HighlightEntry): RegExp | undefined {
  try {
    const flags = entry.caseSensitive ? 'gu' : 'giu';
    return new RegExp(entry.query, flags);
  } catch {
    return undefined;
  }
}

function findRegexRanges(document: vscode.TextDocument, text: string, pattern: RegExp): vscode.Range[] {
  const ranges: vscode.Range[] = [];

  let match = pattern.exec(text);
  while (match) {
    const matchedText = match[0];
    if (matchedText.length === 0) {
      pattern.lastIndex += 1;
      match = pattern.exec(text);
      continue;
    }

    const start = document.positionAt(match.index);
    const end = document.positionAt(match.index + matchedText.length);
    ranges.push(new vscode.Range(start, end));
    match = pattern.exec(text);
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
  const nextDecorationTypes: vscode.TextEditorDecorationType[] = [];

  for (let index = 1; index <= PATTERN_COUNT; index += 1) {
    const definition = getPatternDefinition(index);
    const isOutlinePattern = index > PATTERN_COUNT / 2;

    nextDecorationTypes.push(vscode.window.createTextEditorDecorationType(getDecorationOptions(definition, isOutlinePattern)));
  }

  return nextDecorationTypes;
}

function getDecorationOptions(
  definition: PatternDefinition,
  isOutlinePattern: boolean
): vscode.DecorationRenderOptions {
  if (isOutlinePattern) {
    return {
      color: definition.foregroundColor,
      border: `2px solid ${definition.backgroundColor}`,
      borderRadius: '0'
    };
  }

  return {
    backgroundColor: definition.backgroundColor,
    color: definition.foregroundColor,
    borderRadius: '2px'
  };
}

function getPatternDefinition(index: number): PatternDefinition {
  const configuration = vscode.workspace.getConfiguration('casowaHighlight');
  const colorMode = configuration.get<'auto' | 'light' | 'dark'>('colorMode', 'auto');
  const paletteMode = resolvePaletteMode(colorMode);
  const colorIndex = ((index - 1) % COLOR_COUNT) + 1;

  return {
    backgroundColor: configuration.get<string>(
      `${paletteMode}.pattern${colorIndex}.backgroundColor`,
      paletteMode === 'light' ? '#FFF1A8' : '#7A6400'
    ),
    foregroundColor: configuration.get<string>(
      `${paletteMode}.pattern${colorIndex}.foregroundColor`,
      paletteMode === 'light' ? '#2B2200' : '#FFF8D6'
    )
  };
}

function resolvePaletteMode(colorMode: 'auto' | 'light' | 'dark'): 'light' | 'dark' {
  if (colorMode === 'light' || colorMode === 'dark') {
    return colorMode;
  }

  return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark';
}

function createHighlightIconUri(pattern: PatternDefinition): vscode.Uri {
  const label = 'A';
  const backgroundColor = escapeXml(pattern.backgroundColor);
  const foregroundColor = escapeXml(pattern.foregroundColor);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
    `<rect x="0.5" y="0.5" width="23" height="23" rx="4" fill="${backgroundColor}"/>`,
    `<text x="12" y="16" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${foregroundColor}">${label}</text>`,
    '</svg>'
  ].join('');

  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

class HighlightedWordsPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private webviewView: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.onDidReceiveMessage(
      async (message: {
        caseSensitive?: boolean;
        command?: string;
        entryKey?: string;
        mode?: HighlightSearchMode;
      }) => {
        const editor = vscode.window.activeTextEditor;

        if (message.command === 'selectWord' && message.entryKey) {
          if (!editor) {
            return;
          }
          await this.selectWord(message.entryKey);
          return;
        }

        if (message.command === 'jumpNext') {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.jumpToNextSelectedHighlightedWord');
          return;
        }

        if (message.command === 'copyWord' && message.entryKey) {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.copyHighlightedWord', message.entryKey);
          return;
        }

        if (message.command === 'copyAllWords') {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.copyAllHighlightedWords');
          return;
        }

        if (message.command === 'removeWord' && message.entryKey) {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.removeHighlightedWord', message.entryKey);
          return;
        }

        if (message.command === 'removeAllWords') {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.clearAllHighlights');
          return;
        }

        if (message.command === 'setDefaultMode' && message.mode) {
          inputHighlightDefaults = {
            ...inputHighlightDefaults,
            mode: message.mode
          };
          this.refresh();
          return;
        }

        if (message.command === 'setDefaultCaseSensitivity' && typeof message.caseSensitive === 'boolean') {
          inputHighlightDefaults = {
            ...inputHighlightDefaults,
            caseSensitive: message.caseSensitive
          };
          this.refresh();
        }
      },
      undefined,
      this.disposables
    );

    this.refresh();
  }

  refresh(): void {
    if (!this.webviewView) {
      return;
    }

    this.webviewView.webview.html = this.getHtml(this.webviewView.webview);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async selectWord(entryKey: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const entry = getHighlightEntries().find((item) => getHighlightEntryKey(item) === entryKey);
    if (!entry) {
      return;
    }

    const ranges = findHighlightRanges(editor.document, entry);
    if (ranges.length === 0) {
      vscode.window.showInformationMessage('The selected highlighted text was not found.');
      return;
    }

    selectHighlightedWord(entry);
    jumpToNextRange(editor, ranges);
    this.refresh();
  }

  private getHtml(webview: vscode.Webview): string {
    const editor = vscode.window.activeTextEditor;
    const nonce = getNonce();

    const controlsMarkup = `
      <div class="input-defaults">
        <span class="toolbar-group-label">Search options</span>
        <label class="toolbar-field">
          <span>Mode</span>
          <select id="default-mode">
            <option value="text"${inputHighlightDefaults.mode === 'text' ? ' selected' : ''}>Text</option>
            <option value="word"${inputHighlightDefaults.mode === 'word' ? ' selected' : ''}>Word</option>
            <option value="regex"${inputHighlightDefaults.mode === 'regex' ? ' selected' : ''}>Regex</option>
          </select>
        </label>
        <label class="toolbar-field">
          <span>Case</span>
          <select id="default-case">
            <option value="insensitive"${!inputHighlightDefaults.caseSensitive ? ' selected' : ''}>Insensitive</option>
            <option value="sensitive"${inputHighlightDefaults.caseSensitive ? ' selected' : ''}>Sensitive</option>
          </select>
        </label>
      </div>
    `;

    if (!editor) {
      return this.renderShell(
        webview,
        nonce,
        `
          <div class="panel">
            <div class="toolbar">
              ${controlsMarkup}
            </div>
            <div class="empty">Open a text editor to view highlighted text.</div>
          </div>
        `
      );
    }

    const entries = getHighlightEntries();
    const selectedEntry = getSelectedHighlightedWord();

    if (entries.length === 0) {
      return this.renderShell(
        webview,
        nonce,
        `
          <div class="panel">
            <div class="toolbar">
              ${controlsMarkup}
            </div>
            <div class="empty">No highlighted text in the active editor.</div>
          </div>
        `
      );
    }

    const chips = entries
      .map((entry) => {
        const pattern = getPatternDefinition(entry.patternIndex + 1);
        const matchCount = findHighlightRanges(editor.document, entry).length;
        const isSelected = selectedEntry ? getHighlightEntryKey(entry) === getHighlightEntryKey(selectedEntry) : false;
        const entryKey = getHighlightEntryKey(entry);

        return `
          <button
            class="chip${entry.patternIndex >= COLOR_COUNT ? ' outline' : ''}${isSelected ? ' selected' : ''}"
            data-entry-key="${escapeHtmlAttribute(entryKey)}"
            style="--chip-bg:${escapeHtmlAttribute(pattern.backgroundColor)}; --chip-fg:${escapeHtmlAttribute(
              pattern.foregroundColor
            )};"
            title="${escapeHtmlAttribute(`${entry.query} (${matchCount} matches)`)}"
          >
            <span class="chip-label">${escapeHtml(entry.query)}</span>
            <span class="chip-count">${matchCount}</span>
          </button>
        `;
      })
      .join('');

    const selectedMarkup = selectedEntry
      ? `<button class="next-button" data-command="jumpNext">Next: ${escapeHtml(selectedEntry.query)}</button>`
      : '<div class="hint">Select a text chip to start jumping through matches.</div>';

    const body = `
      <div class="panel">
        <div class="toolbar">
          ${controlsMarkup}
          ${selectedMarkup}
        </div>
        <div class="chip-row">${chips}</div>
      </div>
    `;

    return this.renderShell(webview, nonce, body);
  }

  private renderShell(webview: vscode.Webview, nonce: string, body: string): string {
    const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
        --border: rgba(127, 127, 127, 0.25);
        --muted: var(--vscode-descriptionForeground);
        --panel-bg: var(--vscode-panel-background);
      }

      body {
        margin: 0;
        padding: 8px 10px;
        min-height: 100vh;
        box-sizing: border-box;
        font-family: var(--vscode-font-family);
        background: var(--panel-bg);
        color: var(--vscode-foreground);
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      }

      .input-defaults {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .toolbar-group-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }

      .toolbar-field {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--muted);
      }

      .toolbar-field select {
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2px 4px;
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
      }

      .hint {
        font-size: 12px;
        color: var(--muted);
        text-align: right;
      }

      .next-button {
        border: 1px solid var(--border);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-foreground);
        border-radius: 999px;
        padding: 4px 9px;
        cursor: pointer;
        white-space: nowrap;
      }

      .next-button:hover {
        border-color: var(--vscode-focusBorder);
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 18px;
        max-width: 100%;
        border: 1px solid color-mix(in srgb, var(--chip-fg) 20%, transparent);
        border-radius: 0;
        padding: 2px 4px;
        background: var(--chip-bg);
        color: var(--chip-fg);
        cursor: pointer;
      }

      .chip.outline {
        border: 2px solid var(--chip-bg);
        background: transparent;
      }

      .chip.selected {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 1px;
      }

      .chip-label {
        font-weight: 700;
        line-height: 1.1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chip-count {
        border-radius: 0;
        padding: 0 4px;
        font-size: 10px;
        background: color-mix(in srgb, var(--chip-fg) 18%, transparent);
        color: inherit;
      }

      .chip.outline .chip-count {
        background: transparent;
        border-left: 1px solid color-mix(in srgb, var(--chip-bg) 45%, transparent);
      }

      .empty {
        color: var(--muted);
        padding: 6px 0;
      }

      .menu {
        position: fixed;
        z-index: 1000;
        width: max-content;
        display: flex;
        flex-direction: column;
        padding: 4px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--vscode-menu-background);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      }

      .menu[hidden] {
        display: none;
      }

      .menu-item {
        border: 0;
        border-radius: 6px;
        padding: 6px 8px;
        background: transparent;
        color: var(--vscode-menu-foreground);
        text-align: left;
        cursor: pointer;
      }

      .menu-item:hover {
        background: var(--vscode-menu-selectionBackground);
        color: var(--vscode-menu-selectionForeground);
      }
    </style>
  </head>
  <body>
    ${body}
    <div class="menu" id="context-menu" hidden>
      <button class="menu-item word-only" data-menu-command="copy">Copy</button>
      <button class="menu-item word-only" data-menu-command="remove">Remove highlight</button>
      <button class="menu-item word-only" data-menu-command="removeAll">Clear all highlights</button>
      <button class="menu-item empty-only" data-menu-command="copyAll">Copy all highlighted words</button>
      <button class="menu-item empty-only" data-menu-command="removeAll">Clear all highlights</button>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const menu = document.getElementById('context-menu');
      const panel = document.querySelector('.panel');
      const defaultMode = document.getElementById('default-mode');
      const defaultCase = document.getElementById('default-case');
      let menuWord = null;
      let menuMode = 'empty';

      const updateMenuItems = () => {
        for (const item of document.querySelectorAll('.menu-item')) {
          const isWordOnly = item.classList.contains('word-only');
          const isEmptyOnly = item.classList.contains('empty-only');
          item.hidden = (menuMode === 'word' && isEmptyOnly) || (menuMode === 'empty' && isWordOnly);
        }
      };

      const hideMenu = () => {
        menu.hidden = true;
        menuWord = null;
        menuMode = 'empty';
      };

      const showMenu = (x, y, mode, word) => {
        menuMode = mode;
        menuWord = word ?? null;
        updateMenuItems();
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.hidden = false;
      };

      for (const chip of document.querySelectorAll('.chip')) {
        chip.addEventListener('click', () => {
          hideMenu();
          vscode.postMessage({ command: 'selectWord', entryKey: chip.dataset.entryKey });
        });

        chip.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          showMenu(event.clientX, event.clientY, 'word', chip.dataset.entryKey);
        });
      }

      if (panel) {
        panel.addEventListener('contextmenu', (event) => {
          const chip = event.target.closest('.chip');
          if (chip) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          showMenu(event.clientX, event.clientY, 'empty');
        });
      }

      document.addEventListener('contextmenu', (event) => {
        if (event.target.closest('.chip') || event.target.closest('.menu')) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        showMenu(event.clientX, event.clientY, 'empty');
      });

      const nextButton = document.querySelector('.next-button');
      if (nextButton) {
        nextButton.addEventListener('click', () => {
          hideMenu();
          vscode.postMessage({ command: 'jumpNext' });
        });
      }

      if (defaultMode) {
        defaultMode.addEventListener('change', () => {
          vscode.postMessage({ command: 'setDefaultMode', mode: defaultMode.value });
        });
      }

      if (defaultCase) {
        defaultCase.addEventListener('change', () => {
          vscode.postMessage({
            command: 'setDefaultCaseSensitivity',
            caseSensitive: defaultCase.value === 'sensitive'
          });
        });
      }

      menu.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      menu.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      for (const item of document.querySelectorAll('.menu-item')) {
        item.addEventListener('click', (event) => {
          event.stopPropagation();

          if (!menuWord) {
            if (item.dataset.menuCommand !== 'copyAll' && item.dataset.menuCommand !== 'removeAll') {
              return;
            }
          }

          if (item.dataset.menuCommand === 'copy') {
            vscode.postMessage({ command: 'copyWord', entryKey: menuWord });
          }

          if (item.dataset.menuCommand === 'copyAll') {
            vscode.postMessage({ command: 'copyAllWords' });
          }

          if (item.dataset.menuCommand === 'remove') {
            vscode.postMessage({ command: 'removeWord', entryKey: menuWord });
          }

          if (item.dataset.menuCommand === 'removeAll') {
            vscode.postMessage({ command: 'removeAllWords' });
          }

          hideMenu();
        });
      }

      window.addEventListener('click', hideMenu);
      window.addEventListener('blur', hideMenu);
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          hideMenu();
        }
      });
    </script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  let value = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let index = 0; index < 16; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}
