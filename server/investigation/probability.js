'use strict';

const TYPE_BASE = Object.freeze({
  sha256: 0.82,
  mac: 0.66,
  domain: 0.54,
  ipv4: 0.50,
  cve: 0.20,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function band(score) {
  if (score >= 0.85) return 'very-high';
  if (score >= 0.70) return 'high';
  if (score >= 0.45) return 'moderate';
  return 'low';
}

function scoreTechnicalLink(indicator, evidenceItems) {
  const uniqueEvidence = [...new Map(evidenceItems.map((item) => [item.evidenceId, item])).values()];
  const uniqueSources = new Set(uniqueEvidence.map((item) => String(item.source || 'unknown').trim().toLowerCase()));

  let base = TYPE_BASE[indicator.type] ?? 0.35;
  const factors = [];

  if (indicator.type === 'ipv4' && indicator.scope === 'private') {
    base = 0.30;
    factors.push('Private IPv4 addresses are commonly reused across unrelated networks.');
  } else if (indicator.type === 'ipv4') {
    factors.push('Public IP addresses can still represent NAT, VPNs, relays, shared hosting, or reassignment.');
  }

  if (indicator.type === 'sha256') factors.push('An exact SHA-256 match is a comparatively specific technical linkage.');
  if (indicator.type === 'mac') factors.push('MAC addresses can be spoofed and are usually meaningful only within the observed network context.');
  if (indicator.type === 'domain') factors.push('Domains may be shared, compromised, reassigned, or fronted by common infrastructure.');
  if (indicator.type === 'cve') factors.push('A CVE is widely shared across systems and is weak evidence of a unique relationship by itself.');

  const repeatBonus = Math.min(0.18, Math.max(0, uniqueEvidence.length - 2) * 0.06);
  const sourceBonus = Math.min(0.16, Math.max(0, uniqueSources.size - 1) * 0.08);
  const singleSourcePenalty = uniqueSources.size <= 1 && uniqueEvidence.length > 1 ? 0.07 : 0;

  let score = clamp(base + repeatBonus + sourceBonus - singleSourcePenalty, 0.05, 0.97);
  score = Math.round(score * 1000) / 1000;

  if (uniqueEvidence.length > 2) factors.push(`Repeated across ${uniqueEvidence.length} distinct evidence items.`);
  if (uniqueSources.size > 1) factors.push(`Observed across ${uniqueSources.size} distinct reported sources.`);
  if (singleSourcePenalty) factors.push('All observations come from one reported source, reducing independence.');

  return {
    score,
    percent: Math.round(score * 100),
    band: band(score),
    calibrated: false,
    evidenceCount: uniqueEvidence.length,
    sourceCount: uniqueSources.size,
    factors,
    meaning: 'Heuristic confidence that the repeated technical indicator represents a meaningful technical linkage between the supplied evidence items.',
    notMeaning: 'Not a probability of identity, physical location, ownership, criminal conduct, or guilt.',
  };
}

module.exports = { scoreTechnicalLink };
