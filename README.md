# Cursor Good

**Inline interactive feedback panel for Cursor IDE — fully standalone, no external MCP server needed.**

> 作者 / Author: WhoIsHzp

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

### 2. Add the Cursor Rule to your project

Create `.cursor/rules/cursor-good.mdc` in your project root and paste the rule below.

<details>
<summary>📋 <strong>Cursor Rule — click to expand & copy</strong></summary>

```markdown
---
description: Cursor Good — mandatory interactive feedback
alwaysApply: true
---

# Interactive Feedback 强制规则

## 核心要求

1. **每次完成阶段性任务前**，必须调用 `CursorGood` 工具向用户确认。
2. **每次收到用户消息后**，如需澄清或确认，使用 `CursorGood` 代替直接回复。
3. **禁止连续执行超过 3 步**操作而不调用一次 `CursorGood`。
4. 若用户反馈内容非空，必须再次调用 `CursorGood`。
5. 仅当用户明确说"结束"或"不再需要交互"时，才可停止调用。

## 图片处理

- 用户通过 `CursorGood` 粘贴的图片，必须仔细分析并在后续步骤中参考。

## 工具调用规范

调用 `CursorGood` 时：
- `message`: 清晰描述当前状态和问题
- `predefined_options`: 提供 2–4 个常见选项（可选）

### 示例

\`\`\`
CursorGood({
  "message": "已完成 XXX 功能，请确认是否符合预期？",
  "predefined_options": ["符合预期，继续", "需要调整", "暂停"]
})
\`\`\`
```

</details>

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `cursorFeedback.port` | `3722` | HTTP port for the embedded MCP server |

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

## License

MIT
