// Persistence layer for saved highlight snapshots and storage folder interactions.
import * as vscode from 'vscode';

import { HighlightEntry, HighlightSearchMode, getHighlightEntries, replaceHighlights } from './highlights';

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

export async function openHighlightStorageFolder(storageUri: vscode.Uri | undefined): Promise<void> {
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

// Saves the current in-memory highlights into snapshot history.
export async function saveHighlightsToStorage(storageUri: vscode.Uri | undefined, mode: 'append' | 'pick' = 'append'): Promise<void> {
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

// Loads a saved snapshot back into the in-memory highlight store.
export async function loadHighlightsFromStorage(storageUri: vscode.Uri | undefined, mode: 'latest' | 'pick'): Promise<boolean> {
  const snapshotRecord = mode === 'latest'
    ? await getLatestSavedHighlightSnapshot(storageUri)
    : await pickSavedHighlightSnapshot(storageUri);
  if (!snapshotRecord) {
    return false;
  }

  replaceHighlights(snapshotRecord.snapshot.entries);
  return true;
}
