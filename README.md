# Cursor Good

**Cursor IDE 内联交互反馈面板插件 — 完全独立运行，无需外部 MCP 服务。**

> 作者：[WhoIsHzp](https://github.com/whoishzp)  
> 仓库：[github.com/whoishzp/cursor-good](https://github.com/whoishzp/cursor-good)  
> 版本：3.5.1  
> 语言：**中文** | [English](README.en.md)

---

## 功能特性

- **内联反馈面板** — 用原生 Cursor 侧边面板替代弹出式对话框
- **预定义选项按钮** — 常用回复渲染为可点击按钮，一键快速回复
- **图片粘贴** — 支持 `Ctrl+V` 或点击 📎 按钮粘贴图片
- **多行文本输入** — `Ctrl+Enter` 发送
- **完全独立** — 无需 Python、无需外部 MCP 服务，全部内置

---

## 快速开始（2 步）

### 第 1 步：安装扩展

**方式一：直接下载安装（推荐）**

从仓库 [`vsix/`](https://github.com/whoishzp/cursor-good/tree/master/vsix) 目录下载最新版本的 `.vsix` 文件，例如 `cursor-good-3.5.1.vsix`。

在 Cursor 中安装：

```
扩展面板（左侧栏） → 点击右上角 ··· 菜单 → 从 VSIX 安装 → 选择下载的 .vsix 文件
```

也可通过命令行安装：

```bash
cursor --install-extension cursor-good-3.5.1.vsix
```

**方式二：从源码编译**

```bash
git clone git@github.com:whoishzp/cursor-good.git
cd cursor-good
npm install
npm run compile
npm run package
cursor --install-extension cursor-good-*.vsix
```

**首次激活时，扩展会自动写入 `~/.cursor/mcp.json`。**  
重启 Cursor 一次 — `CursorGood` 工具即可使用，无需手动配置。

> 如需自定义端口，在 Cursor 设置中修改 `cursorFeedback.port`，  
> 下次激活时 MCP 配置项会自动更新。

### 第 2 步：在项目中添加 Cursor 规则

在项目根目录创建 `.cursor/rules/cursor-good.mdc`，粘贴以下规则内容。

<details>
<summary>📋 <strong>cursor-good.mdc — 点击展开并复制</strong></summary>

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

规则文件同步维护于仓库：[`cursor-good.mdc`](https://github.com/whoishzp/cursor-good/blob/master/cursor-good.mdc)

---

## 配置项

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `cursorFeedback.port` | `3722` | 内嵌 MCP 服务的本地 HTTP 端口 |
| `cursorFeedback.pollTimeoutSeconds` | `60` | 等待用户回复的最大秒数，超时后返回 WAITING 保持连接存活 |

---

## 工作原理

```
Cursor AI
  │
  │  MCP tools/call → CursorGood
  ▼
http://localhost:3722/sse  ← 内嵌于本扩展
  │
  │  打开 VS Code WebviewPanel
  ▼
用户输入文字 / 选择选项 / 粘贴图片 → 点击发送
  │
  ▼
MCP tools/call response → 返回给 Cursor AI
```

本扩展内嵌完整的 **MCP SSE 服务端** — 当 Cursor 调用 `CursorGood` 工具时，原生 Cursor 侧边面板弹出输入表单。无 Python，无额外进程。

---

## 开发

```bash
git clone git@github.com:whoishzp/cursor-good.git
cd cursor-good
npm install
npm run compile
```

打包为 `.vsix`：

```bash
npm run package
```

---

## License

MIT
