'use strict';

const { correlate } = require('./correlation');

function esc(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').trim();
}

function buildReport(caseRecord, evidenceItems) {
  const correlation = correlate(evidenceItems);
  const lines = [
    `# QACKER Investigation Report — ${esc(caseRecord.title)}`,
    '',
    `- **Case ID:** ${caseRecord.caseId}`,
    `- **Created:** ${caseRecord.createdAt}`,
    `- **Updated:** ${caseRecord.updatedAt}`,
    `- **Purpose:** ${esc(caseRecord.purpose)}`,
    `- **Scope:** ${esc(caseRecord.scope) || 'Not specified'}`,
    `- **Authorization basis:** ${esc(caseRecord.authorization && caseRecord.authorization.basis)}`,
    `- **Authorization reference:** ${esc(caseRecord.authorization && caseRecord.authorization.reference) || 'Not specified'}`,
    '',
    '## Evidence Inventory',
    '',
  ];

  if (!evidenceItems.length) lines.push('_No evidence items have been ingested._', '');

  for (const item of evidenceItems) {
    lines.push(
      `### ${item.evidenceId}`,
      '',
      `- Kind: ${esc(item.kind)}`,
      `- Source: ${esc(item.source)}`,
      `- Collected: ${item.collectedAt}`,
      `- Ingested: ${item.ingestedAt}`,
      `- SHA-256: \`${item.sha256}\``,
      `- Technical indicators: ${(item.indicators || []).length}`,
      ''
    );
  }

  lines.push('## Shared Technical Indicators', '');
  if (!correlation.sharedIndicators.length) {
    lines.push('_No repeated technical indicators were found across evidence items._', '');
  } else {
    lines.push('| Type | Value | Evidence count |', '|---|---|---:|');
    for (const indicator of correlation.sharedIndicators) {
      lines.push(`| ${indicator.type} | \`${esc(indicator.value)}\` | ${indicator.evidenceIds.length} |`);
    }
    lines.push('');
  }

  lines.push(
    '## Investigative Caution',
    '',
    'Technical indicators are investigative leads, not proof of identity, physical location, ownership, criminal conduct, or guilt. Attribution should be corroborated through lawful provider records, forensic examination, and appropriate investigative process.',
    '',
    'This report records analyst-supplied observations and derived technical correlations. QACKER does not independently verify the truth of submitted content.',
    ''
  );

  return lines.join('\n');
}

module.exports = { buildReport };
