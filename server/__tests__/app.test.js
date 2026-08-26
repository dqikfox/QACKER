'use strict';

const request = require('supertest');
const { createApp } = require('../app');

describe('dashboard API', () => {
  const app = createApp();

  test('GET /api/tools lists all configured tools', async () => {
    const res = await request(app).get('/api/tools');
    expect(res.status).toBe(200);
    const ids = res.body.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'nmap', 'nikto', 'sqlmap', 'nuclei', 'ffuf', 'httpx',
        'subfinder', 'katana', 'dalfox', 'waybackurls', 'msfconsole', 'msfvenom',
      ])
    );
  });

  test('POST /api/tools/:toolId/run rejects unknown tool', async () => {
    const res = await request(app).post('/api/tools/not-a-tool/run').send({});
    expect(res.status).toBe(404);
  });

  test('POST /api/tools/:toolId/run validates required fields', async () => {
    const res = await request(app).post('/api/tools/nmap/run').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/target/);
  });

  test('POST /api/tools/:toolId/run executes the tool and returns output', async () => {
    const res = await request(app).post('/api/tools/waybackurls/run').send({ domain: 'example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('command');
    expect(res.body).toHaveProperty('args');
  });

  test('GET /api/seclists returns availability info', async () => {
    const res = await request(app).get('/api/seclists');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('available');
  });

  test('GET /api/seclists rejects path traversal', async () => {
    const res = await request(app).get('/api/seclists').query({ path: '../../etc' });
    expect(res.status).toBe(400);
  });
});
