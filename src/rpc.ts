import { JsonRpcRequest, JsonRpcResponse } from './types';
import { promptUser, WAITING_SENTINEL } from './panel';

export async function handleRpc(
  rpc: JsonRpcRequest,
  sessionId: string
): Promise<JsonRpcResponse | null> {
  switch (rpc.method) {
    case 'initialize': {
      const clientVersion =
        ((rpc.params as Record<string, unknown>)?.protocolVersion as string) ?? '2024-11-05';
      const supportedVersions = ['2025-03-26', '2024-11-05'];
      const negotiated = supportedVersions.includes(clientVersion)
        ? clientVersion
        : '2024-11-05';
      return {
        jsonrpc: '2.0',
        id: rpc.id,
        result: {
          protocolVersion: negotiated,
          capabilities: { tools: {} },
          serverInfo: { name: 'cursor-good', version: '1.0.0' },
        },
      };
    }

    case 'notifications/initialized':
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: rpc.id,
        result: {
          tools: [
            {
              name: 'CursorGood',
              description:
                'Request interactive feedback from the user via an inline Cursor panel. ' +
                'Supports text input, predefined option buttons, and image paste.\n\n' +
                'CRITICAL AGENT BEHAVIOR RULES:\n' +
                '1. After calling this tool, you MUST read the returned text as the user\'s actual instruction.\n' +
                '2. NEVER output a final text response that ignores the returned value.\n' +
                '3. If the returned text is non-empty, treat it as a new user message and continue the task accordingly.\n' +
                '4. If the returned text is empty (user closed the panel), call CursorGood again.\n' +
                '5. ALWAYS call CursorGood again after completing each phase of work.\n' +
                '6. If the returned text contains "WAITING_FOR_USER", the user has not replied yet. ' +
                'You MUST immediately call CursorGood again with the same parameters. Do NOT output any text.',
              inputSchema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    description: 'The question or message to show the user',
                  },
                  predefined_options: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional quick-reply buttons',
                  },
                  project_path: { type: 'string' },
                  project_name: { type: 'string' },
                  git_branch: { type: 'string' },
                  priority: { type: 'number' },
                  category: { type: 'string' },
                  context_data: { type: 'object' },
                },
                required: ['message'],
              },
            },
          ],
        },
      };

    case 'tools/call': {
      const params = rpc.params as {
        name: string;
        arguments: {
          message: string;
          predefined_options?: string[];
        };
      };

      if (params.name !== 'CursorGood') {
        return {
          jsonrpc: '2.0',
          id: rpc.id,
          error: { code: -32601, message: `Unknown tool: ${params.name}` },
        };
      }

      const result = await promptUser(
        params.arguments.message,
        params.arguments.predefined_options ?? []
      );

      if (result.CursorGood === WAITING_SENTINEL) {
        return {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            content: [{
              type: 'text',
              text: [
                '╔══════════════════════════════════════╗',
                '║  ⏳ WAITING_FOR_USER                  ║',
                '╚══════════════════════════════════════╝',
                '',
                '用户尚未回复，面板仍在等待中。',
                '',
                '⚠️  AGENT MANDATORY ACTION:',
                '  1. 不要输出任何文本给用户',
                '  2. 立即再次调用 CursorGood（使用相同参数）',
                '  3. 这是正常的轮询机制，不是错误',
              ].join('\n'),
            }],
          },
        };
      }

      const callerInfo = '🖱️ **调用来源**: CURSOR';
      let text: string;
      if (result.CursorGood) {
        text = [
          '╔══════════════════════════════════════╗',
          '║  ⚡ USER_INSTRUCTION_RECEIVED         ║',
          '╚══════════════════════════════════════╝',
          '',
          `用户输入: ${result.CursorGood}`,
          '',
          '⚠️  AGENT MANDATORY ACTION:',
          '  1. STOP — discard any pre-planned response text',
          '  2. Process the user input above as the real instruction',
          '  3. Execute the task based on this input',
          '  4. Call CursorGood again when phase is complete',
          '',
          callerInfo,
        ].join('\n');
      } else {
        text = [
          '╔══════════════════════════════════════╗',
          '║  ⚠️  EMPTY_FEEDBACK                  ║',
          '╚══════════════════════════════════════╝',
          '',
          '用户未输入内容，必须立即再次调用 CursorGood。',
          '',
          callerInfo,
        ].join('\n');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [{ type: 'text', text }];
      for (const b64 of result.images) {
        content.push({ type: 'image', data: b64, mimeType: 'image/png' });
      }

      return {
        jsonrpc: '2.0',
        id: rpc.id,
        result: { content },
      };
    }

    case 'ping':
      return { jsonrpc: '2.0', id: rpc.id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id: rpc.id,
        error: { code: -32601, message: `Method not found: ${rpc.method}` },
      };
  }
}
