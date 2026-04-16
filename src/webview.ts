import { escHtml } from './utils';
import { ChatMessage } from './types';

export function buildWebviewHtml(
  callId: string,
  message: string,
  options: string[],
  iconUri: string,
  history: ChatMessage[] = []
): string {
  const optionsJson = JSON.stringify(options.map(o => escHtml(o)));
  const escapedMessage = escHtml(message);
  // history includes all previous messages; the current message is already appended
  // filter out the current callId to avoid duplicate rendering
  const historyJson = JSON.stringify(
    history
      .filter(m => m.callId !== callId)
      .map(m => ({
        role: m.role,
        text: m.role === 'ai' ? escHtml(m.text) : m.text,
        options: (m.options || []).map(o => escHtml(o)),
        images: m.images || [],
        callId: m.callId || '',
        ts: m.ts || 0,
      }))
  );

  return /* html */ `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root {
    --bg:        var(--vscode-editor-background);
    --fg:        var(--vscode-editor-foreground);
    --input-bg:  var(--vscode-input-background);
    --input-fg:  var(--vscode-input-foreground);
    --input-bd:  var(--vscode-input-border, #555);
    --btn-bg:    var(--vscode-button-background);
    --btn-fg:    var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --opt-bg:    var(--vscode-button-secondaryBackground);
    --opt-fg:    var(--vscode-button-secondaryForeground);
    --opt-hover: var(--vscode-button-secondaryHoverBackground);
    --border:    var(--vscode-panel-border, #444);
    --ai-bubble: var(--vscode-textBlockQuote-background, rgba(128,128,128,.12));
    --radius:    6px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    font-size: 13px;
    background: var(--bg);
    color: var(--fg);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    border-left: 2px solid var(--vscode-editorGroup-border, var(--border));
  }

  /* ── header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
            border: 2px solid var(--btn-bg); flex-shrink: 0; }
  .h-title { font-size: 13px; font-weight: 700; }
  .h-sub   { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 1px; }

  /* ── chat area ── */
  .chat-area {
    flex: 1 1 0;
    max-height: 50vh;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .chat-area::-webkit-scrollbar { width: 4px; }
  .chat-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* ── message row ── */
  .msg-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  .msg-row.ai   { flex-direction: row; }
  .msg-row.user { flex-direction: row; justify-content: flex-end; }

  /* ── avatars ── */
  .msg-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; overflow: hidden;
  }
  .msg-avatar.ai-av img { width: 28px; height: 28px; object-fit: cover; border-radius: 50%; }
  .msg-avatar.user-av {
    background: var(--btn-bg); color: var(--btn-fg);
    font-size: 11px; font-weight: 700; letter-spacing: 0;
  }

  /* ── bubbles ── */
  .msg-content {
    max-width: 75%;
    display: flex;
    flex-direction: column;
  }
  .msg-time {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-top: 3px;
    padding: 0 4px;
  }
  .msg-row.ai .msg-time { text-align: left; }
  .msg-row.user .msg-time { text-align: right; }

  .bubble {
    padding: 10px 14px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 13px;
    background: var(--ai-bubble);
    border: 1px solid var(--border);
  }
  .msg-row.ai .bubble {
    border-radius: 0 12px 12px 12px;
  }
  .msg-row.user .bubble {
    border-radius: 12px 0 12px 12px;
  }
  .bubble-imgs {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
  }
  .bubble-imgs img {
    width: 80px; height: 80px; object-fit: cover;
    border-radius: 4px; border: 1px solid var(--border);
  }

  /* ── pending badge ── */
  .pending-badge {
    display: inline-block;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--ai-bubble);
  }

  /* ── input section ── */
  .input-section {
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    padding: 10px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* options bar */
  .options { display: flex; flex-wrap: wrap; gap: 6px; }
  .opt-btn {
    background: var(--opt-bg); border: 1px solid var(--border); color: var(--opt-fg, var(--fg));
    border-radius: var(--radius); padding: 4px 12px; cursor: pointer; font-size: 12px;
    transition: background .15s;
  }
  .opt-btn:hover { background: var(--opt-hover, #555); }

  textarea {
    width: 100%; min-height: 80px; max-height: 160px;
    background: var(--input-bg); color: var(--input-fg);
    border: 1px solid var(--input-bd); border-radius: var(--radius);
    padding: 8px 10px; font-family: inherit; font-size: 13px;
    resize: vertical; outline: none; transition: border-color .15s;
  }
  textarea:focus { border-color: var(--btn-bg); }

  /* image strip */
  #image-strip { display: flex; flex-wrap: wrap; gap: 6px; }
  .thumb-wrap { position: relative; width: 56px; height: 56px; }
  .thumb-wrap img { width: 56px; height: 56px; object-fit: cover;
                    border-radius: 4px; border: 1px solid var(--border); }
  .del-btn {
    position: absolute; top: -5px; right: -5px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #e05050; color: #fff; border: none;
    cursor: pointer; font-size: 10px; line-height: 16px; text-align: center; padding: 0;
  }

  /* toolbar */
  .toolbar { display: flex; align-items: center; gap: 8px; }
  .icon-btn {
    background: var(--opt-bg); border: 1px solid var(--border); color: var(--fg);
    border-radius: var(--radius); padding: 5px 10px; cursor: pointer; font-size: 12px;
    display: flex; align-items: center; gap: 4px; transition: background .15s; white-space: nowrap;
  }
  .icon-btn:hover { background: var(--opt-hover, #555); }
  .spacer { flex: 1; }
  .hint { font-size: 11px; color: var(--vscode-descriptionForeground); }
  .send-btn {
    background: var(--btn-bg); color: var(--btn-fg); border: none;
    border-radius: var(--radius); padding: 6px 20px;
    font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s;
    white-space: nowrap;
  }
  .send-btn:hover  { background: var(--btn-hover); }
  .send-btn:disabled { opacity: .45; cursor: default; }
</style>
</head>
<body>

<div class="header">
  ${iconUri ? `<img class="avatar" src="${iconUri}" alt="">` : ''}
  <div>
    <div class="h-title">Cursor Good</div>
    <div class="h-sub">Interactive Feedback · WhoIsHzp</div>
  </div>
</div>

<div class="chat-area" id="chat-area"></div>

<div class="input-section">
  <div class="options" id="options-bar"></div>
  <textarea id="ta" placeholder="输入反馈内容…" autofocus
            oninput="updateSend()" onkeydown="onKey(event)"></textarea>
  <div id="image-strip"></div>
  <div class="toolbar">
    <button class="icon-btn" onclick="pasteImage()" title="粘贴剪贴板图片 (Ctrl+V)">📎 粘贴图片</button>
    <button class="icon-btn" id="copy-btn" onclick="copyAll()" title="复制全部消息">📋 复制</button>
    <span class="hint">Ctrl+Enter 发送</span>
    <span class="spacer"></span>
    <button class="send-btn" id="send-btn" onclick="submit()" disabled>发送</button>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  const AI_ICON = ${JSON.stringify(iconUri)};
  let currentCallId = '${callId}';
  const pendingImages = [];
  // [{ role: 'ai'|'user', text, images[], msgId? }]
  const messages = [];
  let msgCounter = 0;

  // ── 恢复历史消息 ──
  const _history = ${historyJson};
  _history.forEach(m => {
    if (m.role === 'ai') {
      appendAIMessage(m.text, m.options, m.callId, m.ts);
    } else {
      appendUserMessage(m.text, m.images || [], m.ts);
    }
  });

  // ── 渲染当前 AI 消息 ──
  appendAIMessage(${JSON.stringify(escapedMessage)}, ${optionsJson}, '${callId}', Date.now());

  // ── 接收 extension 发来的消息 ──
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d.type === 'newPrompt') {
      currentCallId = d.callId;
      appendAIMessage(d.message, d.options, d.callId, d.ts || Date.now());
    } else if (d.type === 'messageQueued') {
      markMessagePending(d.msgId);
    } else if (d.type === 'allMessagesDequeued') {
      clearAllPendingBadges();
    }
  });

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
         + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function appendAIMessage(rawText, opts, callId, ts) {
    const timeStr = formatTime(ts || Date.now());
    messages.push({ role: 'ai', text: rawText, images: [], ts: ts || Date.now() });
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.innerHTML = \`
      <div class="msg-avatar ai-av">\${AI_ICON ? \`<img src="\${AI_ICON}" alt="">\` : '🤖'}</div>
      <div class="msg-content">
        <div class="bubble">\${rawText}</div>
        <div class="msg-time">\${timeStr}</div>
      </div>
    \`;
    document.getElementById('chat-area').appendChild(row);
    scrollBottom();

    // 更新选项按钮
    const bar = document.getElementById('options-bar');
    bar.innerHTML = '';
    (opts || []).forEach(o => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = o;
      btn.onclick = () => selectOption(o);
      bar.appendChild(btn);
    });
  }

  function appendUserMessage(text, imgDataUrls, ts, msgId) {
    const timeStr = formatTime(ts || Date.now());
    messages.push({ role: 'user', text, images: imgDataUrls.map(d => d), ts: ts || Date.now(), msgId });
    const row = document.createElement('div');
    row.className = 'msg-row user';
    if (msgId) row.dataset.msgId = msgId;
    let imgsHtml = '';
    if (imgDataUrls.length > 0) {
      imgsHtml = '<div class="bubble-imgs">' +
        imgDataUrls.map(d => \`<img src="data:image/png;base64,\${d}" alt="">\`).join('') +
        '</div>';
    }
    row.innerHTML = \`
      <div class="msg-content">
        <div class="bubble">\${escHtml(text)}\${imgsHtml}</div>
        <div class="msg-time">\${timeStr}</div>
      </div>
      <div class="msg-avatar user-av" style="flex-shrink:0">我</div>
    \`;
    document.getElementById('chat-area').appendChild(row);
    scrollBottom();
    return row;
  }

  function markMessagePending(msgId) {
    if (!msgId) return;
    const row = document.querySelector(\`[data-msg-id="\${msgId}"]\`);
    if (!row) return;
    const timeEl = row.querySelector('.msg-time');
    if (timeEl && !timeEl.querySelector('.pending-badge')) {
      const badge = document.createElement('span');
      badge.className = 'pending-badge';
      badge.dataset.pending = '1';
      badge.textContent = '⏳ 待处理中';
      timeEl.appendChild(badge);
    }
  }

  function clearAllPendingBadges() {
    document.querySelectorAll('.pending-badge[data-pending="1"]').forEach(el => {
      el.remove();
    });
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function scrollBottom() {
    const c = document.getElementById('chat-area');
    c.scrollTop = c.scrollHeight;
  }

  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
  }

  function updateSend() {
    const empty = !document.getElementById('ta').value.trim() && pendingImages.length === 0;
    document.getElementById('send-btn').disabled = empty;
  }

  function submit() {
    const text = document.getElementById('ta').value.trim();
    if (!text && pendingImages.length === 0) return;
    const msgId = 'msg-' + (++msgCounter);
    vscode.postMessage({ type: 'submit', callId: currentCallId, text, images: [...pendingImages], msgId });
    appendUserMessage(text, [...pendingImages], Date.now(), msgId);
    document.getElementById('ta').value = '';
    pendingImages.length = 0;
    document.getElementById('image-strip').innerHTML = '';
    updateSend();
  }

  function selectOption(text) {
    document.getElementById('ta').value = text;
    updateSend();
    submit();
  }

  function copyAll() {
    const text = messages.map(m => {
      const role = m.role === 'ai' ? 'AI' : '用户';
      const time = formatTime(m.ts);
      return '[' + role + (time ? ' ' + time : '') + '] ' + m.text;
    }).join('\\n\\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      const orig = btn.textContent;
      btn.textContent = '✓ 已复制';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = () => addImage(reader.result);
            reader.readAsDataURL(blob);
          }
        }
      }
    } catch (e) { console.warn('Clipboard read failed', e); }
  }

  document.addEventListener('paste', (e) => {
    for (const item of (e.clipboardData?.items ?? [])) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => addImage(reader.result);
          reader.readAsDataURL(blob);
        }
      }
    }
  });

  function addImage(dataUrl) {
    const idx = pendingImages.length;
    pendingImages.push(dataUrl.split(',')[1]);
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';
    const img = document.createElement('img');
    img.src = dataUrl;
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '×';
    del.onclick = () => { pendingImages.splice(idx, 1); wrap.remove(); updateSend(); };
    wrap.append(img, del);
    document.getElementById('image-strip').appendChild(wrap);
    updateSend();
  }
</script>
</body>
</html>`;
}
