'use strict';

const $ = (id) => document.getElementById(id);
let cases = [];
let activeCase = null;
let map = null;
let mapLayer = null;
let operatorMarker = null;
let accuracyCircle = null;
let operatorWatchId = null;
let tracking = false;

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

function initMap() {
  if (map) return;
  map = L.map('map').setView([-33.87, 151.21], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  mapLayer = L.layerGroup().addTo(map);
}

function gpsStrengthLabel(accuracy) {
  if (!accuracy || accuracy <= 0) return 'unknown';
  if (accuracy < 10) return 'excellent';
  if (accuracy < 25) return 'good';
  if (accuracy < 50) return 'moderate';
  if (accuracy < 100) return 'poor';
  return 'weak';
}

function updateOperatorMarker(lat, lon, accuracy) {
  if (!map) return;
  const strength = gpsStrengthLabel(accuracy);
  const color = strength === 'excellent' || strength === 'good' ? '#6ee7b7' : strength === 'moderate' ? '#f2cc60' : '#ff7b72';

  if (!operatorMarker) {
    operatorMarker = L.circleMarker([lat, lon], {
      radius: 7,
      color: color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2,
    }).addTo(map);
  } else {
    operatorMarker.setLatLng([lat, lon]);
    operatorMarker.setStyle({ color, fillColor: color });
  }

  const accText = accuracy && accuracy > 0 ? `±${Math.round(accuracy)} m (${strength})` : 'unknown';
  operatorMarker.bindPopup(`Operator position (this device)<br>${accText}`);

  if (accuracy && accuracy > 0) {
    if (!accuracyCircle) {
      accuracyCircle = L.circle([lat, lon], {
        radius: accuracy,
        color: color,
        weight: 1,
        opacity: 0.5,
        fillColor: color,
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng([lat, lon]);
      accuracyCircle.setRadius(accuracy);
      accuracyCircle.setStyle({ color, fillColor: color });
    }
  } else if (accuracyCircle) {
    map.removeLayer(accuracyCircle);
    accuracyCircle = null;
  }

  const statusEl = $('map-status');
  if (statusEl && tracking) {
    const existing = statusEl.textContent.split(' | ')[0];
    statusEl.textContent = `${existing} | GPS: ${accText}`;
  }
}

function startTracking() {
  if (!navigator.geolocation) {
    toast('Geolocation not supported');
    return;
  }
  if (tracking) return;
  tracking = true;
  $('toggle-location').textContent = 'Stop tracking';
  operatorWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      updateOperatorMarker(latitude, longitude, accuracy);
    },
    (err) => {
      toast(err.message || 'Location error');
      stopTracking();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
  toast('Operator location tracking started');
}

function stopTracking() {
  if (operatorWatchId !== null) {
    navigator.geolocation.clearWatch(operatorWatchId);
    operatorWatchId = null;
  }
  tracking = false;
  if (operatorMarker) {
    map.removeLayer(operatorMarker);
    operatorMarker = null;
  }
  if (accuracyCircle) {
    map.removeLayer(accuracyCircle);
    accuracyCircle = null;
  }
  if ($('toggle-location')) $('toggle-location').textContent = 'Track my position';
}

function toggleTracking() {
  if (tracking) stopTracking();
  else startTracking();
}

function plotMediaLocation(item, bounds) {
  let loc = item.derived && item.derived.location;
  if (!loc && item.content && typeof item.content === 'object') loc = item.content.location;
  if (!loc || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lon))) return;
  const lat = Number(loc.lat);
  const lon = Number(loc.lon);
  const mediaType = (item.derived && item.derived.mediaType) || (item.content && item.content.mediaType) || 'media';
  const m = L.circleMarker([lat, lon], {
    radius: 6,
    color: '#79c0ff',
    fillColor: '#79c0ff',
    fillOpacity: 0.8,
    weight: 2,
  }).addTo(mapLayer);
  m.bindPopup(`<b>Media GPS</b> (${mediaType})<br>${item.source || ''}<br>${lat.toFixed(6)}, ${lon.toFixed(6)}<br>${item.evidenceId}`);
  bounds.push([lat, lon]);
}

async function loadMap() {
  if (!activeCase || !map) return;
  mapLayer.clearLayers();
  $('map-status').textContent = 'Loading…';
  try {
    const [evidenceRes, triRes] = await Promise.all([
      api(`/api/investigations/cases/${activeCase.caseId}/evidence`),
      api(`/api/investigations/cases/${activeCase.caseId}/triangulate`),
    ]);
    const items = evidenceRes.evidence || [];
    const stations = [];
    for (const item of items) {
      if (String(item.kind || '').toLowerCase() !== 'bearing') continue;
      const c = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
      const lat = Number(c.station_lat ?? c.lat);
      const lon = Number(c.station_lon ?? c.lon);
      const bearing = Number(c.bearing_deg ?? c.bearing);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        stations.push({ lat, lon, bearing, source: item.source, id: item.evidenceId });
      }
    }

    const bounds = [];
    for (const s of stations) {
      const m = L.marker([s.lat, s.lon]).addTo(mapLayer);
      m.bindPopup(`<b>${s.source || 'Station'}</b><br>Bearing: ${Number.isFinite(s.bearing) ? s.bearing.toFixed(1) + '°' : 'n/a'}<br>${s.id}`);
      bounds.push([s.lat, s.lon]);

      if (Number.isFinite(s.bearing)) {
        const rad = s.bearing * Math.PI / 180;
        const km = 5;
        const dLat = (km / 111.32) * Math.cos(rad);
        const dLon = (km / (111.32 * Math.cos(s.lat * Math.PI / 180))) * Math.sin(rad);
        const end = [s.lat + dLat, s.lon + dLon];
        L.polyline([[s.lat, s.lon], end], { color: '#6ee7b7', weight: 2, opacity: 0.7 }).addTo(mapLayer);
      }
    }

    for (const item of items) {
      if (String(item.kind || '').toLowerCase() === 'media-metadata') {
        plotMediaLocation(item, bounds);
      }
    }

    if (triRes && triRes.ok && triRes.fix) {
      const f = triRes.fix;
      const fixMarker = L.circleMarker([f.lat, f.lon], {
        radius: 8,
        color: '#ff7b72',
        fillColor: '#ff7b72',
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(mapLayer);
      fixMarker.bindPopup(`<b>Triangulation fix</b><br>${f.lat.toFixed(6)}, ${f.lon.toFixed(6)}<br>${f.stations} stations · ${f.pairs} pairs`);
      bounds.push([f.lat, f.lon]);
      $('map-status').textContent = `Fix: ${f.lat.toFixed(5)}, ${f.lon.toFixed(5)} (${f.stations} stations)`;
    } else {
      $('map-status').textContent = triRes && triRes.error ? triRes.error : `${stations.length} station(s) · no fix yet`;
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  } catch (err) {
    $('map-status').textContent = err.message || 'Map load failed';
  }
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
  const mediaBtn = $('media-form') && $('media-form').querySelector('button[type="submit"]');
  if (mediaBtn) mediaBtn.disabled = status === 'closed';
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
  initMap();
  setTimeout(() => map && map.invalidateSize(), 100);
  await Promise.all([loadEvidence(), loadCorrelations(), loadMap()]);
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
    let content = $('evidence-content').value;
    const kind = $('evidence-kind').value;
    if (kind === 'bearing') {
      try { content = JSON.parse(content); } catch (_) { /* keep as string */ }
    }
    await api(`/api/investigations/cases/${activeCase.caseId}/evidence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        source: $('evidence-source').value,
        collectedAt: localTime ? new Date(localTime).toISOString() : undefined,
        content,
      }),
    });
    $('evidence-content').value = '';
    toast('Evidence hashed and ingested.');
    await selectCase(activeCase.caseId);
  } catch (err) { showError(err); }
});

$('media-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeCase) return;
  try {
    const result = await api(`/api/investigations/cases/${activeCase.caseId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: $('media-path').value.trim(),
        source: $('media-source').value.trim() || 'exiftool',
      }),
    });
    $('media-path').value = '';
    const loc = result.extracted && result.extracted.location;
    toast(loc ? `Media ingested · GPS ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}` : 'Media metadata ingested (no GPS).');
    await selectCase(activeCase.caseId);
  } catch (err) { showError(err); }
});

$('refresh-cases').onclick = () => loadCases().catch(showError);
$('refresh-correlation').onclick = () => loadCorrelations().catch(showError);
$('refresh-map').onclick = () => loadMap().catch(showError);
$('toggle-location').onclick = toggleTracking;
$('verify-btn').onclick = () => verify().catch(showError);
$('status-btn').onclick = () => toggleStatus().catch(showError);
$('report-btn').onclick = () => download(`/api/investigations/cases/${activeCase.caseId}/report`);
$('export-btn').onclick = () => download(`/api/investigations/cases/${activeCase.caseId}/export`);

loadCases().catch(showError);
