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

type HighlightSnapshot = {
  entries: Array<HighlightEntry | Omit<HighlightEntry, 'patternIndex'> & { patternIndex?: number }>;
  version: 1;
};

type SavedHighlightSnapshot = {
  savedAt: string;
  snapshot: HighlightSnapshot;
};

type SavedHighlightSnapshotQuickPickItem = vscode.QuickPickItem & {
  snapshotRecord: SavedHighlightSnapshot;
};

type SaveHighlightSlotQuickPickItem = vscode.QuickPickItem & {
  targetIndex: number;
};

const HIGHLIGHT_SNAPSHOT_HISTORY_LIMIT = 5;
const HIGHLIGHT_SNAPSHOT_HISTORY_FILE_NAME = 'highlightSnapshotHistory.json';

const highlightEntriesStore: HighlightEntry[] = [];
let reuseStartIndexStore = 0;
let selectedHighlightEntryKeyStore: string | undefined;
let highlightDisplayEnabled = true;
let searchHighlightDefaults: InputHighlightDefaults = {
  caseSensitive: false,
  mode: 'text'
};
let decorationTypes: vscode.TextEditorDecorationType[] = [];

function resolveHighlightStorageUri(context: vscode.ExtensionContext): vscode.Uri | undefined {
  return context.storageUri ?? context.globalStorageUri;
}

export function activate(context: vscode.ExtensionContext): void {
  decorationTypes = createDecorationTypes();
  const getStorageUri = (): vscode.Uri | undefined => resolveHighlightStorageUri(context);
  const highlightPanelProvider = new HighlightPanelProvider(getStorageUri);
  const refreshDecorations = (): void => {
    for (const decorationType of decorationTypes) {
      decorationType.dispose();
    }

    decorationTypes = createDecorationTypes();

    renderHighlightsForVisibleEditors();
    highlightPanelProvider.refresh();
  };

  context.subscriptions.push(
    highlightPanelProvider,
    vscode.window.registerWebviewViewProvider(
      'casowa-highlighted-words-panel',
      highlightPanelProvider
    ),
    vscode.commands.registerCommand('casowaHighlight.addWordHighlight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selectedText = editor.document.getText(editor.selection).trim();
      const query = selectedText || getWordAtCursor(editor);
      if (!query) {
        vscode.window.showInformationMessage('No word is available to highlight.');
        return;
      }

      addHighlight({
        caseSensitive: true,
        mode: selectedText ? 'text' : 'word',
        query
      });
      renderHighlightsForVisibleEditors();
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.toggleHighlight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const existingEntry = getHighlightEntryAtPosition(editor.document, editor.selection.active);
      if (existingEntry) {
        removeHighlight(existingEntry);
      } else {
        const selectedText = editor.document.getText(editor.selection).trim();
        const query = selectedText || getWordAtCursor(editor);
        if (!query) {
          vscode.window.showInformationMessage('No word is available to toggle.');
          return;
        }

        addHighlight({
          caseSensitive: true,
          mode: selectedText ? 'text' : 'word',
          query
        });
      }

      renderHighlightsForVisibleEditors();
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.addSearchHighlight', async () => {
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

      searchHighlightDefaults = {
        caseSensitive,
        mode
      };

      addHighlight(entry);
      renderHighlightsForVisibleEditors();
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.removeHighlight', async () => {
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
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.clearAllHighlights', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      clearAllHighlights();
      renderHighlightsForVisibleEditors();
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.toggleDisplay', async () => {
      highlightDisplayEnabled = !highlightDisplayEnabled;
      renderHighlightsForVisibleEditors();
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.saveHighlights', async () => {
      await saveHighlightsToStorage(getStorageUri());
    }),
    vscode.commands.registerCommand('casowaHighlight.loadHighlights', async () => {
      const loaded = await loadHighlightsFromStorage(getStorageUri(), 'pick');
      if (!loaded) {
        return;
      }

      renderHighlightsForVisibleEditors();
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.selectHighlightedWord', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const entries = getHighlightEntries();
      if (entries.length === 0) {
        vscode.window.showInformationMessage('There are no highlights.');
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

      selectHighlight(selectedItem.entry);
      jumpToNextRange(editor, ranges);
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.showHighlightedPanel', async () => {
      await vscode.commands.executeCommand('casowa-highlighted-words-panel.focus');
    }),
    vscode.commands.registerCommand('casowaHighlight.nextHighlightedMatch', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selectedEntry = getSelectedHighlight();
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
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.previousHighlightedMatch', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selectedEntry = getSelectedHighlight();
      if (!selectedEntry) {
        vscode.window.showInformationMessage('No highlighted text is currently selected.');
        return;
      }

      const ranges = findHighlightRanges(editor.document, selectedEntry);
      if (ranges.length === 0) {
        vscode.window.showInformationMessage('The selected highlighted text was not found.');
        return;
      }

      jumpToPreviousRange(editor, ranges);
      highlightPanelProvider.refresh();
    }),
    vscode.commands.registerCommand('casowaHighlight.copyHighlightQuery', async (entryKey: string) => {
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
    vscode.commands.registerCommand('casowaHighlight.copyAllHighlightQueries', async () => {
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
    vscode.commands.registerCommand('casowaHighlight.removeStoredHighlight', async (entryKey: string) => {
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
      highlightPanelProvider.refresh();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (highlightEntriesStore.length > 0) {
        renderHighlightsForDocument(event.document);
        highlightPanelProvider.refresh();
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) {
        renderHighlightsForDocument(editor.document);
      }

      highlightPanelProvider.refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      highlightPanelProvider.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('casowaHighlight')) {
        return;
      }

      refreshDecorations();
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      const colorMode = vscode.workspace.getConfiguration('casowaHighlight').get<'auto' | 'light' | 'dark'>('colorMode', 'auto');
      if (colorMode !== 'auto') {
        return;
      }

      refreshDecorations();
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
  const existingEntry = highlightEntriesStore.find((entry) => getHighlightEntryKey(entry) === getHighlightEntryKey(normalizedEntry));

  if (existingEntry) {
    return;
  }

  const usedPatternIndexes = new Set(highlightEntriesStore.map((entry) => entry.patternIndex));
  let patternIndex = -1;

  for (let index = 0; index < PATTERN_COUNT; index += 1) {
    if (!usedPatternIndexes.has(index)) {
      patternIndex = index;
      break;
    }
  }

  if (patternIndex === -1) {
    patternIndex = reuseStartIndexStore;
    const replaceIndex = highlightEntriesStore.findIndex((entry) => entry.patternIndex === patternIndex);
    if (replaceIndex >= 0) {
      highlightEntriesStore.splice(replaceIndex, 1);
    }

    reuseStartIndexStore = (patternIndex + 1) % PATTERN_COUNT;
  }

  highlightEntriesStore.push({
    ...normalizedEntry,
    patternIndex
  });

  highlightEntriesStore.sort((left, right) => left.patternIndex - right.patternIndex);
}

function removeHighlight(entryToRemove: HighlightEntry): void {
  const entryKey = getHighlightEntryKey(entryToRemove);
  const nextEntries = highlightEntriesStore.filter((entry) => getHighlightEntryKey(entry) !== entryKey);
  if (nextEntries.length === 0) {
    clearAllHighlights();
    return;
  }

  highlightEntriesStore.length = 0;
  highlightEntriesStore.push(...nextEntries);

  const selectedEntry = getSelectedHighlight();
  if (selectedEntry && getHighlightEntryKey(selectedEntry) === entryKey) {
    selectedHighlightEntryKeyStore = undefined;
  }
}

function clearAllHighlights(): void {
  highlightEntriesStore.length = 0;
  reuseStartIndexStore = 0;
  selectedHighlightEntryKeyStore = undefined;
}

function getHighlightEntries(): HighlightEntry[] {
  return highlightEntriesStore;
}

function replaceHighlights(entries: Array<HighlightEntry | Omit<HighlightEntry, 'patternIndex'> & { patternIndex?: number }>): void {
  clearAllHighlights();

  const assignedPatternIndexes = new Set<number>();

  for (const entry of entries) {
    const normalizedEntry = normalizeHighlightEntry(entry);
    const requestedPatternIndex = typeof entry.patternIndex === 'number' ? entry.patternIndex : undefined;
    const canReuseRequestedPattern =
      requestedPatternIndex !== undefined &&
      requestedPatternIndex >= 0 &&
      requestedPatternIndex < PATTERN_COUNT &&
      !assignedPatternIndexes.has(requestedPatternIndex);

    if (canReuseRequestedPattern) {
      highlightEntriesStore.push({
        ...normalizedEntry,
        patternIndex: requestedPatternIndex
      });
      assignedPatternIndexes.add(requestedPatternIndex);
      continue;
    }

    addHighlight(normalizedEntry);
    const addedEntry = highlightEntriesStore.find((item) => getHighlightEntryKey(item) === getHighlightEntryKey(normalizedEntry));
    if (addedEntry) {
      assignedPatternIndexes.add(addedEntry.patternIndex);
    }
  }

  highlightEntriesStore.sort((left, right) => left.patternIndex - right.patternIndex);
}

function normalizeHighlightEntry(entry: Omit<HighlightEntry, 'patternIndex'> | HighlightEntry): Omit<HighlightEntry, 'patternIndex'> {
  return {
    caseSensitive: entry.caseSensitive,
    mode: entry.mode,
    query: entry.query
  };
}

function createHighlightSnapshot(): HighlightSnapshot {
  return {
    version: 1,
    entries: getHighlightEntries().map((entry) => ({ ...entry }))
  };
}

function isHighlightSearchMode(value: unknown): value is HighlightSearchMode {
  return value === 'text' || value === 'word' || value === 'regex';
}

function parseHighlightSnapshot(raw: unknown): HighlightSnapshot | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const snapshot = raw as { entries?: unknown; version?: unknown };
  if (snapshot.version !== 1 || !Array.isArray(snapshot.entries)) {
    return undefined;
  }

  const entries = snapshot.entries.flatMap((entry): HighlightSnapshot['entries'] => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const candidate = entry as {
      caseSensitive?: unknown;
      mode?: unknown;
      patternIndex?: unknown;
      query?: unknown;
    };

    if (typeof candidate.caseSensitive !== 'boolean' || !isHighlightSearchMode(candidate.mode) || typeof candidate.query !== 'string') {
      return [];
    }

    return [
      {
        caseSensitive: candidate.caseSensitive,
        mode: candidate.mode,
        patternIndex: typeof candidate.patternIndex === 'number' ? candidate.patternIndex : undefined,
        query: candidate.query
      }
    ];
  });

  return {
    version: 1,
    entries
  };
}

function parseSavedHighlightSnapshot(raw: unknown): SavedHighlightSnapshot | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const candidate = raw as { savedAt?: unknown; snapshot?: unknown };
  if (typeof candidate.savedAt !== 'string') {
    return undefined;
  }

  const snapshot = parseHighlightSnapshot(candidate.snapshot);
  if (!snapshot) {
    return undefined;
  }

  return {
    savedAt: candidate.savedAt,
    snapshot
  };
}

function encodeUtf8(value: string): Uint8Array {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];

  for (let index = 0; index < encoded.length; index += 1) {
    const character = encoded[index];
    if (character === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }

    bytes.push(character.charCodeAt(0));
  }

  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes: Uint8Array): string {
  const encoded = Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
  return decodeURIComponent(encoded);
}

function getHighlightSnapshotHistoryUri(storageUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(storageUri, HIGHLIGHT_SNAPSHOT_HISTORY_FILE_NAME);
}

async function getSavedHighlightSnapshotHistory(storageUri: vscode.Uri | undefined): Promise<SavedHighlightSnapshot[]> {
  if (!storageUri) {
    return [];
  }

  const historyUri = getHighlightSnapshotHistoryUri(storageUri);
  let rawHistory: unknown;

  try {
    const fileContent = await vscode.workspace.fs.readFile(historyUri);
    rawHistory = JSON.parse(decodeUtf8(fileContent));
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
      return [];
    }

    throw error;
  }

  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory.flatMap((entry) => {
    const snapshot = parseSavedHighlightSnapshot(entry);
    return snapshot ? [snapshot] : [];
  });
}

async function saveHighlightSnapshotHistory(storageUri: vscode.Uri, history: SavedHighlightSnapshot[]): Promise<void> {
  await vscode.workspace.fs.createDirectory(storageUri);
  const historyUri = getHighlightSnapshotHistoryUri(storageUri);
  const raw = `${JSON.stringify(history, null, 2)}\n`;
  await vscode.workspace.fs.writeFile(historyUri, encodeUtf8(raw));
}

async function openHighlightStorageFolder(storageUri: vscode.Uri | undefined): Promise<void> {
  if (!storageUri) {
    vscode.window.showInformationMessage('Highlight storage is not available.');
    return;
  }

  await vscode.workspace.fs.createDirectory(storageUri);
  await vscode.commands.executeCommand('revealFileInOS', storageUri);
}

function getSavedHighlightSnapshotSummary(snapshotRecord: SavedHighlightSnapshot): { description: string; detail: string } {
  const queries = snapshotRecord.snapshot.entries.map((entry) => entry.query);
  const preview = queries.slice(0, 3).join(', ');
  const remainingCount = Math.max(queries.length - 3, 0);

  return {
    description: `${snapshotRecord.snapshot.entries.length} highlights`,
    detail: remainingCount > 0 ? `${preview}, +${remainingCount} more` : preview
  };
}

async function pickHighlightSaveTarget(history: SavedHighlightSnapshot[]): Promise<number | undefined> {
  const items: SaveHighlightSlotQuickPickItem[] = Array.from({ length: HIGHLIGHT_SNAPSHOT_HISTORY_LIMIT }, (_, index) => {
    const existingSnapshot = history[index];
    if (!existingSnapshot) {
      return {
        label: `Slot ${index + 1}: Empty`,
        description: 'Unused slot',
        targetIndex: index
      };
    }

    const summary = getSavedHighlightSnapshotSummary(existingSnapshot);
    return {
      label: `Slot ${index + 1}: ${formatSavedHighlightSnapshot(existingSnapshot.savedAt)}`,
      description: summary.description,
      detail: summary.detail,
      targetIndex: index
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    ignoreFocusOut: true,
    placeHolder: 'Select a save slot to replace'
  });

  return selected?.targetIndex;
}

async function saveHighlightsToStorage(storageUri: vscode.Uri | undefined, mode: 'append' | 'pick' = 'append'): Promise<void> {
  if (!storageUri) {
    vscode.window.showInformationMessage('Highlight storage is not available.');
    return;
  }

  const snapshot = createHighlightSnapshot();
  if (snapshot.entries.length === 0) {
    vscode.window.showInformationMessage('There are no highlights to save.');
    return;
  }

  const history = await getSavedHighlightSnapshotHistory(storageUri);
  const nextSnapshot: SavedHighlightSnapshot = {
    savedAt: new Date().toISOString(),
    snapshot
  };
  let nextHistory: SavedHighlightSnapshot[];

  if (mode === 'pick') {
    const targetIndex = await pickHighlightSaveTarget(history);
    if (targetIndex === undefined) {
      return;
    }

    nextHistory = [nextSnapshot, ...history.filter((_, index) => index !== targetIndex)].slice(0, HIGHLIGHT_SNAPSHOT_HISTORY_LIMIT);
  } else {
    nextHistory = [nextSnapshot, ...history].slice(0, HIGHLIGHT_SNAPSHOT_HISTORY_LIMIT);
  }

  await saveHighlightSnapshotHistory(storageUri, nextHistory);
  vscode.window.showInformationMessage('Saved the current highlights.');
}

function formatSavedHighlightSnapshot(savedAt: string): string {
  const savedDate = new Date(savedAt);
  if (Number.isNaN(savedDate.getTime())) {
    return savedAt;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(savedDate);
}

async function pickSavedHighlightSnapshot(storageUri: vscode.Uri | undefined): Promise<SavedHighlightSnapshot | undefined> {
  const history = await getSavedHighlightSnapshotHistory(storageUri);
  if (history.length === 0) {
    vscode.window.showInformationMessage('There are no saved highlight states.');
    return undefined;
  }

  const items: SavedHighlightSnapshotQuickPickItem[] = history.map((snapshotRecord, index) => {
    const summary = getSavedHighlightSnapshotSummary(snapshotRecord);

    return {
      label: formatSavedHighlightSnapshot(snapshotRecord.savedAt),
      description: summary.description,
      detail: summary.detail,
      picked: index === 0,
      snapshotRecord
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    ignoreFocusOut: true,
    placeHolder: 'Select a saved highlight state to load'
  });

  return selected?.snapshotRecord;
}

async function getLatestSavedHighlightSnapshot(storageUri: vscode.Uri | undefined): Promise<SavedHighlightSnapshot | undefined> {
  const history = await getSavedHighlightSnapshotHistory(storageUri);
  if (history.length === 0) {
    vscode.window.showInformationMessage('There are no saved highlight states.');
    return undefined;
  }

  return history[0];
}

async function loadHighlightsFromStorage(storageUri: vscode.Uri | undefined, mode: 'latest' | 'pick'): Promise<boolean> {
  const snapshotRecord = mode === 'latest'
    ? await getLatestSavedHighlightSnapshot(storageUri)
    : await pickSavedHighlightSnapshot(storageUri);
  if (!snapshotRecord) {
    return false;
  }

  replaceHighlights(snapshotRecord.snapshot.entries);
  return true;
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
    (item) => item.mode === searchHighlightDefaults.mode,
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
    (item) => item.value === searchHighlightDefaults.caseSensitive,
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

function getSelectedHighlight(): HighlightEntry | undefined {
  const entryKey = selectedHighlightEntryKeyStore;
  if (!entryKey) {
    return undefined;
  }

  return getHighlightEntries().find((entry) => getHighlightEntryKey(entry) === entryKey);
}

function selectHighlight(entry: HighlightEntry): void {
  selectedHighlightEntryKeyStore = getHighlightEntryKey(entry);
}

function renderHighlightsForDocument(document: vscode.TextDocument): void {
  const entries = getHighlightEntries();
  const rangesByPattern = highlightDisplayEnabled ? getVisibleRangesByPattern(document, entries) : new Map<number, vscode.Range[]>();

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
  navigateToAdjacentRange(editor, ranges, 'next');
}

function jumpToPreviousRange(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
  navigateToAdjacentRange(editor, ranges, 'previous');
}

function navigateToAdjacentRange(
  editor: vscode.TextEditor,
  ranges: vscode.Range[],
  direction: 'next' | 'previous'
): void {
  const navigationTarget = getHighlightNavigationTarget(editor.selection, ranges, direction);
  editor.selection = new vscode.Selection(navigationTarget.start, navigationTarget.end);
  editor.revealRange(navigationTarget, vscode.TextEditorRevealType.InCenter);
}

function getHighlightNavigationTarget(
  selection: vscode.Selection,
  ranges: vscode.Range[],
  direction: 'next' | 'previous'
): vscode.Range {
  const exactIndex = getExactRangeIndex(selection, ranges);
  if (exactIndex >= 0) {
    return getAdjacentRange(ranges, exactIndex, direction);
  }

  const containingIndex = getContainingRangeIndex(selection, ranges);
  if (containingIndex >= 0) {
    return direction === 'next' ? getAdjacentRange(ranges, containingIndex, direction) : ranges[containingIndex];
  }

  if (direction === 'next') {
    return ranges.find((range) => range.start.isAfter(selection.active)) ?? ranges[0];
  }

  const previousRanges = ranges.filter((range) => range.start.isBefore(selection.start));
  return previousRanges.length > 0 ? previousRanges[previousRanges.length - 1] : ranges[ranges.length - 1];
}

function getExactRangeIndex(selection: vscode.Selection, ranges: vscode.Range[]): number {
  return ranges.findIndex((range) => range.start.isEqual(selection.start) && range.end.isEqual(selection.end));
}

function getAdjacentRange(ranges: vscode.Range[], currentIndex: number, direction: 'next' | 'previous'): vscode.Range {
  const offset = direction === 'next' ? 1 : -1;
  return ranges[(currentIndex + offset + ranges.length) % ranges.length];
}

function getContainingRangeIndex(selection: vscode.Selection, ranges: vscode.Range[]): number {
  const anchor = selection.start;
  return ranges.findIndex(
    (range) =>
      (range.start.isBefore(anchor) || range.start.isEqual(anchor)) &&
      (range.end.isAfter(anchor) || range.end.isEqual(anchor))
  );
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

function shouldShowPanelJumpButtons(): boolean {
  return vscode.workspace.getConfiguration('casowaHighlight').get<boolean>('showPanelJumpButtons', true);
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

class HighlightPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private webviewView: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly getStorageUri: () => vscode.Uri | undefined) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.onDidReceiveMessage(
      async (message: {
        caseSensitive?: boolean;
        command?: string;
        direction?: 'next' | 'previous';
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

        if (message.command === 'jumpEntry' && message.entryKey && message.direction) {
          if (!editor) {
            return;
          }
          await this.jumpToEntry(message.entryKey, message.direction);
          return;
        }

        if (message.command === 'copyWord' && message.entryKey) {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.copyHighlightQuery', message.entryKey);
          return;
        }

        if (message.command === 'copyAllWords') {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.copyAllHighlightQueries');
          return;
        }

        if (message.command === 'removeWord' && message.entryKey) {
          if (!editor) {
            return;
          }
          await vscode.commands.executeCommand('casowaHighlight.removeStoredHighlight', message.entryKey);
          return;
        }

        if (message.command === 'clearAllHighlights') {
          await vscode.commands.executeCommand('casowaHighlight.clearAllHighlights');
          return;
        }

        if (message.command === 'toggleDisplay') {
          await vscode.commands.executeCommand('casowaHighlight.toggleDisplay');
          return;
        }

        if (message.command === 'addSearchHighlight') {
          await vscode.commands.executeCommand('casowaHighlight.addSearchHighlight');
          return;
        }

        if (message.command === 'saveHighlights') {
          await vscode.commands.executeCommand('casowaHighlight.saveHighlights');
          return;
        }

        if (message.command === 'saveHighlightsToSlot') {
          await saveHighlightsToStorage(this.getStorageUri(), 'pick');
          return;
        }

        if (message.command === 'openHighlightStorageFolder') {
          await openHighlightStorageFolder(this.getStorageUri());
          return;
        }

        if (message.command === 'loadHighlights') {
          await vscode.commands.executeCommand('casowaHighlight.loadHighlights');
          return;
        }

        if (message.command === 'loadLatestHighlights') {
          const loaded = await loadHighlightsFromStorage(this.getStorageUri(), 'latest');
          if (!loaded) {
            return;
          }

          renderHighlightsForVisibleEditors();
          this.refresh();
          return;
        }

        if (message.command === 'setDefaultMode' && message.mode) {
          searchHighlightDefaults = {
            ...searchHighlightDefaults,
            mode: message.mode
          };
          this.refresh();
          return;
        }

        if (message.command === 'setDefaultCaseSensitivity' && typeof message.caseSensitive === 'boolean') {
          searchHighlightDefaults = {
            ...searchHighlightDefaults,
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

    selectHighlight(entry);
    jumpToNextRange(editor, ranges);
    this.refresh();
  }

  private async jumpToEntry(entryKey: string, direction: 'next' | 'previous'): Promise<void> {
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

    selectHighlight(entry);

    if (direction === 'previous') {
      jumpToPreviousRange(editor, ranges);
    } else {
      jumpToNextRange(editor, ranges);
    }

    this.refresh();
  }

  private getHtml(webview: vscode.Webview): string {
    const editor = vscode.window.activeTextEditor;
    const nonce = getNonce();
    const showPanelJumpButtons = shouldShowPanelJumpButtons();

    const controlsMarkup = `
      <div class="input-defaults">
        <span class="toolbar-group-label">Search options</span>
        <label class="toolbar-field">
          <span>Mode</span>
          <select id="default-mode">
            <option value="text"${searchHighlightDefaults.mode === 'text' ? ' selected' : ''}>Text</option>
            <option value="word"${searchHighlightDefaults.mode === 'word' ? ' selected' : ''}>Word</option>
            <option value="regex"${searchHighlightDefaults.mode === 'regex' ? ' selected' : ''}>Regex</option>
          </select>
        </label>
        <label class="toolbar-field">
          <span>Case</span>
          <select id="default-case">
            <option value="insensitive"${!searchHighlightDefaults.caseSensitive ? ' selected' : ''}>Insensitive</option>
            <option value="sensitive"${searchHighlightDefaults.caseSensitive ? ' selected' : ''}>Sensitive</option>
          </select>
        </label>
        <button class="toolbar-button" id="add-search-highlight" type="button">Add Search</button>
        <button class="toolbar-button" id="clear-all-highlights" type="button">Clear All</button>
        <label class="toolbar-toggle">
          <span>Enable:</span>
          <input id="highlight-display-enabled" type="checkbox"${highlightDisplayEnabled ? ' checked' : ''} />
        </label>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <button class="toolbar-button" id="save-highlights" type="button">Save</button>
        <button class="toolbar-button" id="load-highlights" type="button">Load</button>
      </div>
    `;

    if (!editor) {
      return this.renderShell(
        webview,
        nonce,
        `
          <div class="panel${showPanelJumpButtons ? '' : ' hide-jump-buttons'}">
            <div class="toolbar">
              ${controlsMarkup}
            </div>
            <div class="empty">Open a text editor to view highlighted text.</div>
          </div>
        `
      );
    }

    const entries = getHighlightEntries();
    const selectedEntry = getSelectedHighlight();

    if (entries.length === 0) {
      return this.renderShell(
        webview,
        nonce,
        `
          <div class="panel${showPanelJumpButtons ? '' : ' hide-jump-buttons'}">
            <div class="toolbar">
              ${controlsMarkup}
            </div>
            <div class="empty">No highlights.</div>
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
          <div
            class="chip-item${entry.patternIndex >= COLOR_COUNT ? ' outline' : ''}${isSelected ? ' selected' : ''}"
            style="--chip-bg:${escapeHtmlAttribute(pattern.backgroundColor)}; --chip-fg:${escapeHtmlAttribute(
              pattern.foregroundColor
            )};"
          >
            <button
              class="chip${entry.patternIndex >= COLOR_COUNT ? ' outline' : ''}${isSelected ? ' selected' : ''}"
              data-entry-key="${escapeHtmlAttribute(entryKey)}"
              title="${escapeHtmlAttribute(`${entry.query} (${matchCount} matches)`)}"
            >
              <span class="chip-label">${escapeHtml(entry.query)}</span>
              <span class="chip-count">${matchCount}</span>
            </button>
            <button class="chip-action" data-direction="previous" data-entry-key="${escapeHtmlAttribute(entryKey)}" title="Previous match">↑</button>
            <button class="chip-action" data-direction="next" data-entry-key="${escapeHtmlAttribute(entryKey)}" title="Next match">↓</button>
          </div>
        `;
      })
      .join('');

    const body = `
      <div class="panel${showPanelJumpButtons ? '' : ' hide-jump-buttons'}">
        <div class="toolbar">
          ${controlsMarkup}
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
        flex-wrap: wrap;
        gap: 8px;
      }

      .input-defaults {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .toolbar-divider {
        width: 1px;
        align-self: stretch;
        background: var(--border);
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

      .toolbar-toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--muted);
      }

      .toolbar-toggle input {
        margin: 0;
      }

      .toolbar-field select {
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2px 4px;
        min-height: 24px;
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        box-sizing: border-box;
      }

      .toolbar-button {
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2px 6px;
        min-height: 24px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        cursor: pointer;
        font-size: 11px;
        box-sizing: border-box;
      }

      .toolbar-button:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .chip-item {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        border: 1px solid color-mix(in srgb, var(--chip-fg) 20%, transparent);
        border-radius: 2px;
        background: var(--chip-bg);
      }

      .chip-item.outline {
        border: 2px solid var(--chip-bg);
        border-radius: 0;
        background: transparent;
      }

      .chip-item.selected {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 1px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 18px;
        max-width: 100%;
        border: 0;
        border-radius: 0;
        padding: 1px 3px;
        background: transparent;
        color: var(--chip-fg);
        font-size: var(--vscode-editor-font-size);
        cursor: pointer;
      }

      .chip.outline {
        background: transparent;
      }

      .chip.selected {
        outline: 0;
      }

      .chip-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-left: 1px solid color-mix(in srgb, var(--chip-fg) 18%, transparent);
        border-radius: 0;
        min-width: 18px;
        min-height: 18px;
        padding: 0 3px;
        background: color-mix(in srgb, var(--chip-fg) 18%, transparent);
        color: var(--chip-fg);
        cursor: pointer;
        font-size: calc(var(--vscode-editor-font-size) - 1px);
        line-height: 1;
        vertical-align: middle;
      }

      .chip-item:not(.outline) .chip-action:last-child {
        border-top-right-radius: 2px;
        border-bottom-right-radius: 2px;
      }

      .chip-action:hover {
        background: color-mix(in srgb, var(--chip-fg) 26%, transparent);
      }

      .panel.hide-jump-buttons .chip-action {
        display: none;
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
        padding: 0 3px;
        font-size: calc(var(--vscode-editor-font-size) - 1px);
        line-height: 1;
        background: color-mix(in srgb, var(--chip-fg) 18%, transparent);
        color: inherit;
      }

      .chip.outline .chip-count {
        background: transparent;
        border-left: 1px solid color-mix(in srgb, var(--chip-bg) 45%, transparent);
      }

      .chip-item.outline .chip-action {
        border-left-color: color-mix(in srgb, var(--chip-bg) 45%, transparent);
        background: transparent;
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
      <button class="menu-item empty-only" data-menu-command="copyAll">Copy all highlighted words</button>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const menu = document.getElementById('context-menu');
      const panel = document.querySelector('.panel');
      const defaultMode = document.getElementById('default-mode');
      const defaultCase = document.getElementById('default-case');
      const highlightDisplayEnabled = document.getElementById('highlight-display-enabled');
      const addSearchHighlightButton = document.getElementById('add-search-highlight');
      const saveHighlightsButton = document.getElementById('save-highlights');
      const loadHighlightsButton = document.getElementById('load-highlights');
      const clearAllHighlightsButton = document.getElementById('clear-all-highlights');
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
        chip.addEventListener('click', (event) => {
          hideMenu();
          if (event.shiftKey) {
            vscode.postMessage({
              command: 'jumpEntry',
              direction: 'previous',
              entryKey: chip.dataset.entryKey
            });
            return;
          }

          vscode.postMessage({ command: 'selectWord', entryKey: chip.dataset.entryKey });
        });

        chip.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          showMenu(event.clientX, event.clientY, 'word', chip.dataset.entryKey);
        });
      }

      for (const actionButton of document.querySelectorAll('.chip-action')) {
        actionButton.addEventListener('click', (event) => {
          event.stopPropagation();
          hideMenu();
          vscode.postMessage({
            command: 'jumpEntry',
            direction: actionButton.dataset.direction,
            entryKey: actionButton.dataset.entryKey
          });
        });

        actionButton.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
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

      if (highlightDisplayEnabled) {
        highlightDisplayEnabled.addEventListener('change', () => {
          vscode.postMessage({ command: 'toggleDisplay' });
        });

        highlightDisplayEnabled.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      }

      if (addSearchHighlightButton) {
        addSearchHighlightButton.addEventListener('click', () => {
          hideMenu();
          vscode.postMessage({ command: 'addSearchHighlight' });
        });

        addSearchHighlightButton.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      }

      if (saveHighlightsButton) {
        saveHighlightsButton.addEventListener('click', (event) => {
          hideMenu();
          if (event.shiftKey) {
            vscode.postMessage({ command: 'openHighlightStorageFolder' });
            return;
          }

          vscode.postMessage({ command: 'saveHighlights' });
        });

        saveHighlightsButton.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideMenu();
          vscode.postMessage({ command: 'saveHighlightsToSlot' });
        });
      }

      if (loadHighlightsButton) {
        loadHighlightsButton.addEventListener('click', () => {
          hideMenu();
          vscode.postMessage({ command: 'loadLatestHighlights' });
        });

        loadHighlightsButton.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideMenu();
          vscode.postMessage({ command: 'loadHighlights' });
        });
      }

      if (clearAllHighlightsButton) {
        clearAllHighlightsButton.addEventListener('click', () => {
          hideMenu();
          vscode.postMessage({ command: 'clearAllHighlights' });
        });

        clearAllHighlightsButton.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
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
            if (item.dataset.menuCommand !== 'copyAll') {
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
