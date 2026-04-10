import * as vscode from 'vscode';
import * as http from 'http';
import { Session, PendingCall, ActivePrompt } from './types';

export const sessions    = new Map<string, Session>();
export const pendingCalls = new Map<string, PendingCall>();

/**
 * Mutable singleton. All modules share this reference; mutate fields in-place
 * so CommonJS imports always see the latest value.
 */
export const appState = {
  httpServer:       null as http.Server | null,
  feedbackPanel:    null as vscode.WebviewPanel | null,
  extensionCtx:     null as vscode.ExtensionContext | null,
  activePrompt:     null as ActivePrompt | null,
  reopenScheduled:  false,
  sessionId:        null as string | null,
  sessionLogPath:   null as string | null,
};
