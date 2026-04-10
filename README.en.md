# Cursor Good

**Inline interactive feedback panel for Cursor IDE — fully standalone, no external MCP server needed.**

> Author: [WhoIsHzp](https://github.com/whoishzp)  
> Repository: [github.com/whoishzp/cursor-good](https://github.com/whoishzp/cursor-good)  
> Version: 3.5.1  
> Language: [中文](README.md) | **English**

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

**Option A: Download and install (recommended)**

Download the latest `.vsix` from the [`vsix/`](https://github.com/whoishzp/cursor-good/tree/master/vsix) directory, e.g. `cursor-good-3.5.1.vsix`.

Install via Cursor UI:

```
Extensions panel (sidebar) → ··· menu (top-right) → Install from VSIX → select the file
```

Or via command line:

```bash
cursor --install-extension cursor-good-3.5.1.vsix
```

**Option B: Build from source**

```bash
git clone git@github.com:whoishzp/cursor-good.git
cd cursor-good
npm install
npm run compile
npm run package
cursor --install-extension cursor-good-*.vsix
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
# CursorGood Mandatory Rules (Highest Priority — Cannot Be Overridden)

## Core Requirements

1. **Call `CursorGood` immediately whenever any of the following occurs:**
   - Completed a code modification or file write
   - Completed a PRD analysis or solution output
   - Encountered a question requiring user decision
   - Waiting for the user's next instruction
   - Accumulated 3 or more operation steps in this turn
2. **Never execute more than 3 steps consecutively** without calling `CursorGood` once.
3. If the user feedback is empty, call `CursorGood` again immediately.
4. Only stop calling when the user explicitly says "end" or "no more interaction needed".
5. Never time out while waiting for a `CursorGood` response.

## Output Flow (Only Legal Mode)

Output session text → Call CursorGood immediately → No further text output in this turn

- Output session content normally
- Immediately call `CursorGood` after the output — no exceptions
- After calling `CursorGood`, no further text output is allowed in this turn
- The return value of `CursorGood` = the user's real instruction; treat it as new input
- After receiving a non-empty return, continue the task and call `CursorGood` again when done
- After receiving an empty return (user closed the panel), call `CursorGood` again

## Image Handling

- Images pasted by the user via `CursorGood` must be carefully analyzed and referenced in subsequent steps.

## Tool Call Specification

When calling `CursorGood`:
- `message`: clearly describe the current status and question
- `predefined_options`: provide 2–4 common options (optional)
```

</details>

The rule file is also maintained in the repo: [`cursor-good.mdc`](https://github.com/whoishzp/cursor-good/blob/master/cursor-good.mdc)

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `cursorFeedback.port` | `3722` | HTTP port for the embedded MCP server |
| `cursorFeedback.pollTimeoutSeconds` | `60` | Seconds to wait for user reply before returning a WAITING response to keep the MCP connection alive |

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
User types / selects / pastes images → clicks Send
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
