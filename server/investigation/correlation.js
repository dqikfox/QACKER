'use strict';

function correlate(evidenceItems) {
  const byIndicator = new Map();

  for (const evidence of evidenceItems) {
    for (const indicator of evidence.indicators || []) {
      const key = indicator.key || `${indicator.type}:${String(indicator.value).toLowerCase()}`;
      if (!byIndicator.has(key)) byIndicator.set(key, { ...indicator, evidenceIds: [] });
      byIndicator.get(key).evidenceIds.push(evidence.evidenceId);
    }
  }

  const shared = [...byIndicator.values()]
    .filter((item) => new Set(item.evidenceIds).size > 1)
    .map((item) => ({ ...item, evidenceIds: [...new Set(item.evidenceIds)] }))
    .sort((a, b) => b.evidenceIds.length - a.evidenceIds.length || a.key.localeCompare(b.key));

  const edges = [];
  for (const indicator of shared) {
    for (const evidenceId of indicator.evidenceIds) {
      edges.push({ from: evidenceId, to: indicator.key, relationship: 'contains-indicator' });
    }
  }

  return {
    evidenceCount: evidenceItems.length,
    uniqueIndicatorCount: byIndicator.size,
    sharedIndicatorCount: shared.length,
    sharedIndicators: shared,
    edges,
    caution: 'Correlation identifies repeated technical indicators only. It does not establish a person\'s identity, location, ownership, or guilt.',
  };
}

module.exports = { correlate };
