'use strict';

(function () {
  const tabsEl = document.getElementById('tool-tabs');
  const panelEl = document.getElementById('tool-panel');
  const outputEl = document.getElementById('output');
  const seclistsListEl = document.getElementById('seclists-list');
  const seclistsPathEl = document.getElementById('seclists-path');
  const seclistsUpBtn = document.getElementById('seclists-up');

  let tools = [];
  let currentPath = '';

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach((child) => node.appendChild(child));
    return node;
  }

  function renderField(field) {
    const wrapper = el('div', { class: field.type === 'checkbox' ? 'field checkbox' : 'field' });
    const label = el('label', { for: `f-${field.name}`, text: field.label });

    let input;
    if (field.type === 'select') {
      input = el('select', { id: `f-${field.name}`, name: field.name });
      input.appendChild(el('option', { value: '', text: '(none)' }));
      (field.options || []).forEach((opt) => {
        input.appendChild(el('option', { value: opt, text: opt }));
      });
    } else if (field.type === 'checkbox') {
      input = el('input', { id: `f-${field.name}`, name: field.name, type: 'checkbox' });
    } else {
      input = el('input', {
        id: `f-${field.name}`,
        name: field.name,
        type: field.type === 'number' ? 'number' : 'text',
        placeholder: field.placeholder || '',
      });
    }

    if (field.type === 'checkbox') {
      wrapper.appendChild(input);
      wrapper.appendChild(label);
    } else {
      wrapper.appendChild(label);
      wrapper.appendChild(input);
    }
    return wrapper;
  }

  function collectInput(tool) {
    const input = {};
    (tool.fields || []).forEach((field) => {
      const node = document.getElementById(`f-${field.name}`);
      if (!node) return;
      input[field.name] = field.type === 'checkbox' ? node.checked : node.value;
    });
    return input;
  }

  async function runTool(tool) {
    outputEl.textContent = 'Running...';
    try {
      const response = await fetch(`/api/tools/${tool.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectInput(tool)),
      });
      const data = await response.json();
      if (!response.ok) {
        outputEl.textContent = `Error: ${data.error || 'Unknown error'}`;
        return;
      }
      const lines = [
        `$ ${data.command} ${(data.args || []).join(' ')}`,
        '',
        data.stdout || '',
        data.stderr ? `\n[stderr]\n${data.stderr}` : '',
      ];
      outputEl.textContent = lines.join('\n');
    } catch (err) {
      outputEl.textContent = `Request failed: ${err.message}`;
    }
  }

  function renderTool(tool) {
    panelEl.textContent = '';
    panelEl.appendChild(el('h2', { text: tool.name }));
    panelEl.appendChild(el('p', { class: 'hint', text: tool.description }));

    const form = el('form', { id: 'tool-form' });
    (tool.fields || []).forEach((field) => form.appendChild(renderField(field)));
    const runBtn = el('button', { class: 'run', type: 'submit', text: `Run ${tool.name}` });
    form.appendChild(runBtn);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runTool(tool);
    });
    panelEl.appendChild(form);
  }

  function selectTool(tool) {
    Array.from(tabsEl.children).forEach((btn) => btn.classList.remove('active'));
    const btn = tabsEl.querySelector(`[data-tool-id="${tool.id}"]`);
    if (btn) btn.classList.add('active');
    renderTool(tool);
  }

  async function loadTools() {
    const response = await fetch('/api/tools');
    tools = await response.json();
    tabsEl.textContent = '';
    tools.forEach((tool) => {
      const btn = el('button', { type: 'button', 'data-tool-id': tool.id, text: tool.name });
      btn.addEventListener('click', () => selectTool(tool));
      tabsEl.appendChild(btn);
    });
    if (tools.length) selectTool(tools[0]);
  }

  async function loadSeclists(relativePath) {
    const response = await fetch(`/api/seclists?path=${encodeURIComponent(relativePath || '')}`);
    const data = await response.json();
    seclistsListEl.textContent = '';

    if (!data.available) {
      seclistsListEl.appendChild(el('li', { text: 'SecLists not found. Set SECLISTS_PATH or clone it into ./SecLists.' }));
      return;
    }

    currentPath = relativePath || '';
    seclistsPathEl.textContent = `/${currentPath}`;

    (data.entries || []).forEach((entry) => {
      const li = el('li', { text: entry.type === 'directory' ? `📁 ${entry.name}` : `📄 ${entry.name}` });
      if (entry.type === 'directory') {
        li.addEventListener('click', () => loadSeclists(entry.path));
      } else {
        li.title = 'Wordlist path (click to copy)';
        li.addEventListener('click', () => {
          navigator.clipboard && navigator.clipboard.writeText(entry.path).catch(() => {});
        });
      }
      seclistsListEl.appendChild(li);
    });
  }

  seclistsUpBtn.addEventListener('click', () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    loadSeclists(parts.join('/'));
  });

  loadTools();
  loadSeclists('');
})();
