import * as http from 'http';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { JsonRpcRequest } from './types';
import { appState, sessions } from './state';
import { corsHeaders } from './utils';
import { handleRpc } from './rpc';

export function startMcpServer(port: number): void {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    // ── CORS preflight ──
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Transport A: Streamable HTTP (MCP 2025-03-26)  →  POST /mcp
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === 'POST' && url.pathname === '/mcp') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const rpc = JSON.parse(body) as JsonRpcRequest;

          // Notifications: accept and return 202, no body
          if (rpc.id === undefined || rpc.id === null || rpc.method.startsWith('notifications/')) {
            handleRpc(rpc, '').catch(() => { /* ignore */ });
            res.writeHead(202, corsHeaders());
            res.end();
            return;
          }

          // tools/call may block waiting for user — always stream via SSE
          // Other calls: prefer JSON unless client explicitly wants SSE
          const acceptsSSE = (req.headers['accept'] ?? '').includes('text/event-stream');
          const needsStream = rpc.method === 'tools/call' || acceptsSSE;

          if (needsStream) {
            res.writeHead(200, {
              ...corsHeaders(),
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });

            // L1: TCP socket — disable idle timeout, enable OS-level keepalive
            if (res.socket) {
              res.socket.setTimeout(0);
              res.socket.setKeepAlive(true, 10_000);
              res.socket.setNoDelay(true);
            }

            // L2: SSE application-level heartbeat (comment frames)
            const keepAlive = setInterval(() => {
              try {
                if (!res.writableEnded && !res.writableFinished) {
                  res.write(': ping\n\n');
                } else {
                  clearInterval(keepAlive);
                }
              } catch {
                clearInterval(keepAlive);
              }
            }, 10_000);

            // L4: cleanup on client disconnect
            req.on('close', () => clearInterval(keepAlive));

            let response;
            try {
              response = await handleRpc(rpc, 'streamable');
            } finally {
              clearInterval(keepAlive);
            }

            if (response && !res.writableEnded) {
              res.write(`data: ${JSON.stringify(response)}\n\n`);
            }
            if (!res.writableEnded) {
              res.end();
            }
          } else {
            const response = await handleRpc(rpc, 'streamable');
            res.writeHead(200, {
              ...corsHeaders(),
              'Content-Type': 'application/json',
            });
            res.end(JSON.stringify(response ?? { jsonrpc: '2.0', id: rpc.id, result: {} }));
          }
        } catch (e) {
          console.error('[Cursor Good] Streamable HTTP error', e);
          res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad request' }));
        }
      });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Transport A (cont.): Streamable HTTP SSE channel  →  GET /mcp
    // MCP 2025-03-26 requires GET /mcp for server-to-client notifications.
    // Cursor opens this after initialize; 404 here triggers session_invalidated loop.
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === 'GET' && url.pathname === '/mcp') {
      const sessionId = (req.headers['mcp-session-id'] as string) || crypto.randomUUID();

      res.writeHead(200, {
        ...corsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Mcp-Session-Id': sessionId,
      });

      // Keep connection alive; CursorGood has no server-initiated events to push.
      const keepAlive = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
      }, 15000);

      req.on('close', () => clearInterval(keepAlive));
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Transport B: Legacy SSE (MCP 2024-11-05)  →  GET /sse + POST /message
    // ════════════════════════════════════════════════════════════════════════

    // ── SSE channel: GET /sse ──
    if (req.method === 'GET' && url.pathname === '/sse') {
      const sessionId = crypto.randomUUID();

      res.writeHead(200, {
        ...corsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const write = (event: string, data: string) => {
        try { res.write(`event: ${event}\ndata: ${data}\n\n`); } catch { /* disconnected */ }
      };

      sessions.set(sessionId, { id: sessionId, write });
      write('endpoint', JSON.stringify(`/message?sessionId=${sessionId}`));

      req.on('close', () => sessions.delete(sessionId));
      return;
    }

    // ── JSON-RPC channel: POST /message?sessionId=xxx ──
    if (req.method === 'POST' && url.pathname === '/message') {
      const sessionId = url.searchParams.get('sessionId') ?? '';
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        res.writeHead(202, corsHeaders()); // response delivered via SSE
        res.end();

        try {
          const rpc = JSON.parse(body) as JsonRpcRequest;
          const response = await handleRpc(rpc, sessionId);
          if (response) {
            sessions.get(sessionId)?.write('message', JSON.stringify(response));
          }
        } catch (e) {
          console.error('[Cursor Good] SSE RPC error', e);
        }
      });
      return;
    }

    res.writeHead(404, corsHeaders());
    res.end('Not found');
  });

  appState.httpServer = server;

  // L3: HTTP server global — no server-side timeouts
  server.timeout = 0;
  server.requestTimeout = 0;
  server.keepAliveTimeout = 0;

  server.listen(port, '127.0.0.1');

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      vscode.window.showWarningMessage(
        `Cursor Good: Port ${port} already in use. Change cursorFeedback.port in settings.`
      );
    }
  });
}
