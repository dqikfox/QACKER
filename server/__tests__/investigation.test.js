'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCase, appendEvidence, readEvidence, hashContent } = require('../investigation/evidenceStore');
const { extractIndicators } = require('../investigation/metadata');
const { correlate } = require('../investigation/correlation');
const { parseMetasploitOutput } = require('../investigation/metasploit');
const { buildReport } = require('../investigation/report');
const { scoreTechnicalLink } = require('../investigation/probability');

describe('QACKER investigation core', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'qacker-case-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test('requires explicit authorization', () => {
    expect(() => createCase({ title: 'x' }, root)).toThrow(/authorization/i);
  });

  test('hashes, correlates, and scores repeated technical indicators', () => {
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

    const result = correlate(items);
    const domain = result.sharedIndicators.find((x) => x.value === 'demo.example');
    expect(domain).toBeTruthy();
    expect(domain.probabilityEstimate.percent).toBeGreaterThan(0);
    expect(domain.probabilityEstimate.calibrated).toBe(false);
    expect(result.methodology.calibratedProbability).toBe(false);

    const report = buildReport(c, items);
    expect(report).toContain('Shared Technical Indicators');
    expect(report).toContain('Link confidence');
    expect(report).toContain('demo.example');
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
});
