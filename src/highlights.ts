// Core highlight state and behavior: entries, search/match logic, navigation, and editor decorations.
import * as vscode from 'vscode';

export const PATTERN_COUNT = 16;
export const COLOR_COUNT = 8;

export type PatternDefinition = {
  backgroundColor: string;
  foregroundColor: string;
};

export type HighlightSearchMode = 'text' | 'word' | 'regex';

export type HighlightEntry = {
  caseSensitive: boolean;
  mode: HighlightSearchMode;
  patternIndex: number;
  query: string;
};

export type HighlightQuickPickItem = vscode.QuickPickItem & {
  entry: HighlightEntry;
};

type MatchedHighlightRange = {
  endOffset: number;
  matchLength: number;
  patternIndex: number;
  startOffset: number;
};

export type InputHighlightDefaults = {
  caseSensitive: boolean;
  mode: HighlightSearchMode;
};

const highlightEntriesStore: HighlightEntry[] = [];
let reuseStartIndexStore = 0;
let selectedHighlightEntryKeyStore: string | undefined;
let highlightDisplayEnabled = true;
let searchHighlightDefaults: InputHighlightDefaults = {
  caseSensitive: false,
  mode: 'text'
};
let decorationTypes: vscode.TextEditorDecorationType[] = [];

// Creates the initial decoration types used to render highlights in visible editors.
export function initializeDecorations(): vscode.TextEditorDecorationType[] {
  decorationTypes = createDecorationTypes();
  return decorationTypes;
}

// Rebuilds decoration types after theme or configuration changes.
export function recreateDecorations(): vscode.TextEditorDecorationType[] {
  disposeDecorations();
  decorationTypes = createDecorationTypes();
  return decorationTypes;
}

// Disposes all decoration types currently owned by the highlight module.
export function disposeDecorations(): void {
  for (const decorationType of decorationTypes) {
    decorationType.dispose();
  }

  decorationTypes = [];
}

// Returns whether highlight rendering is currently enabled.
export function getHighlightDisplayEnabled(): boolean {
  return highlightDisplayEnabled;
}

// Toggles whether highlights are shown in editors.
export function toggleHighlightDisplay(): void {
  highlightDisplayEnabled = !highlightDisplayEnabled;
}

// Returns the defaults used by the search-highlight input flow.
export function getSearchHighlightDefaults(): InputHighlightDefaults {
  return searchHighlightDefaults;
}

// Updates the defaults used by the search-highlight input flow.
export function setSearchHighlightDefaults(defaults: InputHighlightDefaults): void {
  searchHighlightDefaults = defaults;
}

// Adds a highlight entry and assigns a pattern slot if it is new.
export function addHighlight(entryInput: Omit<HighlightEntry, 'patternIndex'> | HighlightEntry): void {
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

// Removes one highlight entry and clears selection if that entry was selected.
export function removeHighlight(entryToRemove: HighlightEntry): void {
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

// Clears all highlights and resets related in-memory state.
export function clearAllHighlights(): void {
  highlightEntriesStore.length = 0;
  reuseStartIndexStore = 0;
  selectedHighlightEntryKeyStore = undefined;
}

// Returns the current in-memory highlight entries.
export function getHighlightEntries(): HighlightEntry[] {
  return highlightEntriesStore;
}

// Replaces all highlights, reusing stored pattern assignments when possible.
export function replaceHighlights(entries: Array<HighlightEntry | Omit<HighlightEntry, 'patternIndex'> & { patternIndex?: number }>): void {
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

export function getHighlightEntryKey(entry: Omit<HighlightEntry, 'patternIndex'> | HighlightEntry): string {
  return `${entry.mode}:${entry.caseSensitive ? 'sensitive' : 'insensitive'}:${entry.query}`;
}

// Builds the quick-pick summary text for a highlight entry.
export function getHighlightEntryDescription(entry: HighlightEntry, matchCount: number): string {
  const parts = [entry.mode === 'text' ? 'text' : entry.mode, entry.caseSensitive ? 'Aa' : 'aA', `${matchCount} matches`];
  return parts.join(' · ');
}

// Prompts the user for the search mode used to create a highlight.
export async function pickHighlightSearchMode(): Promise<HighlightSearchMode | undefined> {
  const defaults = getSearchHighlightDefaults();
  const options = [
    { label: 'Text', description: 'Match text anywhere', mode: 'text' as const },
    { label: 'Word', description: 'Match whole words only', mode: 'word' as const },
    { label: 'Regular Expression', description: 'Match with a regex pattern', mode: 'regex' as const }
  ];

  const selected = await showSingleSelectQuickPick(
    options,
    (item) => item.mode === defaults.mode,
    'Choose how to search for the text'
  );

  return selected?.mode;
}

// Prompts the user for whether matching should be case-sensitive.
export async function pickCaseSensitivity(): Promise<boolean | undefined> {
  const defaults = getSearchHighlightDefaults();
  const selected = await showSingleSelectQuickPick(
    [
      { label: 'Case-insensitive', value: false },
      { label: 'Case-sensitive', value: true }
    ],
    (item) => item.value === defaults.caseSensitive,
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

export function getSelectedHighlight(): HighlightEntry | undefined {
  const entryKey = selectedHighlightEntryKeyStore;
  if (!entryKey) {
    return undefined;
  }

  return getHighlightEntries().find((entry) => getHighlightEntryKey(entry) === entryKey);
}

// Marks a highlight as the current navigation target.
export function selectHighlight(entry: HighlightEntry): void {
  selectedHighlightEntryKeyStore = getHighlightEntryKey(entry);
}

// Re-renders highlight decorations for one document across visible editors.
export function renderHighlightsForDocument(document: vscode.TextDocument): void {
  const entries = getHighlightEntries();
  const rangesByPattern = highlightDisplayEnabled ? getVisibleRangesByPattern(document, entries) : new Map<number, vscode.Range[]>();

  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document !== document) {
      continue;
    }

    for (let index = 0; index < PATTERN_COUNT; index += 1) {
      const decorationType = decorationTypes[index];
      if (decorationType) {
        editor.setDecorations(decorationType, rangesByPattern.get(index) ?? []);
      }
    }
  }
}

// Re-renders highlight decorations for all currently visible editors.
export function renderHighlightsForVisibleEditors(): void {
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

// Reads the word under the active cursor position.
export function getWordAtCursor(editor: vscode.TextEditor): string | undefined {
  const selection = editor.selection.active;
  const range = editor.document.getWordRangeAtPosition(selection);

  if (!range) {
    return undefined;
  }

  return editor.document.getText(range);
}

// Returns the highest-priority highlight covering the given position.
export function getHighlightEntryAtPosition(document: vscode.TextDocument, position: vscode.Position): HighlightEntry | undefined {
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

// Moves the selection to the next match for a highlight.
export function jumpToNextRange(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
  navigateToAdjacentRange(editor, ranges, 'next');
}

// Moves the selection to the previous match for a highlight.
export function jumpToPreviousRange(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
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

// Finds all ranges in a document matched by a highlight entry.
export function findHighlightRanges(document: vscode.TextDocument, entry: HighlightEntry): vscode.Range[] {
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

// Creates a RegExp for regex highlights when the query is valid.
export function createSearchPattern(entry: HighlightEntry): RegExp | undefined {
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

// Reads whether the panel should show previous/next jump buttons.
export function shouldShowPanelJumpButtons(): boolean {
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

// Resolves the configured colors for one highlight pattern slot.
export function getPatternDefinition(index: number): PatternDefinition {
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

// Creates the quick-pick icon used to preview a highlight pattern.
export function createHighlightIconUri(pattern: PatternDefinition): vscode.Uri {
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
