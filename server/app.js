'use strict';

const path = require('path');
const express = require('express');

const tools = require('./tools');
const { runTool } = require('./runner');
const { listSeclists } = require('./seclists');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // List all available tools and the form fields the UI should render for them.
  app.get('/api/tools', (req, res) => {
    const summary = Object.values(tools).map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      fields: tool.fields,
    }));
    res.json(summary);
  });

  // Run a specific tool with validated input from the dashboard form.
  app.post('/api/tools/:toolId/run', (req, res) => {
    const tool = tools[req.params.toolId];
    if (!tool) {
      return res.status(404).json({ error: `Unknown tool: ${req.params.toolId}` });
    }

    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const missing = (tool.fields || []).filter((f) => f.required && !input[f.name]);
    if (missing.length) {
      return res.status(400).json({
        error: `Missing required field(s): ${missing.map((f) => f.name).join(', ')}`,
      });
    }

    try {
      const result = runTool(tool, input);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Browse SecLists wordlists so their paths can be reused in other tools.
  app.get('/api/seclists', (req, res) => {
    try {
      const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
      res.json(listSeclists(relativePath));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createApp };
