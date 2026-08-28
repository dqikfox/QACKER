'use strict';

/**
 * Launcher smoke tests.
 *
 * Verifies that the startup scripts exist and are well-formed, that the
 * server module boots and binds to a port, and that all critical routes
 * respond correctly once it's up.
 */

const fs      = require('fs');
const path    = require('path');
const http    = require('http');
const { createApp } = require('../app');
const config        = require('../config');

const ROOT = path.join(__dirname, '..', '..');

// ── Launcher file checks ─────────────────────────────────────────────────────

describe('launcher files', () => {
  test('start-qacker.bat exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'start-qacker.bat'))).toBe(true);
  });

  test('start-qacker.sh exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'start-qacker.sh'))).toBe(true);
  });

  test('start-qacker.bat contains node server/index.js', () => {
    const bat = fs.readFileSync(path.join(ROOT, 'start-qacker.bat'), 'utf8');
    expect(bat).toMatch(/node\s+server[\\\/]index\.js/i);
  });

  test('start-qacker.bat opens the browser (Start-Process or start)', () => {
    const bat = fs.readFileSync(path.join(ROOT, 'start-qacker.bat'), 'utf8');
    // Should contain the PowerShell browser-open or a 'start' command
    expect(bat).toMatch(/Start-Process|start\s+""/i);
  });

  test('start-qacker.bat polls for server readiness before opening browser', () => {
    // The polling logic lives in open-browser.ps1 (called by the bat).
    // Verify the bat calls the ps1 AND the ps1 contains the readiness check.
    const bat = fs.readFileSync(path.join(ROOT, 'start-qacker.bat'), 'utf8');
    expect(bat).toMatch(/open-browser\.ps1/i);

    const ps1 = fs.readFileSync(path.join(ROOT, 'open-browser.ps1'), 'utf8');
    expect(ps1).toMatch(/api\/status/i);
  });

  test('start-qacker.sh uses exec node server/index.js', () => {
    const sh = fs.readFileSync(path.join(ROOT, 'start-qacker.sh'), 'utf8');
    expect(sh).toMatch(/exec\s+node\s+server\/index\.js/);
  });

  test('start-qacker.bat has error handling for missing node', () => {
    const bat = fs.readFileSync(path.join(ROOT, 'start-qacker.bat'), 'utf8');
    expect(bat).toMatch(/where node/i);
    expect(bat).toMatch(/errorlevel 1/i);
  });

  test('start-qacker.bat installs deps if node_modules missing', () => {
    const bat = fs.readFileSync(path.join(ROOT, 'start-qacker.bat'), 'utf8');
    expect(bat).toMatch(/node_modules/);
    expect(bat).toMatch(/npm install/i);
  });
});

// ── Server boot + HTTP round-trip ─────────────────────────────────────────────

describe('server boot', () => {
  let server;
  let baseUrl;

  beforeAll(() => new Promise((resolve) => {
    const app = createApp();
    // Use port 0 → OS picks a free ephemeral port so tests never clash
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  }));

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  function get(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(baseUrl + urlPath, (res) => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
          catch { resolve({ status: res.statusCode, body }); }
        });
      }).on('error', reject);
    });
  }

  test('GET / serves the dashboard HTML', () => new Promise((resolve, reject) => {
    http.get(baseUrl + '/', (res) => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try {
          expect(res.statusCode).toBe(200);
          expect(body).toMatch(/QACKER/i);
          expect(body).toMatch(/<html/i);
          resolve();
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  }));

  test('GET /api/status responds with ok:true and uptime', async () => {
    const { status, body } = await get('/api/status');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/status reports correct tool count', async () => {
    const { body } = await get('/api/status');
    expect(body.toolCount).toBeGreaterThanOrEqual(32);
  });

  test('GET /api/tools returns full tool list with categories', async () => {
    const { status, body } = await get('/api/tools');
    expect(status).toBe(200);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBeGreaterThanOrEqual(32);
    expect(typeof body.categories).toBe('object');
    // All 9 categories present
    ['recon','web','network','exploit','payload','brute','cms','utils','smb'].forEach(cat => {
      expect(body.categories).toHaveProperty(cat);
    });
  });

  test('GET /api/config returns server configuration with expected keys', async () => {
    const { status, body } = await get('/api/config');
    expect(status).toBe(200);
    ['port','host','useWsl','wslToolPaths','timeoutMs','seclistsRoot','platform','nodeVersion'].forEach(key => {
      expect(body).toHaveProperty(key);
    });
  });

  test('GET /api/loot returns lootDir and files array', async () => {
    const { status, body } = await get('/api/loot');
    expect(status).toBe(200);
    expect(body).toHaveProperty('lootDir');
    expect(Array.isArray(body.files)).toBe(true);
  });

  test('POST /api/tools/unknown/run returns 404', async () => {
    const { status } = await new Promise((resolve, reject) => {
      const data = JSON.stringify({});
      const req = http.request(baseUrl + '/api/tools/not-a-tool/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      }, (res) => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    expect(status).toBe(404);
  });

  test('POST /api/kill/999999 returns 404 for unknown pid', async () => {
    const { status } = await new Promise((resolve, reject) => {
      const req = http.request(baseUrl + '/api/kill/999999', { method: 'POST' }, (res) => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode }));
      });
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(404);
  });

  test('GET /api/seclists returns { available, entries }', async () => {
    const { status, body } = await get('/api/seclists');
    expect(status).toBe(200);
    expect(body).toHaveProperty('available');
    // entries is an array (may be empty if SecLists not installed)
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test('serves static JS bundle at /app.js', () => new Promise((resolve, reject) => {
    http.get(baseUrl + '/app.js', (res) => {
      try {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/javascript/i);
        res.resume();
        resolve();
      } catch (e) { reject(e); }
    }).on('error', reject);
  }));

  test('serves static CSS at /style.css', () => new Promise((resolve, reject) => {
    http.get(baseUrl + '/style.css', (res) => {
      try {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/css/i);
        res.resume();
        resolve();
      } catch (e) { reject(e); }
    }).on('error', reject);
  }));
});
