'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCase, appendEvidence, readEvidence, hashContent } = require('../investigation/evidenceStore');
const { extractIndicators } = require('../investigation/metadata');
const { correlate } = require('../investigation/correlation');
const { parseMetasploitOutput } = require('../investigation/metasploit');
const { buildReport } = require('../investigation/report');

describe('QACKER investigation core', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'qacker-case-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test('requires explicit authorization', () => {
    expect(() => createCase({ title: 'x' }, root)).toThrow(/authorization/i);
  });

  test('hashes and correlates repeated technical indicators', () => {
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
    expect(result.sharedIndicators.some((x) => x.value === 'demo.example')).toBe(true);

    const report = buildReport(c, items);
    expect(report).toContain('Shared Technical Indicators');
    expect(report).toContain('demo.example');
  });

  test('parses supplied Metasploit output without executing it', () => {
    const parsed = parseMetasploitOutput('[*] exploit/test/module CVE-2026-1234 on 192.168.1.10\n[+] Meterpreter session 2 opened');
    expect(parsed.modules).toContain('exploit/test/module');
    expect(parsed.sessionsOpened).toContain(2);
    expect(parsed.status).toBe('session-observed');
  });
});
