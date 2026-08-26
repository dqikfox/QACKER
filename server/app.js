'use strict';

const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const express = require('express');

const { tools, CATEGORIES } = require('./tools');
const { runTool, spawnTool } = require('./runner');
const { listSeclists }       = require('./seclists');
const { createInvestigationRouter } = require('./investigation/router');
const config                 = require('./config');

// ── Loot directory ──────────────────────────────────────────────────────────
const LOOT_DIR = process.env.LOOT_DIR
  || path.join(os.homedir(), '.cyberstrike', 'loot');

function ensureLootDir() {
  try { fs.mkdirSync(LOOT_DIR, { recursive: true }); } catch (_) {}
}

// Track active streaming processes: pid → ChildProcess
const activeProcs = new Map();

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── Investigation / evidence-correlation API ───────────────────────────────
  // Ingests analyst-supplied evidence only. It performs no active collection,
  // geolocation, interception, exploitation, or subscriber-identity lookup.
  app.use('/api/investigations', createInvestigationRouter());

  // ── Tool catalogue ──────────────────────────────────────────────────────────
  app.get('/api/tools', (req, res) => {
    const summary = Object.values(tools).map((tool) => ({
      id:          tool.id,
      name:        tool.name,
      category:    tool.category,
      description: tool.description,
      fields:      tool.fields,
    }));
    res.json({ tools: summary, categories: CATEGORIES });
  });

  // ── Run a tool (blocking, buffered) ─────────────────────────────────────────
  app.post('/api/tools/:toolId/run', (req, res) => {
    const tool = tools[req.params.toolId];
    if (!tool) return res.status(404).json({ error: `Unknown tool: ${req.params.toolId}` });

    const input   = req.body && typeof req.body === 'object' ? req.body : {};
    const missing = (tool.fields || []).filter((f) => f.required && !input[f.name]);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.map((f) => f.name).join(', ')}` });
    }

    try {
      const result = runTool(tool, input);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Streaming run (SSE) ─────────────────────────────────────────────────────
  app.post('/api/tools/:toolId/stream', (req, res) => {
    const tool = tools[req.params.toolId];
    if (!tool) return res.status(404).json({ error: `Unknown tool: ${req.params.toolId}` });

    const input   = req.body && typeof req.body === 'object' ? req.body : {};
    const missing = (tool.fields || []).filter((f) => f.required && !input[f.name]);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.map((f) => f.name).join(', ')}` });
    }

    let args;
    try {
      args = tool.buildArgs(input);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

    let proc;
    try {
      proc = spawnTool(tool, args);
    } catch (err) {
      send('error', err.message);
      res.end();
      return;
    }

    const pid = proc.pid;
    if (pid) activeProcs.set(pid, proc);

    send('start', { command: tool.binary, args, pid });

    proc.stdout.on('data', (chunk) => send('stdout', chunk.toString()));
    proc.stderr.on('data', (chunk) => send('stderr', chunk.toString()));

    proc.on('error', (err) => {
      const msg = err.code === 'ENOENT'
        ? config.shouldUseWsl()
          ? `"${tool.binary}" not found in WSL. Verify WSL tool paths.`
          : `"${tool.binary}" not found. Make sure it is installed.`
        : err.message;
      send('error', msg);
      if (pid) activeProcs.delete(pid);
      res.end();
    });

    proc.on('close', (code, signal) => {
      send('done', { code, signal, pid });
      if (pid) activeProcs.delete(pid);
      res.end();
    });

    req.on('close', () => {
      if (proc) proc.kill();
      if (pid) activeProcs.delete(pid);
    });
  });

  // ── Kill a running process ───────────────────────────────────────────────────
  app.post('/api/kill/:pid', (req, res) => {
    const pid  = Number(req.params.pid);
    const proc = activeProcs.get(pid);
    if (!proc) return res.status(404).json({ error: `No active process with PID ${pid}` });
    try {
      proc.kill('SIGTERM');
      activeProcs.delete(pid);
      res.json({ ok: true, pid });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── SecLists browser ────────────────────────────────────────────────────────
  app.get('/api/seclists', (req, res) => {
    try {
      const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
      res.json(listSeclists(relativePath));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Config (read-only, safe subset) ─────────────────────────────────────────
  app.get('/api/config', (req, res) => {
    res.json({
      port:         config.port,
      host:         config.host,
      useWsl:       config.shouldUseWsl(),
      wslDistro:    config.wslDistro,
      wslToolPaths: config.wslToolPaths,
      timeoutMs:    config.timeoutMs,
      maxBufferMb:  Math.round(config.maxBuffer / 1024 / 1024),
      seclistsRoot: config.resolveSeclistsRoot(),
      isWindows:    config.isWindows,
      platform:     process.platform,
      nodeVersion:  process.version,
    });
  });

  // ── Status ──────────────────────────────────────────────────────────────────
  app.get('/api/status', (req, res) => {
    res.json({
      ok:         true,
      toolCount:  Object.keys(tools).length,
      categories: Object.keys(CATEGORIES),
      activeProcs: activeProcs.size,
      uptime:     Math.round(process.uptime()),
    });
  });

  // ── Loot saver ──────────────────────────────────────────────────────────────
  app.post('/api/loot', (req, res) => {
    ensureLootDir();
    const { filename, content } = req.body || {};
    if (!filename || typeof content !== 'string') {
      return res.status(400).json({ error: 'filename and content are required' });
    }
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `${ts}-${safe}`;
    const full = path.join(LOOT_DIR, name);
    if (!full.startsWith(LOOT_DIR)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    try {
      fs.writeFileSync(full, content, 'utf8');
      res.json({ ok: true, path: full, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/loot — list saved loot files
  app.get('/api/loot', (req, res) => {
    ensureLootDir();
    try {
      const files = fs.readdirSync(LOOT_DIR)
        .filter((f) => {
          try { return fs.statSync(path.join(LOOT_DIR, f)).isFile(); } catch { return false; }
        })
        .map((f) => {
          const stat = fs.statSync(path.join(LOOT_DIR, f));
          return { name: f, size: stat.size, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 100);
      res.json({ lootDir: LOOT_DIR, files });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createApp };
