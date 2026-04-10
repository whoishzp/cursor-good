import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ChatMessage } from './types';
import { appState } from './state';

function getWorkspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

export function initSession(): void {
  if (appState.sessionId) return;

  const root = getWorkspaceRoot();
  if (!root) return;

  const sessionId = crypto.randomUUID();
  const dir = path.join(root, 'cursor', 'data', 'cursor-good');

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }

  appState.sessionId    = sessionId;
  appState.sessionLogPath = path.join(dir, `session-id-${sessionId}.log`);
}

export function appendMessage(msg: ChatMessage): void {
  if (!appState.sessionLogPath) return;
  try {
    fs.appendFileSync(appState.sessionLogPath, JSON.stringify(msg) + '\n', 'utf8');
  } catch { /* ignore write errors */ }
}

export function readHistory(): ChatMessage[] {
  if (!appState.sessionLogPath) return [];
  try {
    const content = fs.readFileSync(appState.sessionLogPath, 'utf8');
    return content
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l) as ChatMessage);
  } catch {
    return [];
  }
}
