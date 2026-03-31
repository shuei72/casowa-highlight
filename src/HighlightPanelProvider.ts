// Webview provider for the Highlight panel UI and its message handling.
import * as vscode from 'vscode';

import {
  COLOR_COUNT,
  HighlightSearchMode,
  findHighlightRanges,
  getHighlightDisplayEnabled,
  getHighlightEntries,
  getHighlightEntryKey,
  getPatternDefinition,
  getSearchHighlightDefaults,
  getSelectedHighlight,
  jumpToNextRange,
  jumpToPreviousRange,
  renderHighlightsForVisibleEditors,
  selectHighlight,
  setSearchHighlightDefaults,
  shouldShowPanelJumpButtons
} from './highlights';
import { loadHighlightsFromStorage, openHighlightStorageFolder, saveHighlightsToStorage } from './storage';

type HighlightPanelProviderOptions = {
  getStorageUri: () => vscode.Uri | undefined;
};

// Owns the highlight panel webview UI and routes its messages back into extension actions.
export class HighlightPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private webviewView: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly options: HighlightPanelProviderOptions) {}

  // Initializes the webview and subscribes to messages coming from the panel UI.
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
          await saveHighlightsToStorage(this.options.getStorageUri(), 'pick');
          return;
        }

        if (message.command === 'openHighlightStorageFolder') {
          await openHighlightStorageFolder(this.options.getStorageUri());
          return;
        }

        if (message.command === 'loadHighlights') {
          await vscode.commands.executeCommand('casowaHighlight.loadHighlights');
          return;
        }

        if (message.command === 'loadLatestHighlights') {
          const loaded = await loadHighlightsFromStorage(this.options.getStorageUri(), 'latest');
          if (!loaded) {
            return;
          }

          renderHighlightsForVisibleEditors();
          this.refresh();
          return;
        }

        if (message.command === 'setDefaultMode' && message.mode) {
          setSearchHighlightDefaults({
            ...getSearchHighlightDefaults(),
            mode: message.mode
          });
          this.refresh();
          return;
        }

        if (message.command === 'setDefaultCaseSensitivity' && typeof message.caseSensitive === 'boolean') {
          setSearchHighlightDefaults({
            ...getSearchHighlightDefaults(),
            caseSensitive: message.caseSensitive
          });
          this.refresh();
        }
      },
      undefined,
      this.disposables
    );

    this.refresh();
  }

  // Rebuilds the panel HTML from the current editor and highlight state.
  refresh(): void {
    if (!this.webviewView) {
      return;
    }

    this.webviewView.webview.html = this.getHtml(this.webviewView.webview);
  }

  // Cleans up event subscriptions owned by the panel provider.
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
    const defaults = getSearchHighlightDefaults();

    const controlsMarkup = `
      <div class="input-defaults">
        <span class="toolbar-group-label">Search options</span>
        <label class="toolbar-field">
          <span>Mode</span>
          <select id="default-mode">
            <option value="text"${defaults.mode === 'text' ? ' selected' : ''}>Text</option>
            <option value="word"${defaults.mode === 'word' ? ' selected' : ''}>Word</option>
            <option value="regex"${defaults.mode === 'regex' ? ' selected' : ''}>Regex</option>
          </select>
        </label>
        <label class="toolbar-field">
          <span>Case</span>
          <select id="default-case">
            <option value="insensitive"${!defaults.caseSensitive ? ' selected' : ''}>Insensitive</option>
            <option value="sensitive"${defaults.caseSensitive ? ' selected' : ''}>Sensitive</option>
          </select>
        </label>
        <button class="toolbar-button" id="add-search-highlight" type="button">Add Search</button>
        <button class="toolbar-button" id="clear-all-highlights" type="button">Clear All</button>
        <label class="toolbar-toggle">
          <span>Enable:</span>
          <input id="highlight-display-enabled" type="checkbox"${getHighlightDisplayEnabled() ? ' checked' : ''} />
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
            <button class="chip-action" data-direction="previous" data-entry-key="${escapeHtmlAttribute(entryKey)}" title="Previous match">&#x2039;</button>
            <button class="chip-action" data-direction="next" data-entry-key="${escapeHtmlAttribute(entryKey)}" title="Next match">&#x203A;</button>
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
