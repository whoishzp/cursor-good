import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function autoRegisterMcp(port: number): void {
  try {
    const mcpPath  = path.join(os.homedir(), '.cursor', 'mcp.json');
    const cursorDir = path.dirname(mcpPath);

    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    let config: Record<string, unknown> = {};
    if (fs.existsSync(mcpPath)) {
      try {
        config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      } catch { /* malformed JSON — start fresh */ }
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      config.mcpServers = {};
    }
    const servers = config.mcpServers as Record<string, unknown>;

    const primaryEntry = { url: `http://localhost:${port}/mcp` };
    const existingPrimary = servers['cursor-good'] as { url?: string } | undefined;
    const hasLegacy = 'cursor-good-sse' in servers;

    let changed = false;
    if (!existingPrimary || existingPrimary.url !== primaryEntry.url) {
      servers['cursor-good'] = primaryEntry;
      changed = true;
    }
    if (hasLegacy) {
      delete servers['cursor-good-sse'];
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      vscode.window.showInformationMessage(
        `Cursor Good: MCP 已更新到 ~/.cursor/mcp.json (Streamable HTTP) — 重启 Cursor 后生效`
      );
    }
  } catch (e) {
    console.warn('[Cursor Good] Failed to auto-register MCP config:', e);
  }
}
