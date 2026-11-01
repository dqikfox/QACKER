'use strict';

const $ = (id) => document.getElementById(id);
let cases = [];
let activeCase = null;

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3000);
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try { message = (await res.json()).error || message; } catch (_) {}
    throw new Error(message);
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res.text();
}

function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}

function detail(label, value) {
  const box = document.createElement('div');
  box.className = 'detail';
  box.append(text('b', label), text('span', value || '—'));
  return box;
}

async function loadCases(selectId) {
  const data = await api('/api/investigations/cases');
  cases = data.cases || [];
  renderCases();
  const target = selectId || (activeCase && activeCase.caseId);
  if (target && cases.some((c) => c.caseId === target)) await selectCase(target);
}

function renderCases() {
  const list = $('case-list');
  list.replaceChildren();
  if (!cases.length) {
    list.append(text('div', 'No cases yet.', 'muted'));
    return;
  }
  for (const c of cases) {
    const btn = document.createElement('button');
    btn.className = `case-item${activeCase && activeCase.caseId === c.caseId ? ' active' : ''}`;
    const status = c.status || 'open';
    btn.append(text('div', c.title, 'case-title'));
    btn.append(text('div', `${status.toUpperCase()} · updated ${new Date(c.updatedAt).toLocaleString()}`, 'case-meta'));
    btn.onclick = () => selectCase(c.caseId).catch(showError);
    list.append(btn);
  }
}

async function selectCase(id) {
  activeCase = await api(`/api/investigations/cases/${id}`);
  $('empty-state').hidden = true;
  $('case-workspace').hidden = false;
  $('active-title').textContent = activeCase.title;
  const status = activeCase.status || 'open';
  $('active-meta').textContent = `Case ${activeCase.caseId} · ${status.toUpperCase()}`;
  $('status-btn').textContent = status === 'closed' ? 'Reopen case' : 'Close case';
  $('evidence-form').querySelector('button[type="submit"]').disabled = status === 'closed';
  const details = $('case-details');
  details.replaceChildren(
    detail('Purpose', activeCase.purpose),
    detail('Scope', activeCase.scope),
    detail('Authorization basis', activeCase.authorization && activeCase.authorization.basis),
    detail('Authorization reference', activeCase.authorization && activeCase.authorization.reference),
    detail('Created', new Date(activeCase.createdAt).toLocaleString()),
    detail('Status', status.toUpperCase())
  );
  $('verification').replaceChildren();
  renderCases();
  await Promise.all([loadEvidence(), loadCorrelations()]);
}

async function loadEvidence() {
  if (!activeCase) return;
  const data = await api(`/api/investigations/cases/${activeCase.caseId}/evidence`);
  const items = data.evidence || [];
  $('evidence-count').textContent = String(items.length);
  const host = $('evidence-list');
  host.replaceChildren();
  if (!items.length) {
    host.append(text('div', 'No evidence ingested.', 'muted'));
    return;
  }
  for (const item of items.slice().reverse()) {
    const box = document.createElement('div');
    box.className = 'evidence';
    box.append(text('strong', `${item.kind} · ${item.source}`));
    box.append(text('div', `Collected ${new Date(item.collectedAt).toLocaleString()} · ${item.evidenceId}`, 'muted'));
    box.append(text('div', `SHA-256 ${item.sha256}`, 'hash'));
    if (item.recordHash) box.append(text('div', `Record hash ${item.recordHash}`, 'hash'));
    box.append(text('div', `${(item.indicators || []).length} technical indicators`, 'muted'));
    host.append(box);
  }
}

async function loadCorrelations() {
  if (!activeCase) return;
  const data = await api(`/api/investigations/cases/${activeCase.caseId}/correlations`);
  const host = $('correlations');
  host.replaceChildren();
  if (!data.sharedIndicators || !data.sharedIndicators.length) {
    host.append(text('div', 'No repeated technical indicators yet.', 'muted'));
    return;
  }
  for (const item of data.sharedIndicators) {
    const p = item.probabilityEstimate;
    const box = document.createElement('div');
    box.className = 'correlation';
    const head = document.createElement('div');
    head.className = 'corr-head';
    head.append(text('strong', `${item.type}: ${item.value}`));
    head.append(text('span', `${p.percent}% ${p.band}`, `score ${p.band}`));
    box.append(head);
    box.append(text('div', `${p.evidenceCount} evidence items · ${p.sourceCount} reported sources`, 'muted'));
    const ul = document.createElement('ul');
    ul.className = 'factors';
    for (const factor of p.factors) ul.append(text('li', factor));
    box.append(ul);
    host.append(box);
  }
}

async function verify() {
  const result = await api(`/api/investigations/cases/${activeCase.caseId}/verify`);
  const host = $('verification');
  host.replaceChildren();
  host.append(text('strong', result.allValid ? 'Integrity verification: PASS' : 'Integrity verification: FAIL', result.allValid ? 'verify-ok' : 'verify-bad'));
  host.append(text('div', `${result.evidenceCount} evidence items · ${result.legacyItems} legacy items · ${result.note}`, 'muted'));
}

function download(url) {
  if (!activeCase) return;
  window.location.href = url;
}

async function toggleStatus() {
  const next = (activeCase.status || 'open') === 'closed' ? 'open' : 'closed';
  activeCase = await api(`/api/investigations/cases/${activeCase.caseId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
  });
  toast(`Case ${next}.`);
  await loadCases(activeCase.caseId);
}

function showError(err) {
  console.error(err);
  toast(err.message || String(err));
}

$('case-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const created = await api('/api/investigations/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: $('case-title').value,
        purpose: $('case-purpose').value,
        scope: $('case-scope').value,
        authorization: {
          confirmed: $('auth-confirmed').checked,
          basis: $('auth-basis').value,
          reference: $('auth-reference').value,
        },
      }),
    });
    event.target.reset();
    toast('Authorized case created.');
    await loadCases(created.caseId);
  } catch (err) { showError(err); }
});

$('evidence-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeCase) return;
  try {
    const localTime = $('evidence-time').value;
    await api(`/api/investigations/cases/${activeCase.caseId}/evidence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: $('evidence-kind').value,
        source: $('evidence-source').value,
        collectedAt: localTime ? new Date(localTime).toISOString() : undefined,
        content: $('evidence-content').value,
      }),
    });
    $('evidence-content').value = '';
    toast('Evidence hashed and ingested.');
    await selectCase(activeCase.caseId);
  } catch (err) { showError(err); }
});

$('refresh-cases').onclick = () => loadCases().catch(showError);
$('refresh-correlation').onclick = () => loadCorrelations().catch(showError);
$('verify-btn').onclick = () => verify().catch(showError);
$('status-btn').onclick = () => toggleStatus().catch(showError);
$('report-btn').onclick = () => download(`/api/investigations/cases/${activeCase.caseId}/report`);
$('export-btn').onclick = () => download(`/api/investigations/cases/${activeCase.caseId}/export`);

loadCases().catch(showError);
