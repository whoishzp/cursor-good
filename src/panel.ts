import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ActivePrompt, FeedbackResult } from './types';
import { appState, pendingCalls } from './state';
import { buildWebviewHtml } from './webview';
import { escHtml } from './utils';
import { initSession, appendMessage, readHistory } from './session';

export const WAITING_SENTINEL = '__WAITING__';

function getPollTimeoutMs(): number {
  const seconds = vscode.workspace.getConfiguration('cursorFeedback').get<number>('pollTimeoutSeconds', 60);
  return Math.max(5, Math.min(300, seconds)) * 1000;
}

let bufferedResult: FeedbackResult | null = null;

/** Guard: move text editors that land in the CursorGood column back to group 1. */
export function registerEditorGuard(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      const panel = appState.feedbackPanel;
      if (!editor || !panel) { return; }
      const hasPrompt = appState.activePrompt && pendingCalls.has(appState.activePrompt.callId);
      if (!hasPrompt) { return; }
      // Layer 1: viewColumn match
      if (editor.viewColumn && panel.viewColumn && editor.viewColumn === panel.viewColumn) {
        await vscode.commands.executeCommand('workbench.action.moveEditorToFirstGroup');
        try { panel.reveal(panel.viewColumn, true); } catch {}
        return;
      }
      // Layer 2: panel became invisible → something covered it
      if (!panel.visible) {
        await vscode.commands.executeCommand('workbench.action.moveEditorToFirstGroup');
        try { panel.reveal(vscode.ViewColumn.Beside, true); } catch {}
      }
    })
  );
}

/** Create / rebuild the feedback panel. */
export function createPanel(prompt: ActivePrompt): vscode.WebviewPanel {
  initSession();

  const panel = vscode.window.createWebviewPanel(
    'cursorGood',
    'Cursor Good · 待回复',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [appState.extensionCtx!.extensionUri],
    }
  );
  appState.feedbackPanel = panel;

  // Pin the tab to prevent preview-mode file replacement
  setTimeout(async () => {
    try {
      panel.reveal(panel.viewColumn || vscode.ViewColumn.Beside, false);
      await vscode.commands.executeCommand('workbench.action.pinEditor');
      await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    } catch { /* pinEditor not available */ }
  }, 300);

  const history = readHistory();
  panel.webview.html = buildWebviewHtml(
    prompt.callId, prompt.message, prompt.options, prompt.iconDataUrl, history
  );

  // Layer 3: auto-recover when panel becomes invisible
  panel.onDidChangeViewState(async (e) => {
    if (!e.webviewPanel.visible && appState.activePrompt && pendingCalls.has(appState.activePrompt.callId)) {
      await vscode.commands.executeCommand('workbench.action.moveEditorToFirstGroup');
      try { e.webviewPanel.reveal(vscode.ViewColumn.Beside, true); } catch {}
    }
  });

  panel.onDidDispose(() => {
    if (appState.feedbackPanel !== panel) { return; }
    appState.feedbackPanel = null;
    if (appState.activePrompt && pendingCalls.has(appState.activePrompt.callId)) {
      resolvePendingCall(appState.activePrompt.callId, '', []);
    }
  });

  panel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'submit') {
      resolvePendingCall(msg.callId, msg.text ?? '', msg.images ?? []);
    }
  });

  return panel;
}

export function promptUser(message: string, options: string[]): Promise<FeedbackResult> {
  // 1. Consume buffered result (user responded between timeout and re-poll)
  if (bufferedResult) {
    const result = bufferedResult;
    bufferedResult = null;
    return Promise.resolve(result);
  }

  // 2. Re-poll: active prompt still waiting → re-subscribe with fresh timeout
  if (appState.activePrompt && pendingCalls.has(appState.activePrompt.callId)) {
    const callId = appState.activePrompt.callId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const pending = pendingCalls.get(callId);
        if (pending) {
          pending.resolve = (val: FeedbackResult) => { bufferedResult = val; };
        }
        resolve({ CursorGood: WAITING_SENTINEL, images: [] });
      }, getPollTimeoutMs());

      const pending = pendingCalls.get(callId)!;
      pending.resolve = (val: FeedbackResult) => {
        clearTimeout(timer);
        resolve(val);
      };
    });
  }

  // 3. New prompt (original flow + timeout)
  for (const [oldId, pending] of pendingCalls) {
    pending.resolve({ CursorGood: '', images: [] });
    pendingCalls.delete(oldId);
  }
  appState.activePrompt = null;

  return new Promise((resolve) => {
    const callId = crypto.randomUUID();

    const timer = setTimeout(() => {
      const pending = pendingCalls.get(callId);
      if (pending) {
        pending.resolve = (val: FeedbackResult) => { bufferedResult = val; };
      }
      resolve({ CursorGood: WAITING_SENTINEL, images: [] });
    }, getPollTimeoutMs());

    pendingCalls.set(callId, {
      sessionId: '',
      rpcId: null,
      resolve: (val: FeedbackResult) => {
        clearTimeout(timer);
        resolve(val);
      },
    });

    let iconDataUrl = '';
    try {
      const iconPath = path.join(appState.extensionCtx!.extensionUri.fsPath, 'media', 'icon.png');
      const iconBytes = fs.readFileSync(iconPath);
      iconDataUrl = `data:image/png;base64,${iconBytes.toString('base64')}`;
    } catch { /* icon not found */ }

    appState.activePrompt = { callId, message, options, iconDataUrl };

    initSession();
    appendMessage({ role: 'ai', text: message, options, callId, ts: Date.now() });

    const existingPanel = appState.feedbackPanel;
    if (existingPanel) {
      try {
        existingPanel.webview.postMessage({
          type: 'newPrompt', callId,
          message: escHtml(message),
          options: options.map(o => escHtml(o)),
          iconDataUrl, ts: Date.now(),
        });
        existingPanel.reveal(vscode.ViewColumn.Beside, true);
      } catch {
        appState.feedbackPanel = null;
        const panel = createPanel(appState.activePrompt!);
        panel.reveal(vscode.ViewColumn.Beside, true);
      }
    } else {
      const panel = createPanel(appState.activePrompt!);
      panel.reveal(vscode.ViewColumn.Beside, true);
    }
  });
}

export function resolvePendingCall(callId: string, text: string, images: string[]): void {
  const pending = pendingCalls.get(callId);
  if (pending) {
    pendingCalls.delete(callId);
    appState.activePrompt = null;
    if (text) {
      appendMessage({ role: 'user', text, images, ts: Date.now() });
    }
    pending.resolve({ CursorGood: text, images });
  }
}
