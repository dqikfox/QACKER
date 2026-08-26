'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const {
  createCase,
  appendEvidence,
  readEvidence,
  hashContent,
  updateCaseStatus,
  verifyEvidence,
} = require('../investigation/evidenceStore');
const { extractIndicators } = require('../investigation/metadata');
const { correlate } = require('../investigation/correlation');
const { parseMetasploitOutput } = require('../investigation/metasploit');
const { buildReport } = require('../investigation/report');
const { scoreTechnicalLink } = require('../investigation/probability');
const { createInvestigationRouter } = require('../investigation/router');

describe('QACKER investigation core', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'qacker-case-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test('requires explicit authorization', () => {
    expect(() => createCase({ title: 'x' }, root)).toThrow(/authorization/i);
  });

  test('hashes, chains, verifies, correlates, and scores evidence', () => {
    const c = createCase({
      title: 'Lab case',
      authorization: { confirmed: true, basis: 'Owned lab environment' },
    }, root);

    const firstContent = 'Observed 203.0.113.10 and demo.example during controlled validation';
    const secondContent = 'Follow-up log references demo.example and CVE-2025-12345';

    appendEvidence(c.caseId, { content: firstContent, source: 'lab-1' }, extractIndicators(firstContent), {}, root);
    appendEvidence(c.caseId, { content: secondContent, source: 'lab-2' }, extractIndicators(secondContent), {}, root);

    const items = readEvidence(c.caseId, root);
    expect(items).toHaveLength(2);
    expect(items[0].sha256).toBe(hashContent(firstContent));
    expect(items[1].previousRecordHash).toBe(items[0].recordHash);
    expect(verifyEvidence(c.caseId, root).allValid).toBe(true);

    const result = correlate(items);
    const domain = result.sharedIndicators.find((x) => x.value === 'demo.example');
    expect(domain).toBeTruthy();
    expect(domain.probabilityEstimate.percent).toBeGreaterThan(0);
    expect(domain.probabilityEstimate.calibrated).toBe(false);

    const report = buildReport(c, items);
    expect(report).toContain('Link confidence');
    expect(report).toContain('demo.example');
  });

  test('closed cases reject new evidence until reopened', () => {
    const c = createCase({ authorization: { confirmed: true, basis: 'Owned lab' } }, root);
    expect(updateCaseStatus(c.caseId, 'closed', root).status).toBe('closed');
    expect(() => appendEvidence(c.caseId, { content: 'x' }, [], {}, root)).toThrow(/closed/i);
    expect(updateCaseStatus(c.caseId, 'open', root).status).toBe('open');
    expect(() => appendEvidence(c.caseId, { content: 'x' }, [], {}, root)).not.toThrow();
  });

  test('scores more specific repeated indicators above broad CVE matches', () => {
    const evidence = [
      { evidenceId: '1', source: 'source-a' },
      { evidenceId: '2', source: 'source-b' },
    ];
    const hash = scoreTechnicalLink({ type: 'sha256', value: 'a'.repeat(64) }, evidence);
    const cve = scoreTechnicalLink({ type: 'cve', value: 'CVE-2026-1234' }, evidence);
    expect(hash.score).toBeGreaterThan(cve.score);
    expect(hash.notMeaning).toMatch(/not a probability of identity/i);
  });

  test('parses supplied Metasploit output without executing it', () => {
    const parsed = parseMetasploitOutput('[*] exploit/test/module CVE-2026-1234 on 192.168.1.10\n[+] Meterpreter session 2 opened');
    expect(parsed.modules).toContain('exploit/test/module');
    expect(parsed.sessionsOpened).toContain(2);
    expect(parsed.status).toBe('session-observed');
  });

  test('API supports case lifecycle, verification, probabilities, and export', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/investigations', createInvestigationRouter({ root }));

    const created = await request(app).post('/api/investigations/cases').send({
      title: 'API lab',
      authorization: { confirmed: true, basis: 'Owned test environment' },
    });
    expect(created.status).toBe(201);
    const id = created.body.caseId;

    await request(app).post(`/api/investigations/cases/${id}/evidence`).send({
      source: 'sensor-a', content: 'demo.example 203.0.113.20',
    }).expect(201);
    await request(app).post(`/api/investigations/cases/${id}/evidence`).send({
      source: 'sensor-b', content: 'demo.example',
    }).expect(201);

    const correlations = await request(app).get(`/api/investigations/cases/${id}/correlations`).expect(200);
    expect(correlations.body.sharedIndicators[0]).toHaveProperty('probabilityEstimate');

    const verification = await request(app).get(`/api/investigations/cases/${id}/verify`).expect(200);
    expect(verification.body.allValid).toBe(true);

    const exported = await request(app).get(`/api/investigations/cases/${id}/export`).expect(200);
    expect(exported.body.format).toBe('qacker-investigation-export-v1');
    expect(exported.body.verification.allValid).toBe(true);
  });
});
