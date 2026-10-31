'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = process.env.QACKER_CASE_DIR || path.join(os.homedir(), '.qacker', 'investigations');

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
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  ensureDir(root);
  const dir = caseDir(root, record.caseId);
  fs.mkdirSync(dir, { recursive: false });
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(record, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'evidence.jsonl'), '', { encoding: 'utf8', flag: 'wx' });
  return record;
}

function readCase(caseId, root = DEFAULT_ROOT) {
  const file = path.join(caseDir(root, caseId), 'case.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listCases(root = DEFAULT_ROOT) {
  ensureDir(root);
  return fs.readdirSync(root)
    .filter((name) => /^[a-f0-9-]{36}$/i.test(name))
    .map((name) => {
      try { return readCase(name, root); } catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function appendEvidence(caseId, input, indicators = [], derived = {}, root = DEFAULT_ROOT) {
  const existingCase = readCase(caseId, root);
  const collectedAt = input.collectedAt ? new Date(input.collectedAt) : new Date();
  if (Number.isNaN(collectedAt.getTime())) throw new Error('Invalid collectedAt timestamp');

  const content = input.content;
  if (content === undefined) throw new Error('Evidence content is required');
  const serialized = typeof content === 'string' ? content : canonicalize(content);
  if (Buffer.byteLength(serialized, 'utf8') > 1024 * 1024) throw new Error('Evidence item exceeds 1 MiB limit');

  const evidence = {
    evidenceId: crypto.randomUUID(),
    caseId,
    kind: String(input.kind || 'observation').slice(0, 80),
    source: String(input.source || 'analyst-supplied').slice(0, 300),
    collectedAt: collectedAt.toISOString(),
    ingestedAt: new Date().toISOString(),
    sha256: hashContent(content),
    indicators,
    derived,
    content,
  };

  const file = path.join(caseDir(root, caseId), 'evidence.jsonl');
  fs.appendFileSync(file, `${JSON.stringify(evidence)}\n`, { encoding: 'utf8', flag: 'a' });

  existingCase.updatedAt = evidence.ingestedAt;
  fs.writeFileSync(path.join(caseDir(root, caseId), 'case.json'), JSON.stringify(existingCase, null, 2), 'utf8');
  return evidence;
}

function readEvidence(caseId, root = DEFAULT_ROOT) {
  readCase(caseId, root);
  const file = path.join(caseDir(root, caseId), 'evidence.jsonl');
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) return [];
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

module.exports = {
  DEFAULT_ROOT,
  appendEvidence,
  createCase,
  hashContent,
  listCases,
  readCase,
  readEvidence,
};
