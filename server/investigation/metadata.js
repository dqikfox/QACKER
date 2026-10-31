'use strict';

const net = require('net');

const RX = {
  ipv4: /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g,
  domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi,
  cve: /\bCVE-\d{4}-\d{4,7}\b/gi,
  mac: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/gi,
  sha256: /\b[a-f0-9]{64}\b/gi,
};

function flatten(value, out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => flatten(item, out));
    return out;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => {
      out.push(String(key));
      flatten(val, out);
    });
  }
  return out;
}

function isPrivateIpv4(ip) {
  if (net.isIP(ip) !== 4) return false;
  const p = ip.split('.').map(Number);
  return p[0] === 10
    || p[0] === 127
    || (p[0] === 169 && p[1] === 254)
    || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
    || (p[0] === 192 && p[1] === 168);
}

function extractIndicators(value) {
  const text = flatten(value).join('\n');
  const found = [];

  function add(type, raw, extra = {}) {
    const normalized = String(raw).toLowerCase();
    const key = `${type}:${normalized}`;
    if (!found.some((x) => x.key === key)) found.push({ key, type, value: raw, ...extra });
  }

  for (const ip of text.match(RX.ipv4) || []) {
    if (net.isIP(ip) === 4) add('ipv4', ip, { scope: isPrivateIpv4(ip) ? 'private' : 'public' });
  }
  for (const cve of text.match(RX.cve) || []) add('cve', cve.toUpperCase());
  for (const mac of text.match(RX.mac) || []) add('mac', mac.toUpperCase().replace(/-/g, ':'));
  for (const hash of text.match(RX.sha256) || []) add('sha256', hash.toLowerCase());
  for (const domain of text.match(RX.domain) || []) {
    if (!/^\d+(?:\.\d+){3}$/.test(domain)) add('domain', domain.toLowerCase());
  }

  return found.sort((a, b) => a.key.localeCompare(b.key));
}

module.exports = { extractIndicators, isPrivateIpv4 };
