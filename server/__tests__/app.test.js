'use strict';

const request = require('supertest');
const { createApp } = require('../app');

describe('dashboard API', () => {
  const app = createApp();

  // ── Tool catalogue ────────────────────────────────────────────
  test('GET /api/tools lists all configured tools', async () => {
    const res = await request(app).get('/api/tools');
    expect(res.status).toBe(200);
    expect(res.body.tools).toBeInstanceOf(Array);

    const ids = res.body.tools.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'nmap', 'nikto', 'sqlmap', 'nuclei', 'ffuf', 'gobuster', 'feroxbuster',
        'httpx', 'subfinder', 'amass', 'katana', 'waybackurls', 'whatweb',
        'dalfox', 'arjun', 'msfconsole', 'msfvenom',
        'hydra', 'john', 'hashcat', 'wpscan',
        'shell', 'curl', 'dig', 'whois',
        'ping', 'traceroute', 'openssl', 'sslscan',
        'enum4linux', 'smbclient', 'crackmapexec',
      ])
    );
    expect(res.body.categories).toBeDefined();
  });

  // ── Run endpoint ──────────────────────────────────────────────
  test('POST /api/tools/:toolId/run rejects unknown tool', async () => {
    const res = await request(app).post('/api/tools/not-a-tool/run').send({});
    expect(res.status).toBe(404);
  });

  test('POST /api/tools/:toolId/run validates required fields', async () => {
    const res = await request(app).post('/api/tools/nmap/run').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/target/i);
  });

  test('POST /api/tools/:toolId/run returns command and args shape on call', async () => {
    // We only need to verify the HTTP layer — a 200 with { command, args } shape.
    // Use nmap with a missing-field trigger so we get back a clean 400 (no tool exec needed),
    // then separately verify the 200 path with a tool that exits quickly.
    const badRes = await request(app).post('/api/tools/nmap/run').send({});
    expect(badRes.status).toBe(400);
    expect(badRes.body).toHaveProperty('error');

    // Verify 200 shape: the runner returns { command, args } even when the tool
    // isn't installed (ENOENT). Use a non-existent binary to keep the test fast.
    const tool = 'subfinder';   // real tool id, real field shape
    const res  = await request(app)
      .post(`/api/tools/${tool}/run`)
      .send({ domain: 'localhost' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('command');
    expect(res.body).toHaveProperty('args');
  }, 15000);

  // ── SecLists ──────────────────────────────────────────────────
  test('GET /api/seclists returns availability info', async () => {
    const res = await request(app).get('/api/seclists');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('available');
  });

  test('GET /api/seclists rejects path traversal', async () => {
    const res = await request(app).get('/api/seclists').query({ path: '../../etc' });
    expect(res.status).toBe(400);
  });

  // ── Config endpoint ───────────────────────────────────────────
  test('GET /api/config returns server configuration', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('port');
    expect(res.body).toHaveProperty('useWsl');
    expect(res.body).toHaveProperty('wslToolPaths');
    expect(res.body).toHaveProperty('seclistsRoot');
  });

  // ── Status endpoint ───────────────────────────────────────────
  test('GET /api/status includes activeProcs and uptime', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.activeProcs).toBe('number');
    expect(typeof res.body.uptime).toBe('number');
  });

  // ── Kill endpoint ─────────────────────────────────────────────
  test('POST /api/kill/:pid returns 404 for unknown pid', async () => {
    const res = await request(app).post('/api/kill/999999');
    expect(res.status).toBe(404);
  });

  // ── Loot endpoint ─────────────────────────────────────────────
  test('GET /api/loot returns loot directory listing', async () => {
    const res = await request(app).get('/api/loot');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lootDir');
    expect(Array.isArray(res.body.files)).toBe(true);
  });

  test('POST /api/loot saves a file and returns name', async () => {
    const res = await request(app)
      .post('/api/loot')
      .send({ filename: 'test-loot.txt', content: 'test content from jest' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.name).toMatch(/test-loot\.txt$/);
  });

  test('POST /api/loot rejects missing fields', async () => {
    const res = await request(app).post('/api/loot').send({ filename: 'x.txt' });
    expect(res.status).toBe(400);
  });
});
