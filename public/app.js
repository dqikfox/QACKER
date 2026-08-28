'use strict';

/* ═══════════════════════════════════════════════════════════════
   QACKER — CyberStrike Arsenal  v4
   Features:
   · ANSI color rendering (inline SGR, zero deps)
   · Output history tabs (last 30 runs)
   · Global TARGET scope tracker (localStorage-persisted)
   · Loot saver + Loot modal
   · Tool search / filter
   · Find-in-output with match nav
   · Keyboard shortcuts + cheatsheet overlay
   · Auto-scroll toggle · Elapsed timer · Line counter
   · Engagement notes (localStorage auto-save)
   · Session report exporter (markdown)
   · Favorites / pinned tools (localStorage)
   · Per-tool command history (up/down arrow recall)
   · Drag-from-SecLists onto any form field
   · Extracted targets panel (auto-parse IPs/domains)
   · Sidebar collapse toggle
   · Uptime clock
   ═══════════════════════════════════════════════════════════════ */

(function () {

  const $ = (id) => document.getElementById(id);

  // ── DOM ───────────────────────────────────────────────────────
  const toolNavEl          = $('tool-nav');
  const favNavEl           = $('favorites-nav');
  const favSectionEl       = $('favorites-section');
  const toolPanelEl        = $('tool-panel');
  const outputPreEl        = $('output');
  const outputMetaEl       = $('output-meta');
  const outputStatsEl      = $('output-stats');
  const copyBtnEl          = $('copy-btn');
  const clearBtnEl         = $('clear-btn');
  const saveLootBtnEl      = $('save-loot-btn');
  const extractBtnEl       = $('extract-btn');
  const historyToggleEl    = $('history-toggle-btn');
  const historyBarEl       = $('history-bar');
  const historyTabsEl      = $('history-tabs');
  const historyClearEl     = $('history-clear-btn');
  const findBtnEl          = $('find-btn');
  const findBarEl          = $('find-bar');
  const findInputEl        = $('find-input');
  const findCountEl        = $('find-count');
  const findPrevEl         = $('find-prev');
  const findNextEl         = $('find-next');
  const findCloseEl        = $('find-close');
  const autoscrollBtnEl    = $('autoscroll-btn');
  const statusDotEl        = $('status-dot');
  const statusTextEl       = $('status-text');
  const uptimeClockEl      = $('uptime-clock');
  const toolCountEl        = $('tool-count');
  const agentListEl        = $('agent-list');
  const seclistsListEl     = $('seclists-list');
  const seclistsPathEl     = $('seclists-path');
  const seclistsUpEl       = $('seclists-up');
  const toolSearchEl       = $('tool-search');
  const searchClearEl      = $('search-clear');
  const searchEmptyEl      = $('search-empty');
  const sidebarEl          = $('sidebar');
  const sidebarToggleEl    = $('sidebar-toggle');
  const configBtnEl        = $('config-btn');
  const configModalEl      = $('config-modal');
  const modalCloseEl       = $('modal-close');
  const configBodyEl       = $('config-body');
  const lootBtnEl          = $('loot-btn');
  const lootModalEl        = $('loot-modal');
  const lootModalCloseEl   = $('loot-modal-close');
  const lootBodyEl         = $('loot-body');
  const lootDirLabelEl     = $('loot-dir-label');
  const notesBtnEl         = $('notes-btn');
  const notesPanelEl       = $('notes-panel');
  const notesCloseEl       = $('notes-close-btn');
  const notesSaveBtnEl     = $('notes-save-btn');
  const notesAreaEl        = $('notes-area');
  const notesSavedEl       = $('notes-saved');
  const targetsBtnEl       = $('targets-btn');
  const targetsPanelEl     = $('targets-panel');
  const targetsCloseEl     = $('targets-close-btn');
  const targetsClearEl     = $('targets-clear-btn');
  const targetsCopyAllEl   = $('targets-copy-all');
  const targetsSaveBtnEl   = $('targets-save-btn');
  const targetsListEl      = $('targets-list');
  const targetsFilterEl    = $('targets-filter');
  const targetsCountEl     = $('targets-count');
  const reportBtnEl        = $('report-btn');
  const reportModalEl      = $('report-modal');
  const reportModalCloseEl = $('report-modal-close');
  const reportBodyEl       = $('report-body');
  const reportCopyEl       = $('report-copy-btn');
  const reportSaveEl       = $('report-save-btn');
  const toastContEl        = $('toast-container');
  const scopeInputEl       = $('scope-input');
  const scopeClearEl       = $('scope-clear');
  const shortcutsOverlayEl = $('shortcuts-overlay');
  const shortcutsCloseEl   = $('shortcuts-close');

  // ── State ─────────────────────────────────────────────────────
  let allTools       = [];
  let categories     = {};
  let activeTool     = null;
  let streamCtrl     = null;
  let activePid      = null;
  let seclistsPath   = '';
  let historyVisible = false;
  let autoScroll     = true;
  let runStartTime   = null;
  let elapsedTimer   = null;
  let lineCount      = 0;
  let notesOpen      = false;
  let targetsOpen    = false;
  let sidebarCollapsed = false;
  let findOpen       = false;
  let findMatches    = [];
  let findCurrent    = -1;

  // ── localStorage keys ─────────────────────────────────────────
  const LS = {
    SCOPE:     'qacker-scope',
    NOTES:     'qacker-notes',
    FAVS:      'qacker-favorites',
    CMD_PFX:   'qacker-cmd-', // + toolId
    TARGETS:   'qacker-targets',
    SIDEBAR:   'qacker-sidebar-collapsed',
  };

  // ── History (output sessions) ─────────────────────────────────
  const MAX_HISTORY = 30;
  let history       = [];
  let activeHistIdx = -1;

  // ── Favorites ─────────────────────────────────────────────────
  let favorites = new Set(JSON.parse(localStorage.getItem(LS.FAVS) || '[]'));

  function saveFavorites() {
    localStorage.setItem(LS.FAVS, JSON.stringify([...favorites]));
  }

  function toggleFavorite(toolId) {
    if (favorites.has(toolId)) favorites.delete(toolId);
    else favorites.add(toolId);
    saveFavorites();
    rebuildFavorites();
    // update star button if this tool is active
    const starBtn = toolPanelEl.querySelector('.btn-star');
    if (starBtn && activeTool?.id === toolId) {
      starBtn.textContent = favorites.has(toolId) ? '★' : '☆';
      starBtn.classList.toggle('starred', favorites.has(toolId));
    }
  }

  function rebuildFavorites() {
    favNavEl.innerHTML = '';
    if (!favorites.size || !allTools.length) {
      favSectionEl.style.display = 'none';
      return;
    }
    favSectionEl.style.display = '';
    for (const toolId of favorites) {
      const tool = allTools.find(t => t.id === toolId);
      if (!tool) continue;
      const btn = document.createElement('button');
      btn.className = 'tool-btn tool-btn-fav';
      btn.type = 'button';
      btn.dataset.toolId = tool.id;
      btn.innerHTML = `<span class="tool-dot"></span>${escHtml(tool.name)}`;
      btn.addEventListener('click', () => selectTool(tool));
      favNavEl.appendChild(btn);
    }
  }

  // ── Per-tool command history ──────────────────────────────────
  const CMD_HISTORY_MAX = 20;

  function getCmdHistory(toolId) {
    try { return JSON.parse(localStorage.getItem(LS.CMD_PFX + toolId) || '[]'); } catch { return []; }
  }

  function pushCmdHistory(toolId, inputObj) {
    const hist = getCmdHistory(toolId);
    // Only store if there's real content
    const vals = Object.values(inputObj).filter(v => typeof v === 'string' && v.trim());
    if (!vals.length) return;
    const entry = JSON.stringify(inputObj);
    // De-dupe: don't push if identical to last entry
    if (hist[0] === entry) return;
    hist.unshift(entry);
    if (hist.length > CMD_HISTORY_MAX) hist.pop();
    localStorage.setItem(LS.CMD_PFX + toolId, JSON.stringify(hist));
  }

  // ── Scope / Target ────────────────────────────────────────────
  const SCOPE_FIELDS = new Set(['target', 'url', 'host', 'domain']);

  // Restore scope from localStorage
  scopeInputEl.value = localStorage.getItem(LS.SCOPE) || '';

  scopeInputEl.addEventListener('input', () => {
    localStorage.setItem(LS.SCOPE, scopeInputEl.value);
    if (activeTool) applyScope(false);
  });
  scopeClearEl.addEventListener('click', () => {
    scopeInputEl.value = '';
    localStorage.removeItem(LS.SCOPE);
  });

  function getScope() { return scopeInputEl.value.trim(); }

  function applyScope(fillEmpty = true) {
    const scope = getScope();
    for (const field of (activeTool?.fields || [])) {
      if (!SCOPE_FIELDS.has(field.name)) continue;
      const node = document.getElementById(`f-${field.name}`);
      if (!node) continue;
      if (fillEmpty && !node.value && scope) node.value = scope;
    }
  }

  // ── Sidebar collapse ──────────────────────────────────────────
  sidebarCollapsed = localStorage.getItem(LS.SIDEBAR) === '1';
  if (sidebarCollapsed) sidebarEl.classList.add('collapsed');

  sidebarToggleEl.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    sidebarEl.classList.toggle('collapsed', sidebarCollapsed);
    localStorage.setItem(LS.SIDEBAR, sidebarCollapsed ? '1' : '0');
  });

  // ── Uptime clock ──────────────────────────────────────────────
  setInterval(async () => {
    try {
      const r = await fetch('/api/status');
      const d = await r.json();
      const s = d.uptime || 0;
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      uptimeClockEl.textContent = h
        ? `${h}h ${String(m).padStart(2,'0')}m`
        : `${m}:${String(ss).padStart(2,'0')}`;
    } catch { uptimeClockEl.textContent = ''; }
  }, 10000);

  // ── Toast ─────────────────────────────────────────────────────
  function toast(msg, type = 'info', ms = 3000) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    toastContEl.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
  }

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
    statusDotEl.className    = 'status-dot ' + (online ? 'online' : 'offline');
    statusTextEl.textContent = label;
  }

  function setOutputMeta(state, text) {
    outputMetaEl.className   = 'output-meta ' + state;
    outputMetaEl.textContent = text;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Stats (timer + line count) ────────────────────────────────
  function startTimer() {
    runStartTime = Date.now();
    lineCount    = 0;
    updateStats();
    clearInterval(elapsedTimer);
    elapsedTimer = setInterval(updateStats, 500);
  }
  function stopTimer() {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
    updateStats();
  }
  function updateStats() {
    if (!runStartTime) { outputStatsEl.textContent = ''; return; }
    const elapsed = ((Date.now() - runStartTime) / 1000).toFixed(1);
    outputStatsEl.textContent = `${lineCount.toLocaleString()} lines · ${elapsed}s`;
  }
  function countLines(text) {
    lineCount += (text.match(/\n/g) || []).length;
    updateStats();
  }

  // ── ANSI → HTML ───────────────────────────────────────────────
  const ANSI_NAMES = ['black','red','green','yellow','blue','magenta','cyan','white'];

  function ansiToHtml(raw) {
    const parts = raw.split(/\x1b\[([0-9;]*)m/);
    let cls = new Set();
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        if (parts[i]) {
          const c = [...cls].join(' ');
          out += c ? `<span class="${c}">${escHtml(parts[i])}</span>` : escHtml(parts[i]);
        }
      } else {
        cls = applySgr(cls, parts[i] === '' ? [0] : parts[i].split(';').map(Number));
      }
    }
    return out;
  }

  function applySgr(c, codes) {
    const s = new Set(c);
    for (const code of codes) {
      if (code === 0) { s.clear(); continue; }
      if (code === 1) { s.add('ansi-bold'); continue; }
      if (code === 2) { s.add('ansi-dim'); continue; }
      if (code === 3) { s.add('ansi-italic'); continue; }
      if (code === 4) { s.add('ansi-underline'); continue; }
      if (code === 22) { s.delete('ansi-bold'); s.delete('ansi-dim'); continue; }
      if (code === 23) { s.delete('ansi-italic'); continue; }
      if (code === 24) { s.delete('ansi-underline'); continue; }
      if (code >= 30 && code <= 37) {
        ANSI_NAMES.forEach(n => s.delete(`ansi-fg-${n}`));
        s.add(`ansi-fg-${ANSI_NAMES[code-30]}`); continue;
      }
      if (code === 39) { ANSI_NAMES.forEach(n => s.delete(`ansi-fg-${n}`)); continue; }
      if (code >= 40 && code <= 47) {
        ANSI_NAMES.forEach(n => s.delete(`ansi-bg-${n}`));
        s.add(`ansi-bg-${ANSI_NAMES[code-40]}`); continue;
      }
      if (code === 49) { ANSI_NAMES.forEach(n => s.delete(`ansi-bg-${n}`)); continue; }
      if (code >= 90 && code <= 97) {
        ANSI_NAMES.forEach(n => { s.delete(`ansi-fg-${n}`); s.delete(`ansi-fg-bright-${n}`); });
        s.add(`ansi-fg-bright-${ANSI_NAMES[code-90]}`); continue;
      }
      if (code >= 100 && code <= 107) {
        ANSI_NAMES.forEach(n => { s.delete(`ansi-bg-${n}`); s.delete(`ansi-bg-bright-${n}`); });
        s.add(`ansi-bg-bright-${ANSI_NAMES[code-100]}`); continue;
      }
    }
    return s;
  }

  // ── Output helpers ────────────────────────────────────────────
  function clearOutput() {
    outputPreEl.innerHTML = '<code class="output-placeholder">Run a tool to see output here.</code>';
    activeHistIdx = -1;
    lineCount = 0;
    runStartTime = null;
    outputStatsEl.textContent = '';
    if (findOpen) closeFindBar();
  }

  function appendHtml(html) {
    if (outputPreEl.querySelector('.output-placeholder')) outputPreEl.innerHTML = '';
    const frag = document.createElement('span');
    frag.innerHTML = html;
    outputPreEl.appendChild(frag);
    if (autoScroll) outputPreEl.scrollTop = outputPreEl.scrollHeight;
  }

  function appendAnsi(raw, extraClass) {
    countLines(raw);
    let html = ansiToHtml(raw);
    if (extraClass) html = `<span class="${extraClass}">${html}</span>`;
    appendHtml(html);
  }

  // ── Auto-scroll ───────────────────────────────────────────────
  autoscrollBtnEl.classList.add('active');
  autoscrollBtnEl.addEventListener('click', () => {
    autoScroll = !autoScroll;
    autoscrollBtnEl.classList.toggle('active', autoScroll);
    if (autoScroll) outputPreEl.scrollTop = outputPreEl.scrollHeight;
    toast(autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF', 'info', 1200);
  });

  // ── Find in output ────────────────────────────────────────────
  function openFindBar() {
    findOpen = true;
    findBarEl.style.display = 'flex';
    findBtnEl.classList.add('active');
    findInputEl.focus();
    findInputEl.select();
    runFind();
  }
  function closeFindBar() {
    findOpen = false;
    findBarEl.style.display = 'none';
    findBtnEl.classList.remove('active');
    clearFindHighlights();
    findMatches = [];
    findCurrent = -1;
    findCountEl.textContent = '';
  }
  function clearFindHighlights() {
    outputPreEl.querySelectorAll('.find-match').forEach(m => {
      m.replaceWith(document.createTextNode(m.textContent));
    });
    outputPreEl.normalize();
  }
  function runFind() {
    clearFindHighlights();
    findMatches = [];
    findCurrent = -1;
    const q = findInputEl.value;
    if (!q) { findCountEl.textContent = ''; return; }
    const lq = q.toLowerCase();
    const walker = document.createTreeWalker(outputPreEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(tn => {
      const text  = tn.textContent;
      const lower = text.toLowerCase();
      let idx = 0, pos, lastEnd = 0;
      const frag = document.createDocumentFragment();
      while ((pos = lower.indexOf(lq, idx)) !== -1) {
        if (pos > lastEnd) frag.appendChild(document.createTextNode(text.slice(lastEnd, pos)));
        const mark = document.createElement('mark');
        mark.className = 'find-match';
        mark.textContent = text.slice(pos, pos + q.length);
        frag.appendChild(mark);
        findMatches.push(mark);
        idx = pos + q.length;
        lastEnd = idx;
      }
      if (lastEnd > 0) {
        if (lastEnd < text.length) frag.appendChild(document.createTextNode(text.slice(lastEnd)));
        tn.replaceWith(frag);
      }
    });
    if (findMatches.length) { findCurrent = 0; scrollToMatch(0); }
    updateFindCount();
  }
  function scrollToMatch(idx) {
    findMatches.forEach((m, i) => m.classList.toggle('find-match-active', i === idx));
    findMatches[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function updateFindCount() {
    if (!findMatches.length) {
      findCountEl.textContent = findInputEl.value ? '0 results' : '';
      findCountEl.style.color = findInputEl.value ? 'var(--red)' : '';
    } else {
      findCountEl.textContent = `${findCurrent + 1} / ${findMatches.length}`;
      findCountEl.style.color = '';
    }
  }
  function findStep(dir) {
    if (!findMatches.length) return;
    findCurrent = (findCurrent + dir + findMatches.length) % findMatches.length;
    scrollToMatch(findCurrent);
    updateFindCount();
  }
  findBtnEl.addEventListener('click', () => findOpen ? closeFindBar() : openFindBar());
  findCloseEl.addEventListener('click', closeFindBar);
  findInputEl.addEventListener('input', runFind);
  findInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') closeFindBar();
  });
  findPrevEl.addEventListener('click', () => findStep(-1));
  findNextEl.addEventListener('click', () => findStep(1));

  // ── History ───────────────────────────────────────────────────
  function captureHistory(toolName, metaState, metaText) {
    const rawText = outputPreEl.innerText;
    if (!rawText.trim() || outputPreEl.querySelector('.output-placeholder')) return;
    history.unshift({
      id: Date.now(), toolName,
      rawText, htmlContent: outputPreEl.innerHTML,
      metaState, metaText,
      ts: new Date().toLocaleTimeString(),
      lines: lineCount,
      elapsed: runStartTime ? ((Date.now() - runStartTime) / 1000).toFixed(1) : null,
    });
    if (history.length > MAX_HISTORY) history.pop();
    if (historyVisible) rebuildHistoryTabs();
  }

  function rebuildHistoryTabs() {
    historyTabsEl.innerHTML = '';
    const live = el('button', { class: `hist-tab${activeHistIdx === -1 ? ' active' : ''}`, type: 'button', text: '● Live' });
    live.addEventListener('click', () => switchHistory(-1));
    historyTabsEl.appendChild(live);
    history.forEach((entry, idx) => {
      const tab = el('button', { class: `hist-tab${activeHistIdx === idx ? ' active' : ''}`, type: 'button' });
      tab.innerHTML = `<span class="hist-tab-tool">${escHtml(entry.toolName)}</span><span class="hist-tab-ts">${entry.ts}</span>${entry.elapsed ? `<span class="hist-tab-dur">${entry.elapsed}s</span>` : ''}`;
      tab.addEventListener('click', () => switchHistory(idx));
      historyTabsEl.appendChild(tab);
    });
  }
  function switchHistory(idx) {
    activeHistIdx = idx;
    if (idx === -1) {
      outputPreEl.innerHTML = '<code class="output-placeholder">Run a tool to see output here.</code>';
      setOutputMeta('', '');
      outputStatsEl.textContent = '';
    } else {
      const e = history[idx];
      outputPreEl.innerHTML = e.htmlContent;
      setOutputMeta(e.metaState, e.metaText);
      outputStatsEl.textContent = e.lines ? `${e.lines.toLocaleString()} lines${e.elapsed ? ` · ${e.elapsed}s` : ''}` : '';
      outputPreEl.scrollTop = outputPreEl.scrollHeight;
    }
    rebuildHistoryTabs();
    if (findOpen) runFind();
  }
  historyToggleEl.addEventListener('click', () => {
    historyVisible = !historyVisible;
    historyBarEl.style.display = historyVisible ? 'flex' : 'none';
    historyToggleEl.classList.toggle('active', historyVisible);
    if (historyVisible) rebuildHistoryTabs();
  });
  historyClearEl.addEventListener('click', () => {
    history = []; activeHistIdx = -1;
    rebuildHistoryTabs();
    toast('History cleared', 'info');
  });

  // ── Extracted Targets ─────────────────────────────────────────
  // Persisted in localStorage, de-duplicated Set
  let extractedTargets = new Set(JSON.parse(localStorage.getItem(LS.TARGETS) || '[]'));

  const IP_RE       = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const DOMAIN_RE   = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;
  const URL_RE      = /https?:\/\/([a-zA-Z0-9._-]+)/g;
  // Exclude common false positives
  const EXCLUDE_RE  = /^(localhost|127\.|0\.0\.0\.|255\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|10\.|version|example\.|schema\.)$/i;

  function extractTargetsFromText(text) {
    const found = new Set();
    let m;
    while ((m = IP_RE.exec(text)))     found.add(m[0]);
    while ((m = URL_RE.exec(text)))    found.add(m[1]);
    while ((m = DOMAIN_RE.exec(text))) found.add(m[0]);
    // filter noise
    return [...found].filter(t => !EXCLUDE_RE.test(t) && t.length > 3);
  }

  function saveExtractedTargets() {
    localStorage.setItem(LS.TARGETS, JSON.stringify([...extractedTargets]));
  }

  function addTargets(targets) {
    let added = 0;
    for (const t of targets) {
      if (!extractedTargets.has(t)) { extractedTargets.add(t); added++; }
    }
    saveExtractedTargets();
    renderTargetsList();
    return added;
  }

  function renderTargetsList() {
    const filter = targetsFilterEl.value.trim().toLowerCase();
    targetsListEl.innerHTML = '';
    const filtered = [...extractedTargets].filter(t => !filter || t.includes(filter));

    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'targets-empty';
      li.textContent = extractedTargets.size ? 'No targets match filter.' : 'No targets extracted yet.\nRun nmap, subfinder, httpx etc. then click 🎯 Extract.';
      targetsListEl.appendChild(li);
    } else {
      for (const t of filtered) {
        const li = document.createElement('li');
        li.className = 'target-item';
        li.title = 'Click: set as TARGET · Double-click: remove';
        li.innerHTML = `<span class="target-text">${escHtml(t)}</span><button class="target-remove" title="Remove">✕</button>`;
        li.addEventListener('click', (e) => {
          if (e.target.classList.contains('target-remove')) {
            extractedTargets.delete(t);
            saveExtractedTargets();
            renderTargetsList();
          } else {
            scopeInputEl.value = t;
            localStorage.setItem(LS.SCOPE, t);
            if (activeTool) applyScope(false);
            toast(`Target set: ${t}`, 'ok', 1500);
          }
        });
        li.addEventListener('dblclick', () => {
          extractedTargets.delete(t);
          saveExtractedTargets();
          renderTargetsList();
        });
        targetsListEl.appendChild(li);
      }
    }
    targetsCountEl.textContent = `${extractedTargets.size} target${extractedTargets.size !== 1 ? 's' : ''}`;
  }

  extractBtnEl.addEventListener('click', () => {
    const text = outputPreEl.innerText;
    if (!text.trim() || outputPreEl.querySelector('.output-placeholder')) {
      toast('No output to extract from', 'error'); return;
    }
    const found = extractTargetsFromText(text);
    if (!found.length) { toast('No IPs or domains found in output', 'info'); return; }
    const added = addTargets(found);
    toast(`Extracted ${added} new target${added !== 1 ? 's' : ''} (${found.length} total found)`, 'ok');
    // open targets panel
    if (!targetsOpen) toggleTargetsPanel();
  });

  targetsFilterEl.addEventListener('input', renderTargetsList);

  targetsClearEl.addEventListener('click', () => {
    extractedTargets.clear();
    saveExtractedTargets();
    renderTargetsList();
    toast('Targets cleared', 'info');
  });

  targetsCopyAllEl.addEventListener('click', () => {
    const text = [...extractedTargets].join('\n');
    if (!text) { toast('No targets to copy', 'error'); return; }
    navigator.clipboard?.writeText(text).catch(() => {});
    toast(`Copied ${extractedTargets.size} targets`, 'ok');
  });

  targetsSaveBtnEl.addEventListener('click', () => {
    const text = [...extractedTargets].join('\n');
    if (!text) { toast('No targets to save', 'error'); return; }
    saveToLoot(text, 'targets');
  });

  function toggleTargetsPanel() {
    targetsOpen = !targetsOpen;
    targetsPanelEl.style.display = targetsOpen ? 'flex' : 'none';
    targetsBtnEl.classList.toggle('active', targetsOpen);
    if (targetsOpen) { renderTargetsList(); targetsFilterEl.focus(); }
    // Close notes if targets opens and vice versa
    if (targetsOpen && notesOpen) { notesOpen = false; notesPanelEl.style.display = 'none'; notesBtnEl.classList.remove('active'); }
  }

  targetsBtnEl.addEventListener('click', toggleTargetsPanel);
  targetsCloseEl.addEventListener('click', () => { targetsOpen = false; targetsPanelEl.style.display = 'none'; targetsBtnEl.classList.remove('active'); });

  // ── Loot saver ────────────────────────────────────────────────
  async function saveToLoot(content, toolId) {
    try {
      const res  = await fetch('/api/loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: `${toolId || 'output'}.txt`, content }),
      });
      const data = await res.json();
      if (res.ok) toast(`Saved → ${data.name}`, 'ok', 4000);
      else toast(`Save failed: ${data.error}`, 'error');
    } catch (err) { toast(`Save failed: ${err.message}`, 'error'); }
  }

  saveLootBtnEl.addEventListener('click', () => {
    const text = outputPreEl.innerText;
    if (!text.trim() || outputPreEl.querySelector('.output-placeholder')) { toast('Nothing to save', 'error'); return; }
    saveToLoot(text, activeTool?.id || 'output');
  });

  // ── Loot modal ────────────────────────────────────────────────
  async function openLoot() {
    lootModalEl.classList.add('open');
    lootBodyEl.innerHTML = '<div class="config-loading">Loading…</div>';
    try {
      const res  = await fetch('/api/loot');
      const data = await res.json();
      lootDirLabelEl.textContent = `Loot dir: ${data.lootDir}`;
      if (!data.files?.length) { lootBodyEl.innerHTML = '<div class="config-loading" style="color:var(--text-muted)">No loot files yet.</div>'; return; }
      const table = el('table', { class: 'loot-table' });
      table.innerHTML = '<thead><tr><th>File</th><th>Size</th><th>Saved</th></tr></thead>';
      const tbody = el('tbody');
      for (const f of data.files) {
        const tr = el('tr');
        tr.innerHTML = `<td class="loot-name">${escHtml(f.name)}</td><td class="loot-size">${fmtBytes(f.size)}</td><td class="loot-ts">${new Date(f.mtime).toLocaleString()}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      lootBodyEl.innerHTML = '';
      lootBodyEl.appendChild(table);
    } catch (err) { lootBodyEl.innerHTML = `<div class="config-loading" style="color:var(--red)">Failed: ${escHtml(err.message)}</div>`; }
  }
  function fmtBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  }
  lootBtnEl.addEventListener('click', openLoot);
  lootModalCloseEl.addEventListener('click', () => lootModalEl.classList.remove('open'));
  lootModalEl.addEventListener('click', e => { if (e.target === lootModalEl) lootModalEl.classList.remove('open'); });

  // ── Notes panel ───────────────────────────────────────────────
  notesAreaEl.value = localStorage.getItem(LS.NOTES) || '';
  notesAreaEl.addEventListener('input', () => {
    localStorage.setItem(LS.NOTES, notesAreaEl.value);
    notesSavedEl.textContent = `Saved ${new Date().toLocaleTimeString()}`;
    setTimeout(() => { notesSavedEl.textContent = ''; }, 2000);
  });
  function toggleNotes() {
    notesOpen = !notesOpen;
    notesPanelEl.style.display = notesOpen ? 'flex' : 'none';
    notesBtnEl.classList.toggle('active', notesOpen);
    if (notesOpen) { notesAreaEl.focus(); if (targetsOpen) { targetsOpen = false; targetsPanelEl.style.display = 'none'; targetsBtnEl.classList.remove('active'); } }
  }
  notesBtnEl.addEventListener('click', toggleNotes);
  notesCloseEl.addEventListener('click', () => { notesOpen = false; notesPanelEl.style.display = 'none'; notesBtnEl.classList.remove('active'); });
  notesSaveBtnEl.addEventListener('click', () => {
    const c = notesAreaEl.value;
    if (!c.trim()) { toast('Notes empty', 'error'); return; }
    saveToLoot(c, 'notes');
  });

  // ── Report ────────────────────────────────────────────────────
  function generateReport() {
    if (!history.length) return null;
    const lines = [
      `# QACKER Session Report`,
      ``,
      `**Date:** ${new Date().toLocaleString()}  `,
      `**Target:** ${getScope() || '(not set)'}  `,
      `**Tool runs:** ${history.length}  `,
      ``, `---`, ``,
    ];
    history.slice().reverse().forEach((e, i) => {
      lines.push(`## Run ${i + 1} — ${e.toolName}`);
      lines.push(``, `**Time:** ${e.ts}  `);
      if (e.elapsed) lines.push(`**Elapsed:** ${e.elapsed}s  `);
      if (e.lines) lines.push(`**Lines:** ${e.lines}  `);
      lines.push(`**Status:** ${e.metaText || 'unknown'}  `, ``);
      lines.push('```', e.rawText.slice(0, 8000));
      if (e.rawText.length > 8000) lines.push('[… truncated …]');
      lines.push('```', ``);
    });
    const notes = notesAreaEl.value.trim();
    if (notes) { lines.push(`---`, `## Engagement Notes`, ``, notes, ``); }
    const tgts = [...extractedTargets];
    if (tgts.length) { lines.push(`---`, `## Extracted Targets`, ``, tgts.map(t => `- ${t}`).join('\n'), ``); }
    return lines.join('\n');
  }
  async function openReport() {
    reportModalEl.classList.add('open');
    const md = generateReport();
    if (!md) { reportBodyEl.innerHTML = '<div class="config-loading">No history yet.</div>'; return; }
    reportBodyEl.innerHTML = '';
    reportBodyEl.appendChild(el('pre', { class: 'report-pre', text: md }));
  }
  reportBtnEl.addEventListener('click', openReport);
  reportModalCloseEl.addEventListener('click', () => reportModalEl.classList.remove('open'));
  reportModalEl.addEventListener('click', e => { if (e.target === reportModalEl) reportModalEl.classList.remove('open'); });
  reportCopyEl.addEventListener('click', () => {
    const md = generateReport();
    if (!md) { toast('No history', 'error'); return; }
    navigator.clipboard?.writeText(md).catch(() => {});
    toast('Report copied', 'ok');
  });
  reportSaveEl.addEventListener('click', async () => {
    const md = generateReport();
    if (!md) { toast('No history', 'error'); return; }
    await saveToLoot(md, `report-${new Date().toISOString().slice(0,10)}`);
    reportModalEl.classList.remove('open');
  });

  // ── Tool search ───────────────────────────────────────────────
  toolSearchEl.addEventListener('input', filterTools);
  searchClearEl.addEventListener('click', () => { toolSearchEl.value = ''; filterTools(); toolSearchEl.focus(); });

  function filterTools() {
    const q = toolSearchEl.value.trim().toLowerCase();
    let anyVisible = false;
    document.querySelectorAll('#tool-nav .category-group').forEach(group => {
      let groupVisible = false;
      group.querySelectorAll('.tool-btn').forEach(btn => {
        const visible = !q || btn.textContent.toLowerCase().includes(q) || (btn.dataset.toolId || '').includes(q);
        btn.style.display = visible ? '' : 'none';
        if (visible) groupVisible = true;
      });
      group.style.display = groupVisible ? '' : 'none';
      if (groupVisible) anyVisible = true;
      if (q && groupVisible) {
        group.querySelector('.category-header')?.classList.remove('collapsed');
        group.querySelector('.category-tools')?.classList.remove('hidden');
      }
    });
    searchEmptyEl.style.display = (!anyVisible && q) ? 'block' : 'none';
    searchClearEl.style.display = q ? 'inline-flex' : 'none';
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

  // ── Run (buffered) ────────────────────────────────────────────
  async function runTool(tool, runBtn) {
    const input = collectInput(tool);
    pushCmdHistory(tool.id, input);
    captureHistory(activeTool?.name || '?',
      outputMetaEl.className.replace('output-meta','').trim(), outputMetaEl.textContent);

    runBtn.disabled = true;
    runBtn.classList.add('loading');
    clearOutput();
    startTimer();
    setOutputMeta('running', '● running…');

    try {
      const res  = await fetch(`/api/tools/${tool.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        appendHtml(`<span class="out-error">${escHtml(`Error: ${data.error || 'Unknown'}`)}</span>`);
        setOutputMeta('error', '✕ error');
        toast(data.error || 'Tool error', 'error');
        return;
      }
      appendHtml(`<span class="out-cmd">$ ${escHtml(data.command)} ${escHtml((data.args || []).join(' '))}</span>\n\n`);
      if (data.stdout) appendAnsi(data.stdout);
      if (data.stderr) { appendHtml('\n'); appendAnsi(`[stderr]\n${data.stderr}`, 'out-stderr'); }
      const ok = data.success;
      setOutputMeta(ok ? 'success' : 'error', ok ? `✔ exit 0` : `✕ exit ${data.code}`);
      toast(ok ? `${tool.name} finished` : `${tool.name} exit ${data.code}`, ok ? 'ok' : 'error');
    } catch (err) {
      appendHtml(`<span class="out-error">${escHtml(`Request failed: ${err.message}`)}</span>`);
      setOutputMeta('error', '✕ failed');
      toast('Request failed: ' + err.message, 'error');
    } finally {
      runBtn.disabled = false;
      runBtn.classList.remove('loading');
      stopTimer();
    }
  }

  // ── Stream (SSE) ──────────────────────────────────────────────
  async function streamTool(tool, runBtn, streamBtn, stopBtn) {
    if (streamCtrl) { streamCtrl.abort(); return; }
    const input = collectInput(tool);
    pushCmdHistory(tool.id, input);
    captureHistory(activeTool?.name || '?',
      outputMetaEl.className.replace('output-meta','').trim(), outputMetaEl.textContent);

    streamCtrl = new AbortController();
    activePid  = null;
    runBtn.disabled         = true;
    streamBtn.style.display = 'none';
    stopBtn.style.display   = 'flex';
    clearOutput();
    startTimer();
    setOutputMeta('running', '● streaming…');

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
            activePid = data.pid || null;
            appendHtml(`<span class="out-cmd">$ ${escHtml(data.command)} ${escHtml((data.args||[]).join(' '))}</span>${data.pid ? ` <span class="out-pid">[PID ${data.pid}]</span>` : ''}\n\n`);
          } else if (type === 'stdout') {
            appendAnsi(data);
          } else if (type === 'stderr') {
            appendAnsi(data, 'out-stderr');
          } else if (type === 'error') {
            appendHtml(`<span class="out-error">${escHtml(data)}</span>`);
            toast(data, 'error');
          } else if (type === 'done') {
            const ok = data.code === 0;
            appendHtml(`\n<span class="out-done">[done — exit ${data.code ?? 'null'}]</span>`);
            setOutputMeta(ok ? 'success' : 'error', ok ? '✔ done' : `✕ exit ${data.code}`);
            toast(ok ? `${tool.name} done` : `${tool.name} exit ${data.code}`, ok ? 'ok' : 'error');
            stopTimer();
            activePid = null;
          }
        } catch { /* malformed */ }
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
        const d = await res.json().catch(() => ({}));
        appendHtml(`<span class="out-error">${escHtml(`Error: ${d.error || res.statusText}`)}</span>`);
        setOutputMeta('error', '✕ error');
        toast(d.error || 'Stream error', 'error');
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
        appendHtml(`<span class="out-error">${escHtml(`Stream failed: ${err.message}`)}</span>`);
        setOutputMeta('error', '✕ failed');
        toast('Stream failed', 'error');
      } else {
        setOutputMeta('', '⬛ stopped');
        toast('Stream stopped', 'info');
      }
    } finally {
      streamCtrl = null;
      activePid  = null;
      runBtn.disabled         = false;
      streamBtn.style.display = 'flex';
      stopBtn.style.display   = 'none';
      stopTimer();
    }
  }

  async function killActivePid() {
    if (!activePid) return;
    try { await fetch(`/api/kill/${activePid}`, { method: 'POST' }); toast(`Killed PID ${activePid}`, 'ok'); }
    catch (err) { toast('Kill failed: ' + err.message, 'error'); }
  }

  // ── Render field with cmd-history recall + drag-drop ─────────
  const WIDE_FIELDS = new Set(['wordlist','url','target','host','domain',
                               'hashfile','passlist','userlist','shellCmd','data','headers']);
  // Fields that can receive drag-and-drop from SecLists
  const DROPPABLE_FIELDS = new Set(['wordlist','passlist','userlist','shellCmd','url','target','host','domain']);

  function renderField(field, toolId) {
    const isCheckbox = field.type === 'checkbox';
    const wrapper = el('div', { class: `field${isCheckbox ? ' field-checkbox' : ''}` });

    let input;
    if (field.type === 'select') {
      input = el('select', { id: `f-${field.name}`, name: field.name });
      for (const opt of field.options || []) input.appendChild(el('option', { value: opt, text: opt || '(none)' }));
    } else if (isCheckbox) {
      input = el('input', { id: `f-${field.name}`, name: field.name, type: 'checkbox' });
    } else {
      input = el('input', {
        id: `f-${field.name}`, name: field.name,
        type: field.type === 'number' ? 'number' : 'text',
        placeholder: field.placeholder || '',
      });
    }

    // ── Command history recall (↑/↓) ──────────────────────────
    if (field.type !== 'checkbox' && field.type !== 'select') {
      let histIdx = -1;
      const cmdHist = getCmdHistory(toolId);
      input.addEventListener('keydown', (e) => {
        if (!cmdHist.length) return;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          histIdx = Math.min(histIdx + 1, cmdHist.length - 1);
          try {
            const prev = JSON.parse(cmdHist[histIdx]);
            if (prev[field.name] !== undefined) input.value = prev[field.name];
          } catch { /* ignore */ }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          histIdx = Math.max(histIdx - 1, -1);
          if (histIdx === -1) input.value = '';
          else {
            try {
              const prev = JSON.parse(cmdHist[histIdx]);
              if (prev[field.name] !== undefined) input.value = prev[field.name];
            } catch { /* ignore */ }
          }
        } else {
          histIdx = -1; // reset on any other key
        }
      });
    }

    // ── Drag-and-drop from SecLists ────────────────────────────
    if (DROPPABLE_FIELDS.has(field.name) && input.tagName === 'INPUT') {
      input.addEventListener('dragover', (e) => { e.preventDefault(); input.classList.add('drag-over'); });
      input.addEventListener('dragleave', ()  => input.classList.remove('drag-over'));
      input.addEventListener('drop', (e) => {
        e.preventDefault();
        input.classList.remove('drag-over');
        const path = e.dataTransfer.getData('text/plain');
        if (path) { input.value = path; input.dispatchEvent(new Event('input')); }
      });
    }

    const labelEl = el('label', { for: `f-${field.name}` });
    labelEl.textContent = field.label;
    if (field.required && !isCheckbox) labelEl.insertAdjacentHTML('beforeend', '<span class="required">*</span>');

    if (isCheckbox) { wrapper.appendChild(input); wrapper.appendChild(labelEl); }
    else            { wrapper.appendChild(labelEl); wrapper.appendChild(input); }
    if (WIDE_FIELDS.has(field.name)) wrapper.classList.add('field-full');
    return wrapper;
  }

  // ── Render tool panel ─────────────────────────────────────────
  let _runBtn = null, _streamBtn = null, _stopBtn = null;

  function renderTool(tool) {
    const cat = categories[tool.category] || {};
    toolPanelEl.innerHTML = '';

    // Header
    const header = el('div', { class: 'tool-header' });
    const headerLeft = el('div', { class: 'tool-header-left' });
    headerLeft.appendChild(el('div', { class: 'tool-name', text: tool.name }));
    headerLeft.appendChild(el('div', { class: 'tool-desc', text: tool.description }));
    header.appendChild(headerLeft);

    const headerRight = el('div', { class: 'tool-header-right' });
    // Star / favorite button
    const starBtn = el('button', {
      class: `btn-star${favorites.has(tool.id) ? ' starred' : ''}`,
      type: 'button',
      title: favorites.has(tool.id) ? 'Unpin from favorites' : 'Pin to favorites',
      text: favorites.has(tool.id) ? '★' : '☆',
    });
    starBtn.addEventListener('click', () => toggleFavorite(tool.id));
    headerRight.appendChild(starBtn);

    const badges = el('div', { class: 'tool-badges' });
    if (cat.label) badges.appendChild(el('span', { class: `badge badge-cat-${tool.category}`, text: `${cat.icon || ''} ${cat.label}` }));
    if (cat.agent) badges.appendChild(el('span', { class: 'badge badge-agent', text: cat.agent }));
    headerRight.appendChild(badges);
    header.appendChild(headerRight);
    toolPanelEl.appendChild(header);

    // Form
    const form = el('form', { class: 'tool-form' });
    for (const field of tool.fields || []) form.appendChild(renderField(field, tool.id));

    const footer = el('div', { class: 'form-footer field-full' });
    const runBtn    = el('button', { class: 'btn-run',    type: 'submit' });
    const streamBtn = el('button', { class: 'btn-stream', type: 'button' });
    const stopBtn   = el('button', { class: 'btn-stream btn-stop', type: 'button' });
    runBtn.innerHTML    = '<span class="run-spinner">⟳</span><span class="run-label">▶ RUN</span>';
    streamBtn.innerHTML = '⚡ STREAM';
    stopBtn.innerHTML   = '⬛ STOP';
    stopBtn.style.display = 'none';
    footer.appendChild(runBtn);
    footer.appendChild(streamBtn);
    footer.appendChild(stopBtn);
    footer.appendChild(el('span', { class: 'kb-hint', text: 'Ctrl+Shift+Enter · Ctrl+Enter · ↑↓ recall' }));
    form.appendChild(footer);
    toolPanelEl.appendChild(form);

    _runBtn = runBtn; _streamBtn = streamBtn; _stopBtn = stopBtn;
    requestAnimationFrame(() => applyScope(true));

    form.addEventListener('submit', e => { e.preventDefault(); runTool(tool, runBtn); });
    streamBtn.addEventListener('click', () => streamTool(tool, runBtn, streamBtn, stopBtn));
    stopBtn.addEventListener('click', () => { if (streamCtrl) streamCtrl.abort(); killActivePid(); });
  }

  // ── Select tool ───────────────────────────────────────────────
  function selectTool(tool) {
    activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    // Highlight in both main nav and favorites
    [toolNavEl, favNavEl].forEach(nav => {
      const btn = nav.querySelector(`[data-tool-id="${tool.id}"]`);
      if (btn) btn.classList.add('active');
    });
    renderTool(tool);
  }

  // ── Build sidebar nav ─────────────────────────────────────────
  function buildNav(tools, cats) {
    toolNavEl.innerHTML = '';
    const groups = {};
    for (const tool of tools) { const cid = tool.category || 'other'; (groups[cid] = groups[cid] || []).push(tool); }
    for (const [cid, catTools] of Object.entries(groups)) {
      const cat = cats[cid] || { id: cid, label: cid, icon: '🔧', agent: '' };
      const group     = el('div', { class: `category-group cat-${cid}` });
      const catHeader = el('div', { class: 'category-header' });
      catHeader.innerHTML = `<span class="cat-icon">${cat.icon||'🔧'}</span><span class="cat-label">${cat.label}</span>${cat.agent?`<span class="cat-agent">${cat.agent}</span>`:''}<span class="cat-arrow">▾</span>`;
      const catToolsEl = el('div', { class: 'category-tools' });
      for (const tool of catTools) {
        const btn = el('button', { class: 'tool-btn', type: 'button', 'data-tool-id': tool.id });
        btn.innerHTML = `<span class="tool-dot"></span>${escHtml(tool.name)}`;
        btn.addEventListener('click', () => selectTool(tool));
        catToolsEl.appendChild(btn);
      }
      catHeader.addEventListener('click', () => {
        catHeader.classList.toggle('collapsed');
        catToolsEl.classList.toggle('hidden');
      });
      group.appendChild(catHeader);
      group.appendChild(catToolsEl);
      toolNavEl.appendChild(group);
    }
    searchClearEl.style.display = 'none';
    rebuildFavorites();
  }

  // ── Agents ────────────────────────────────────────────────────
  const AGENT_DEFS = [
    { codename: 'GHOST',       role: 'Recon'        },
    { codename: 'STRIKER',     role: 'Web / Exploit' },
    { codename: 'PHANTOM',     role: 'Network / SMB' },
    { codename: 'INTERCEPTOR', role: 'Proxy / LLM'   },
    { codename: 'AURORA',      role: 'Cloud'         },
    { codename: 'CIPHER',      role: 'Mobile'        },
  ];
  function buildAgents() {
    agentListEl.innerHTML = '';
    for (const a of AGENT_DEFS) {
      const chip = el('div', { class: 'agent-chip' });
      chip.appendChild(el('span', { class: 'agent-codename', text: a.codename }));
      chip.appendChild(el('span', { class: 'agent-role',     text: a.role }));
      agentListEl.appendChild(chip);
    }
  }

  // ── SecLists with drag support ────────────────────────────────
  async function loadSeclists(relPath) {
    try {
      const res  = await fetch(`/api/seclists?path=${encodeURIComponent(relPath || '')}`);
      const data = await res.json();
      seclistsListEl.innerHTML = '';
      if (!data.available) {
        const li = document.createElement('li');
        li.textContent = 'SecLists not found';
        li.style.color = 'var(--red)';
        seclistsListEl.appendChild(li); return;
      }
      seclistsPath = relPath || '';
      seclistsPathEl.textContent = `/${seclistsPath}`;
      for (const entry of data.entries || []) {
        const li = el('li', { class: entry.type === 'directory' ? 'sl-dir' : 'sl-file' });
        li.textContent = (entry.type === 'directory' ? '▶ ' : '  ') + entry.name;
        if (entry.type === 'directory') {
          li.addEventListener('click', () => loadSeclists(entry.path));
        } else {
          const fullPath = `/usr/share/seclists/${entry.path}`;
          li.title = 'Click to copy · Drag to field';
          // Make draggable
          li.draggable = true;
          li.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', fullPath);
            e.dataTransfer.effectAllowed = 'copy';
            li.classList.add('dragging');
          });
          li.addEventListener('dragend', () => li.classList.remove('dragging'));
          li.addEventListener('click', () => {
            navigator.clipboard?.writeText(fullPath).catch(() => {});
            toast(`Copied: ${fullPath}`, 'ok', 1800);
            const prev = li.textContent;
            li.textContent = '✔ copied';
            setTimeout(() => { li.textContent = prev; }, 1300);
          });
        }
        seclistsListEl.appendChild(li);
      }
    } catch { /* ignore */ }
  }
  seclistsUpEl.addEventListener('click', () => {
    const parts = seclistsPath.split('/').filter(Boolean);
    parts.pop();
    loadSeclists(parts.join('/'));
  });

  // ── Copy / Clear ──────────────────────────────────────────────
  copyBtnEl.addEventListener('click', () => {
    navigator.clipboard?.writeText(outputPreEl.innerText).catch(() => {});
    toast('Output copied', 'ok');
    const prev = copyBtnEl.textContent;
    copyBtnEl.textContent = '✔ Copied';
    setTimeout(() => { copyBtnEl.textContent = prev; }, 1500);
  });
  clearBtnEl.addEventListener('click', () => {
    captureHistory(activeTool?.name || '?',
      outputMetaEl.className.replace('output-meta','').trim(), outputMetaEl.textContent);
    clearOutput();
    setOutputMeta('', '');
  });

  // ── Config modal ──────────────────────────────────────────────
  async function openConfig() {
    configModalEl.classList.add('open');
    configBodyEl.innerHTML = '<div class="config-loading">Loading…</div>';
    try {
      const res  = await fetch('/api/config');
      const data = await res.json();
      const items = [
        { key: 'Dashboard',    val: `http://${data.host === '0.0.0.0' ? 'localhost' : data.host}:${data.port}` },
        { key: 'Platform',     val: `${data.platform} / Node ${data.nodeVersion}` },
        { key: 'WSL mode',     val: data.useWsl ? 'enabled' : 'disabled', warn: !data.useWsl },
        { key: 'WSL distro',   val: data.wslDistro || '(default)', muted: !data.wslDistro },
        { key: 'Tool timeout', val: `${data.timeoutMs / 1000}s` },
        { key: 'Max buffer',   val: `${data.maxBufferMb} MB` },
        { key: 'WSL tool paths', val: data.wslToolPaths, full: true },
        { key: 'SecLists root',  val: data.seclistsRoot, full: true },
      ];
      const grid = el('div', { class: 'config-grid' });
      for (const item of items) {
        const div = el('div', { class: `config-item${item.full ? ' full' : ''}` });
        div.appendChild(el('div', { class: 'config-key', text: item.key.toUpperCase() }));
        div.appendChild(el('div', { class: `config-val${item.muted ? ' muted' : ''}${item.warn ? ' warn' : ''}`, text: item.val }));
        grid.appendChild(div);
      }
      const hint = el('div', { class: 'config-item full' });
      hint.appendChild(el('div', { class: 'config-key', text: 'ENV OVERRIDES' }));
      hint.appendChild(el('div', { class: 'config-val muted', text: 'PORT  HOST  USE_WSL  WSL_DISTRO  WSL_TOOL_PATHS  TOOL_TIMEOUT_MS  SECLISTS_PATH  LOOT_DIR' }));
      grid.appendChild(hint);
      configBodyEl.innerHTML = '';
      configBodyEl.appendChild(grid);
    } catch (err) { configBodyEl.innerHTML = `<div class="config-loading" style="color:var(--red)">Failed: ${escHtml(err.message)}</div>`; }
  }
  configBtnEl.addEventListener('click', openConfig);
  modalCloseEl.addEventListener('click', () => configModalEl.classList.remove('open'));
  configModalEl.addEventListener('click', e => { if (e.target === configModalEl) configModalEl.classList.remove('open'); });

  // ── Keyboard shortcuts ────────────────────────────────────────
  shortcutsCloseEl.addEventListener('click', () => { shortcutsOverlayEl.style.display = 'none'; });
  shortcutsOverlayEl.addEventListener('click', e => { if (e.target === shortcutsOverlayEl) shortcutsOverlayEl.style.display = 'none'; });

  document.addEventListener('keydown', (e) => {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const tag   = document.activeElement?.tagName;
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(tag);

    if (e.key === 'Escape') {
      if (findOpen) { closeFindBar(); return; }
      if (shortcutsOverlayEl.style.display !== 'none') { shortcutsOverlayEl.style.display = 'none'; return; }
      [configModalEl, lootModalEl, reportModalEl].forEach(m => m.classList.remove('open'));
      return;
    }
    if (ctrl && e.key === '/') { e.preventDefault(); toolSearchEl.focus(); toolSearchEl.select(); return; }
    if (ctrl && e.key === 'f') { e.preventDefault(); findOpen ? closeFindBar() : openFindBar(); return; }
    if (ctrl && e.key === 'k') { e.preventDefault(); clearBtnEl.click(); return; }
    if (ctrl && e.key === ',') { e.preventDefault(); openConfig(); return; }
    if (ctrl && e.key === 's') {
      e.preventDefault();
      if (notesOpen && document.activeElement === notesAreaEl) notesSaveBtnEl.click();
      else saveLootBtnEl.click();
      return;
    }
    if (ctrl && e.key === 'Enter' && activeTool) {
      e.preventDefault();
      if (shift) _runBtn?.click(); else _streamBtn?.click();
      return;
    }
    if (ctrl && (e.key === '?' || e.key === '/')) {
      e.preventDefault();
      shortcutsOverlayEl.style.display = shortcutsOverlayEl.style.display === 'none' ? 'flex' : 'none';
      return;
    }
    if (!inInput && !ctrl) {
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); toggleNotes(); }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); historyToggleEl.click(); }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleTargetsPanel(); }
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); sidebarToggleEl.click(); }
    }
  });

  // ── Bootstrap ─────────────────────────────────────────────────
  async function init() {
    try {
      const res  = await fetch('/api/tools');
      const data = await res.json();
      allTools   = data.tools      || [];
      categories = data.categories || {};
      toolCountEl.textContent = `${allTools.length} tools`;
      setStatus(true, 'online');
      buildNav(allTools, categories);
      buildAgents();
      loadSeclists('');
      if (allTools.length) selectTool(allTools[0]);
      // Fetch initial uptime
      fetch('/api/status').then(r => r.json()).then(d => {
        const s = d.uptime || 0;
        uptimeClockEl.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
      }).catch(() => {});
      toast('QACKER online', 'ok', 2000);
    } catch (err) {
      setStatus(false, 'offline');
      toolPanelEl.innerHTML = `<div class="panel-empty"><div class="empty-icon">⚠</div><div class="empty-title">Server offline</div><div class="empty-sub">${escHtml(err.message)}</div></div>`;
      toast('Server offline', 'error', 5000);
    }
  }

  init();

})();
