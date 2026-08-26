'use strict';

const { scoreTechnicalLink } = require('./probability');

function correlate(evidenceItems) {
  const byIndicator = new Map();
  const evidenceById = new Map(evidenceItems.map((item) => [item.evidenceId, item]));

  for (const evidence of evidenceItems) {
    for (const indicator of evidence.indicators || []) {
      const key = indicator.key || `${indicator.type}:${String(indicator.value).toLowerCase()}`;
      if (!byIndicator.has(key)) byIndicator.set(key, { ...indicator, evidenceIds: [] });
      byIndicator.get(key).evidenceIds.push(evidence.evidenceId);
    }
  }

  const shared = [...byIndicator.values()]
    .filter((item) => new Set(item.evidenceIds).size > 1)
    .map((item) => {
      const evidenceIds = [...new Set(item.evidenceIds)];
      const linkedEvidence = evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean);
      return {
        ...item,
        evidenceIds,
        probabilityEstimate: scoreTechnicalLink(item, linkedEvidence),
      };
    })
    .sort((a, b) => {
      const scoreDiff = b.probabilityEstimate.score - a.probabilityEstimate.score;
      return scoreDiff || b.evidenceIds.length - a.evidenceIds.length || a.key.localeCompare(b.key);
    });

  const edges = [];
  for (const indicator of shared) {
    for (const evidenceId of indicator.evidenceIds) {
      edges.push({
        from: evidenceId,
        to: indicator.key,
        relationship: 'contains-indicator',
        probabilityEstimate: indicator.probabilityEstimate,
      });
    }
  }

  return {
    evidenceCount: evidenceItems.length,
    uniqueIndicatorCount: byIndicator.size,
    sharedIndicatorCount: shared.length,
    sharedIndicators: shared,
    edges,
    methodology: {
      calibratedProbability: false,
      description: 'Scores are explainable heuristics for technical-link strength, based on indicator specificity, repeated evidence, and reported source diversity.',
    },
    caution: 'Correlation scores describe technical linkage only. They do not establish a person\'s identity, location, ownership, criminal conduct, or guilt.',
  };
}

module.exports = { correlate };
