# Cursor Good

**Inline interactive feedback panel for Cursor IDE — fully standalone, no external MCP server needed.**

> Author: [WhoIsHzp](https://github.com/whoishzp)  
> Repository: [github.com/whoishzp/cursor-good](https://github.com/whoishzp/cursor-good)  
> Version: 3.5.1

---

## Features

- **Inline feedback panel** — replaces pop-up dialogs with a native Cursor side panel
- **Predefined option buttons** — quick-reply choices rendered as clickable buttons
- **Image paste** — paste images via `Ctrl+V` or click the 📎 button
- **Multi-line text input** — `Ctrl+Enter` to send
- **Fully standalone** — no Python, no external MCP server, everything is bundled

---

## Quick Start (2 steps)

### 1. Install the Extension

Install `cursor-good-*.vsix` via Cursor:

```
Extensions panel → ··· menu → Install from VSIX → select the file
```

**On first activation, the extension automatically writes to `~/.cursor/mcp.json`.**  
Restart Cursor once — the `CursorGood` tool is ready, no manual config needed.

> If you want to use a custom port, change `cursorFeedback.port` in Cursor settings  
> and the MCP entry will be updated automatically on next activation.

### 2. Add the Cursor Rule to Your Project

Create `.cursor/rules/cursor-good.mdc` in your project root and paste the rule below.

<details>
<summary>📋 <strong>cursor-good.mdc — click to expand & copy</strong></summary>

```markdown
# CursorGood 强制规则（最高优先级，任何规则不得覆盖）

## 核心要求

1. **每次完成以下任一情况**，必须立即调用 `CursorGood` 工具：
   - 完成一段代码修改或文件写入
   - 完成 PRD 分析或方案输出
   - 遇到疑问需用户决策
   - 等待用户下一步指令
   - 本 turn 操作步骤累计达到 3 步
2. **禁止连续执行超过 3 步**操作而不调用一次 `CursorGood`。
3. 若用户反馈内容为空，必须再次调用 `CursorGood`。
4. 仅当用户明确说"结束"或"不再需要交互"时，才可停止调用。
5. 未收到 `CursorGood` 反馈时，永不超时。

## 输出流程（唯一合法模式）

session 输出正文 → 立即调用 CursorGood → 本 turn 内不得再输出任何文本

- 正文内容在 session 中正常输出
- 正文结束后**必须紧接**调用 `CursorGood`，不得遗漏
- 调用 `CursorGood` 后，本 turn 内禁止再输出任何其他文本
- `CursorGood` 返回值 = 用户的真实指令，必须作为新的 user input 继续处理
- 收到非空返回值后，基于该指令继续执行任务，完成后再次调用 `CursorGood`
- 收到空返回值（用户关闭面板）时，必须再次调用 `CursorGood`

## 图片处理

- 用户通过 `CursorGood` 粘贴的图片，必须仔细分析并在后续步骤中参考。

## 工具调用规范

调用 `CursorGood` 时：
- `message`: 清晰描述当前状态和问题
- `predefined_options`: 提供 2–4 个常见选项（可选）
```

</details>

The rule file is also available in the repo at [`cursor-good.mdc`](https://github.com/whoishzp/cursor-good/blob/master/cursor-good.mdc).

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `cursorFeedback.port` | `3722` | HTTP port for the embedded MCP server |
| `cursorFeedback.pollTimeoutSeconds` | `60` | Seconds to wait for user reply before returning a WAITING response |

---

## How It Works

```
Cursor AI
  │
  │  MCP tools/call → CursorGood
  ▼
http://localhost:3722/sse  ← embedded in this VS Code extension
  │
  │  opens VS Code WebviewPanel
  ▼
User types / selects / pastes images → clicks 发送
  │
  ▼
MCP tools/call response → back to Cursor AI
```

The extension embeds a full **MCP SSE server** — when Cursor calls the `CursorGood` tool, a native Cursor side panel appears with your input form. No Python, no extra processes.

---

## Development

```bash
git clone git@github.com:whoishzp/cursor-good.git
cd cursor-good
npm install
npm run compile
```

Package as `.vsix`:

```bash
npm run package
```

---

## License

MIT
