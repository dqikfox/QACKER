'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = process.env.QACKER_CASE_DIR || path.join(os.homedir(), '.qacker', 'investigations');
const VALID_STATUSES = new Set(['open', 'closed']);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function caseDir(root, caseId) {
  if (!/^[a-f0-9-]{36}$/i.test(caseId)) throw new Error('Invalid case id');
  return path.join(root, caseId);
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

function hashContent(content) {
  const raw = typeof content === 'string' ? content : canonicalize(content);
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function recordHashFor(item) {
  const copy = { ...item };
  delete copy.recordHash;
  return hashContent(copy);
}

function writeCase(record, root) {
  fs.writeFileSync(path.join(caseDir(root, record.caseId), 'case.json'), JSON.stringify(record, null, 2), 'utf8');
}

function createCase(input, root = DEFAULT_ROOT) {
  const authorization = input && input.authorization;
  if (!authorization || authorization.confirmed !== true || !String(authorization.basis || '').trim()) {
    throw new Error('Explicit authorization confirmation and basis are required');
  }

  const now = new Date().toISOString();
  const record = {
    caseId: crypto.randomUUID(),
    title: String(input.title || 'Untitled investigation').slice(0, 160),
    purpose: String(input.purpose || 'Authorized defensive security investigation').slice(0, 500),
    scope: String(input.scope || '').slice(0, 2000),
    authorization: {
      confirmed: true,
      basis: String(authorization.basis).slice(0, 1000),
      reference: String(authorization.reference || '').slice(0, 500),
    },
    status: 'open',
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    schemaVersion: 2,
  };

  ensureDir(root);
  const dir = caseDir(root, record.caseId);
  fs.mkdirSync(dir, { recursive: false });
  writeCase(record, root);
  fs.writeFileSync(path.join(dir, 'evidence.jsonl'), '', { encoding: 'utf8', flag: 'wx' });
  return record;
}

function readCase(caseId, root = DEFAULT_ROOT) {
  const file = path.join(caseDir(root, caseId), 'case.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!record.status) record.status = 'open';
  return record;
}

function listCases(root = DEFAULT_ROOT) {
  ensureDir(root);
  return fs.readdirSync(root)
    .filter((name) => /^[a-f0-9-]{36}$/i.test(name))
    .map((name) => {
      try { return readCase(name, root); } catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function readEvidence(caseId, root = DEFAULT_ROOT) {
  readCase(caseId, root);
  const file = path.join(caseDir(root, caseId), 'evidence.jsonl');
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) return [];
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

function appendEvidence(caseId, input, indicators = [], derived = {}, root = DEFAULT_ROOT) {
  const existingCase = readCase(caseId, root);
  if (existingCase.status === 'closed') throw new Error('Case is closed; reopen it before adding evidence');

  const collectedAt = input.collectedAt ? new Date(input.collectedAt) : new Date();
  if (Number.isNaN(collectedAt.getTime())) throw new Error('Invalid collectedAt timestamp');

  const content = input.content;
  if (content === undefined) throw new Error('Evidence content is required');
  const serialized = typeof content === 'string' ? content : canonicalize(content);
  if (Buffer.byteLength(serialized, 'utf8') > 1024 * 1024) throw new Error('Evidence item exceeds 1 MiB limit');

  const prior = readEvidence(caseId, root);
  const previous = prior.length ? prior[prior.length - 1] : null;
  const previousRecordHash = previous ? (previous.recordHash || recordHashFor(previous)) : null;

  const evidence = {
    evidenceId: crypto.randomUUID(),
    caseId,
    kind: String(input.kind || 'observation').slice(0, 80),
    source: String(input.source || 'analyst-supplied').slice(0, 300),
    collectedAt: collectedAt.toISOString(),
    ingestedAt: new Date().toISOString(),
    sha256: hashContent(content),
    previousRecordHash,
    indicators,
    derived,
    content,
  };
  evidence.recordHash = recordHashFor(evidence);

  const file = path.join(caseDir(root, caseId), 'evidence.jsonl');
  fs.appendFileSync(file, `${JSON.stringify(evidence)}\n`, { encoding: 'utf8', flag: 'a' });

  existingCase.updatedAt = evidence.ingestedAt;
  existingCase.schemaVersion = Math.max(Number(existingCase.schemaVersion) || 1, 2);
  writeCase(existingCase, root);
  return evidence;
}

function updateCaseStatus(caseId, status, root = DEFAULT_ROOT) {
  const normalized = String(status || '').toLowerCase();
  if (!VALID_STATUSES.has(normalized)) throw new Error('Status must be open or closed');
  const record = readCase(caseId, root);
  const now = new Date().toISOString();
  record.status = normalized;
  record.updatedAt = now;
  record.closedAt = normalized === 'closed' ? now : null;
  record.schemaVersion = Math.max(Number(record.schemaVersion) || 1, 2);
  writeCase(record, root);
  return record;
}

function verifyEvidence(caseId, root = DEFAULT_ROOT) {
  const items = readEvidence(caseId, root);
  let previousRecordHash = null;
  let legacyItems = 0;

  const results = items.map((item) => {
    const computedContentHash = hashContent(item.content);
    const computedRecordHash = recordHashFor(item);
    const hasRecordHash = typeof item.recordHash === 'string' && item.recordHash.length > 0;
    if (!hasRecordHash) legacyItems += 1;

    const contentValid = computedContentHash === item.sha256;
    const recordValid = !hasRecordHash || computedRecordHash === item.recordHash;
    const chainValid = !hasRecordHash || (item.previousRecordHash || null) === previousRecordHash;

    previousRecordHash = hasRecordHash ? item.recordHash : computedRecordHash;

    return {
      evidenceId: item.evidenceId,
      contentValid,
      recordValid,
      chainValid,
      legacy: !hasRecordHash,
      expectedContentHash: item.sha256,
      computedContentHash,
      storedRecordHash: item.recordHash || null,
      computedRecordHash,
    };
  });

  return {
    caseId,
    evidenceCount: items.length,
    legacyItems,
    allValid: results.every((r) => r.contentValid && r.recordValid && r.chainValid),
    results,
    note: legacyItems
      ? 'Legacy evidence predating record chaining is content-hash verified but cannot provide the same chained-record assurance.'
      : 'All evidence items use content hashes and chained record hashes.',
  };
}

module.exports = {
  DEFAULT_ROOT,
  appendEvidence,
  createCase,
  hashContent,
  listCases,
  readCase,
  readEvidence,
  updateCaseStatus,
  verifyEvidence,
};
