// Extension entrypoint: wires VS Code commands/events to highlight, storage, and panel modules.
import * as vscode from 'vscode';

import { HighlightPanelProvider } from './HighlightPanelProvider';
import {
  HighlightEntry,
  HighlightQuickPickItem,
  addHighlight,
  clearAllHighlights,
  createHighlightIconUri,
  createSearchPattern,
  disposeDecorations,
  findHighlightRanges,
  getHighlightEntries,
  getHighlightEntryAtPosition,
  getHighlightEntryDescription,
  getHighlightEntryKey,
  getPatternDefinition,
  getSelectedHighlight,
  getWordAtCursor,
  initializeDecorations,
  jumpToNextRange,
  jumpToPreviousRange,
  pickCaseSensitivity,
  pickHighlightSearchMode,
  removeHighlight,
  renderHighlightsForDocument,
  renderHighlightsForVisibleEditors,
  recreateDecorations,
  selectHighlight,
  setSearchHighlightDefaults,
  toggleHighlightDisplay
} from './highlights';
import { loadHighlightsFromStorage, saveHighlightsToStorage } from './storage';

/**
 * Resolves the storage location used to persist saved highlight sets.
 */
function resolveHighlightStorageUri(context: vscode.ExtensionContext): vscode.Uri | undefined {
  return context.storageUri ?? context.globalStorageUri;
}

// Activates the extension and wires VS Code events/commands to the split modules.
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(...initializeDecorations());

  const getStorageUri = (): vscode.Uri | undefined => resolveHighlightStorageUri(context);
  const highlightPanelProvider = new HighlightPanelProvider({ getStorageUri });
  const refreshDecorations = (): void => {
    recreateDecorations();
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

      setSearchHighlightDefaults({
        caseSensitive,
        mode
      });

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
      toggleHighlightDisplay();
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
      if (getHighlightEntries().length > 0) {
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
    })
  );

  renderHighlightsForVisibleEditors();
}

// Releases editor decoration resources when the extension is deactivated.
export function deactivate(): void {
  disposeDecorations();
}
