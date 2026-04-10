/**
 * Cursor Good — Standalone Interactive Feedback Extension
 * Author: WhoIsHzp
 *
 * Dual-transport MCP server embedded in the extension:
 *   - Streamable HTTP (MCP 2025-03-26): POST /mcp   ← Cursor 0.45+ / 2.x
 *   - Legacy SSE      (MCP 2024-11-05): GET  /sse   ← older clients
 *
 * mcp.json registration uses /mcp (Streamable HTTP) as primary.
 * Cursor connects via: { "cursor-good": { "url": "http://localhost:3722/mcp" } }
 */

import * as vscode from 'vscode';
import { appState, pendingCalls } from './state';
import { getPort } from './utils';
import { startMcpServer } from './server';
import { autoRegisterMcp } from './mcp-register';
import { createPanel, registerEditorGuard } from './panel';

export function activate(context: vscode.ExtensionContext) {
  appState.extensionCtx = context;
  const port = getPort();
  startMcpServer(port);
  autoRegisterMcp(port);

  registerEditorGuard(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorFeedback.showPanel', () => {
      if (appState.activePrompt && pendingCalls.has(appState.activePrompt.callId)) {
        if (!appState.feedbackPanel) {
          createPanel(appState.activePrompt);
        } else {
          appState.feedbackPanel.reveal(vscode.ViewColumn.Beside, true);
        }
      }
    })
  );
}

export function deactivate() {
  appState.httpServer?.close();
}
