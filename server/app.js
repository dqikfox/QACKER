'use strict';

const path    = require('path');
const express = require('express');
const { spawn } = require('child_process');

const { tools, CATEGORIES } = require('./tools');
const { runTool }            = require('./runner');
const { listSeclists }       = require('./seclists');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

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
  // GET /api/tools/:toolId/stream?<fields as query params>
  // Sends newline-delimited JSON events: { type: 'stdout'|'stderr'|'done'|'error', data }
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
    res.flushHeaders();

    const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

    send('start', { command: tool.binary, args });

    const proc = spawn(tool.binary, args, { shell: false });

    proc.stdout.on('data', (chunk) => send('stdout', chunk.toString()));
    proc.stderr.on('data', (chunk) => send('stderr', chunk.toString()));

    proc.on('error', (err) => {
      const msg = err.code === 'ENOENT'
        ? `"${tool.binary}" not found. Make sure it is installed in WSL.`
        : err.message;
      send('error', msg);
      res.end();
    });

    proc.on('close', (code, signal) => {
      send('done', { code, signal });
      res.end();
    });

    req.on('close', () => proc.kill());
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

  // ── Status ──────────────────────────────────────────────────────────────────
  app.get('/api/status', (req, res) => {
    res.json({ ok: true, toolCount: Object.keys(tools).length, categories: Object.keys(CATEGORIES) });
  });

  return app;
}

module.exports = { createApp };
