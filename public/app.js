'use strict';

/* ═══════════════════════════════════════════════════════════════
   QACKER — CyberStrike Arsenal frontend
   ═══════════════════════════════════════════════════════════════ */

(function () {

  // ── DOM refs ──────────────────────────────────────────────────
  const toolNavEl      = document.getElementById('tool-nav');
  const toolPanelEl    = document.getElementById('tool-panel');
  const outputPreEl    = document.getElementById('output');
  const outputMetaEl   = document.getElementById('output-meta');
  const copyBtnEl      = document.getElementById('copy-btn');
  const clearBtnEl     = document.getElementById('clear-btn');
  const statusDotEl    = document.getElementById('status-dot');
  const statusTextEl   = document.getElementById('status-text');
  const toolCountEl    = document.getElementById('tool-count');
  const agentListEl    = document.getElementById('agent-list');
  const seclistsListEl = document.getElementById('seclists-list');
  const seclistsPathEl = document.getElementById('seclists-path');
  const seclistsUpEl   = document.getElementById('seclists-up');

  // ── State ─────────────────────────────────────────────────────
  let allTools      = [];
  let categories    = {};
  let activeTool    = null;
  let streamCtrl    = null;   // AbortController for active stream
  let seclistsPath  = '';

  // ── Helpers ───────────────────────────────────────────────────
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const child of children || []) {
      if (typeof child === 'string') node.append(child);
      else node.appendChild(child);
    }
    return node;
  }

  function setStatus(online, label) {
    statusDotEl.className  = 'status-dot ' + (online ? 'online' : 'offline');
    statusTextEl.textContent = label;
  }

  function setOutputMeta(state, text) {
    outputMetaEl.className   = 'output-meta ' + state;
    outputMetaEl.textContent = text;
  }

  function appendOutput(html, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.innerHTML = html;
    if (outputPreEl.querySelector('.output-placeholder')) outputPreEl.innerHTML = '';
    outputPreEl.appendChild(span);
    outputPreEl.scrollTop = outputPreEl.scrollHeight;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Collect form values ───────────────────────────────────────
  function collectInput(tool) {
    const input = {};
    for (const field of tool.fields || []) {
      const node = document.getElementById(`f-${field.name}`);
      if (!node) continue;
      input[field.name] = field.type === 'checkbox' ? node.checked : node.value;
    }
    return input;
  }

  // ── Run tool (buffered) ───────────────────────────────────────
  async function runTool(tool, runBtn, streamBtn) {
    const input = collectInput(tool);
    runBtn.disabled = true;
    runBtn.classList.add('loading');
    setOutputMeta('running', '● running…');
    outputPreEl.innerHTML = '';

    try {
      const res  = await fetch(`/api/tools/${tool.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();

      if (!res.ok) {
        appendOutput(escHtml(`Error: ${data.error || 'Unknown error'}`), 'out-error');
        setOutputMeta('error', '✕ error');
        return;
      }

      appendOutput(`<span class="out-cmd">$ ${escHtml(data.command)} ${escHtml((data.args || []).join(' '))}</span>\n\n`, '');
      if (data.stdout) appendOutput(escHtml(data.stdout), '');
      if (data.stderr) appendOutput(`\n<span class="out-stderr">[stderr]\n${escHtml(data.stderr)}</span>`, '');

      const exitLabel = data.success ? `✔ exit 0` : `✕ exit ${data.code}`;
      setOutputMeta(data.success ? 'success' : 'error', exitLabel);
    } catch (err) {
      appendOutput(escHtml(`Request failed: ${err.message}`), 'out-error');
      setOutputMeta('error', '✕ failed');
    } finally {
      runBtn.disabled = false;
      runBtn.classList.remove('loading');
    }
  }

  // ── Stream tool (SSE) ─────────────────────────────────────────
  async function streamTool(tool, runBtn, streamBtn, stopBtn) {
    if (streamCtrl) { streamCtrl.abort(); return; }

    const input = collectInput(tool);
    streamCtrl  = new AbortController();

    runBtn.disabled    = true;
    streamBtn.style.display = 'none';
    stopBtn.style.display   = 'flex';
    setOutputMeta('running', '● streaming…');
    outputPreEl.innerHTML = '';

    let lineBuffer = '';

    const flush = (raw) => {
      lineBuffer += raw;
      const lines = lineBuffer.split('\n');
      lineBuffer  = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const { type, data } = JSON.parse(line.slice(5).trim());
          if (type === 'start') {
            appendOutput(`<span class="out-cmd">$ ${escHtml(data.command)} ${escHtml((data.args || []).join(' '))}</span>\n\n`, '');
          } else if (type === 'stdout') {
            appendOutput(escHtml(data), '');
          } else if (type === 'stderr') {
            appendOutput(escHtml(data), 'out-stderr');
          } else if (type === 'error') {
            appendOutput(escHtml(data), 'out-error');
          } else if (type === 'done') {
            const ok = data.code === 0;
            appendOutput(`\n<span class="out-done">[done — exit ${data.code ?? 'null'}]</span>`, '');
            setOutputMeta(ok ? 'success' : 'error', ok ? '✔ done' : `✕ exit ${data.code}`);
          }
        } catch { /* malformed line, skip */ }
      }
    };

    try {
      const res = await fetch(`/api/tools/${tool.id}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: streamCtrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        appendOutput(escHtml(`Error: ${data.error || res.statusText}`), 'out-error');
        setOutputMeta('error', '✕ error');
        return;
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        flush(dec.decode(value, { stream: true }));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        appendOutput(escHtml(`Stream failed: ${err.message}`), 'out-error');
        setOutputMeta('error', '✕ failed');
      } else {
        setOutputMeta('', '⬛ stopped');
      }
    } finally {
      streamCtrl = null;
      runBtn.disabled         = false;
      streamBtn.style.display = 'flex';
      stopBtn.style.display   = 'none';
    }
  }

  // ── Render field ──────────────────────────────────────────────
  function renderField(field) {
    const isCheckbox = field.type === 'checkbox';
    const wrapper = el('div', { class: `field${isCheckbox ? ' field-checkbox' : ''}` });

    let input;
    if (field.type === 'select') {
      input = el('select', { id: `f-${field.name}`, name: field.name });
      for (const opt of field.options || []) {
        input.appendChild(el('option', { value: opt, text: opt || '(none)' }));
      }
    } else if (isCheckbox) {
      input = el('input', { id: `f-${field.name}`, name: field.name, type: 'checkbox' });
    } else {
      input = el('input', {
        id: `f-${field.name}`,
        name: field.name,
        type: field.type === 'number' ? 'number' : 'text',
        placeholder: field.placeholder || '',
      });
    }

    const labelEl = el('label', { for: `f-${field.name}` });
    labelEl.textContent = field.label;
    if (field.required && !isCheckbox) labelEl.insertAdjacentHTML('beforeend', '<span class="required">*</span>');

    if (isCheckbox) {
      wrapper.appendChild(input);
      wrapper.appendChild(labelEl);
    } else {
      wrapper.appendChild(labelEl);
      wrapper.appendChild(input);
    }

    // Wide fields for long text inputs
    if (['wordlist','url','target','host','domain'].includes(field.name)) {
      wrapper.classList.add('field-full');
    }

    return wrapper;
  }

  // ── Render tool panel ─────────────────────────────────────────
  function renderTool(tool) {
    const cat = categories[tool.category] || {};

    toolPanelEl.innerHTML = '';

    // ── Tool header
    const header = el('div', { class: 'tool-header' });

    const headerLeft = el('div', { class: 'tool-header-left' });
    headerLeft.appendChild(el('div', { class: 'tool-name', text: tool.name }));
    headerLeft.appendChild(el('div', { class: 'tool-desc', text: tool.description }));
    header.appendChild(headerLeft);

    const badges = el('div', { class: 'tool-badges' });
    if (cat.label) {
      badges.appendChild(el('span', { class: `badge badge-cat-${tool.category}`, text: `${cat.icon || ''} ${cat.label}` }));
    }
    if (cat.agent) {
      badges.appendChild(el('span', { class: 'badge badge-agent', text: cat.agent }));
    }
    header.appendChild(badges);

    toolPanelEl.appendChild(header);

    // ── Form
    const form = el('form', { class: 'tool-form' });

    for (const field of tool.fields || []) {
      form.appendChild(renderField(field));
    }

    // ── Form footer
    const footer = el('div', { class: 'form-footer field-full' });

    const runBtn = el('button', { class: 'btn-run', type: 'submit' });
    runBtn.innerHTML = '<span class="run-spinner">⟳</span><span class="run-label">▶ RUN</span>';

    const streamBtn = el('button', { class: 'btn-stream', type: 'button' });
    streamBtn.innerHTML = '⚡ STREAM';

    const stopBtn = el('button', { class: 'btn-stream btn-stop', type: 'button' });
    stopBtn.innerHTML = '⬛ STOP';
    stopBtn.style.display = 'none';

    footer.appendChild(runBtn);
    footer.appendChild(streamBtn);
    footer.appendChild(stopBtn);
    form.appendChild(footer);

    toolPanelEl.appendChild(form);

    // ── Events
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      runTool(tool, runBtn, streamBtn);
    });

    streamBtn.addEventListener('click', () => {
      streamTool(tool, runBtn, streamBtn, stopBtn);
    });

    stopBtn.addEventListener('click', () => {
      if (streamCtrl) streamCtrl.abort();
    });
  }

  // ── Select tool ───────────────────────────────────────────────
  function selectTool(tool) {
    activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    const btn = toolNavEl.querySelector(`[data-tool-id="${tool.id}"]`);
    if (btn) btn.classList.add('active');
    renderTool(tool);
  }

  // ── Build sidebar nav ─────────────────────────────────────────
  function buildNav(tools, cats) {
    toolNavEl.innerHTML = '';

    // Group tools by category
    const groups = {};
    for (const tool of tools) {
      const cid = tool.category || 'other';
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(tool);
    }

    for (const [cid, catTools] of Object.entries(groups)) {
      const cat = cats[cid] || { id: cid, label: cid, icon: '🔧', agent: '' };

      const group = el('div', { class: `category-group cat-${cid}` });

      const catHeader = el('div', { class: 'category-header' });
      catHeader.innerHTML = `
        <span class="cat-icon">${cat.icon || '🔧'}</span>
        <span class="cat-label">${cat.label}</span>
        ${cat.agent ? `<span class="cat-agent">${cat.agent}</span>` : ''}
        <span class="cat-arrow">▾</span>
      `;

      const catTools_ = el('div', { class: 'category-tools' });

      for (const tool of catTools) {
        const btn = el('button', { class: 'tool-btn', type: 'button', 'data-tool-id': tool.id });
        btn.innerHTML = `<span class="tool-dot"></span>${tool.name}`;
        btn.addEventListener('click', () => selectTool(tool));
        catTools_.appendChild(btn);
      }

      catHeader.addEventListener('click', () => {
        catHeader.classList.toggle('collapsed');
        catTools_.classList.toggle('hidden');
      });

      group.appendChild(catHeader);
      group.appendChild(catTools_);
      toolNavEl.appendChild(group);
    }
  }

  // ── Build agent chips ─────────────────────────────────────────
  const AGENT_DEFS = [
    { codename: 'GHOST',       role: 'Recon'      },
    { codename: 'STRIKER',     role: 'Web / Exploit' },
    { codename: 'PHANTOM',     role: 'Network'    },
    { codename: 'INTERCEPTOR', role: 'Proxy / LLM' },
    { codename: 'AURORA',      role: 'Cloud'      },
    { codename: 'CIPHER',      role: 'Mobile'     },
  ];

  function buildAgents() {
    agentListEl.innerHTML = '';
    for (const a of AGENT_DEFS) {
      const chip = el('div', { class: 'agent-chip' });
      chip.appendChild(el('span', { class: 'agent-codename', text: a.codename }));
      chip.appendChild(el('span', { class: 'agent-role', text: a.role }));
      agentListEl.appendChild(chip);
    }
  }

  // ── SecLists browser ──────────────────────────────────────────
  async function loadSeclists(relPath) {
    const res  = await fetch(`/api/seclists?path=${encodeURIComponent(relPath || '')}`);
    const data = await res.json();
    seclistsListEl.innerHTML = '';

    if (!data.available) {
      seclistsListEl.appendChild(el('li', { text: 'SecLists not found' }));
      return;
    }

    seclistsPath             = relPath || '';
    seclistsPathEl.textContent = `/${seclistsPath}`;

    for (const entry of data.entries || []) {
      const li = el('li', { class: entry.type === 'directory' ? 'sl-dir' : 'sl-file' });
      li.textContent = (entry.type === 'directory' ? '▶ ' : '  ') + entry.name;
      if (entry.type === 'directory') {
        li.addEventListener('click', () => loadSeclists(entry.path));
      } else {
        li.title = 'Click to copy path';
        li.addEventListener('click', () => {
          const full = `/usr/share/seclists/${entry.path}`;
          navigator.clipboard?.writeText(full).catch(() => {});
          const prev = li.textContent;
          li.textContent = '✔ copied';
          setTimeout(() => { li.textContent = prev; }, 1200);
        });
      }
      seclistsListEl.appendChild(li);
    }
  }

  seclistsUpEl.addEventListener('click', () => {
    const parts = seclistsPath.split('/').filter(Boolean);
    parts.pop();
    loadSeclists(parts.join('/'));
  });

  // ── Copy / Clear ──────────────────────────────────────────────
  copyBtnEl.addEventListener('click', () => {
    const text = outputPreEl.innerText;
    navigator.clipboard?.writeText(text).catch(() => {});
    const prev = copyBtnEl.textContent;
    copyBtnEl.textContent = '✔ Copied';
    setTimeout(() => { copyBtnEl.textContent = prev; }, 1500);
  });

  clearBtnEl.addEventListener('click', () => {
    outputPreEl.innerHTML = '<code class="output-placeholder">Run a tool to see output here.</code>';
    setOutputMeta('', '');
  });

  // ── Bootstrap ─────────────────────────────────────────────────
  async function init() {
    try {
      const res  = await fetch('/api/tools');
      const data = await res.json();
      allTools   = data.tools   || [];
      categories = data.categories || {};

      toolCountEl.textContent = `${allTools.length} tools`;
      setStatus(true, 'online');

      buildNav(allTools, categories);
      buildAgents();
      loadSeclists('');

      if (allTools.length) selectTool(allTools[0]);
    } catch (err) {
      setStatus(false, 'offline');
      toolPanelEl.innerHTML = `<div class="panel-empty"><div class="empty-icon">⚠</div><div class="empty-title">Server offline</div><div class="empty-sub">${err.message}</div></div>`;
    }
  }

  init();

})();
