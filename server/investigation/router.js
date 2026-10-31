'use strict';

const express = require('express');
const { appendEvidence, createCase, listCases, readCase, readEvidence } = require('./evidenceStore');
const { extractIndicators } = require('./metadata');
const { parseMetasploitOutput } = require('./metasploit');
const { correlate } = require('./correlation');
const { buildReport } = require('./report');

function createInvestigationRouter(options = {}) {
  const router = express.Router();
  const root = options.root;

  router.get('/status', (req, res) => {
    res.json({
      ok: true,
      mode: 'authorized-evidence-correlation',
      activeCollection: false,
      note: 'This API ingests supplied evidence and tool output. It does not probe, geolocate, intercept, or exploit third-party systems.',
    });
  });

  router.get('/cases', (req, res) => {
    try { res.json({ cases: listCases(root) }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/cases', (req, res) => {
    try {
      const record = createCase(req.body || {}, root);
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/cases/:caseId', (req, res) => {
    try { res.json(readCase(req.params.caseId, root)); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.get('/cases/:caseId/evidence', (req, res) => {
    try { res.json({ evidence: readEvidence(req.params.caseId, root) }); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.post('/cases/:caseId/evidence', (req, res) => {
    try {
      const input = req.body || {};
      const indicators = extractIndicators(input.content);
      let derived = {};
      if (String(input.kind || '').toLowerCase() === 'metasploit') {
        derived.metasploit = parseMetasploitOutput(input.content);
      }
      const evidence = appendEvidence(req.params.caseId, input, indicators, derived, root);
      res.status(201).json(evidence);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/cases/:caseId/correlations', (req, res) => {
    try { res.json(correlate(readEvidence(req.params.caseId, root))); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.get('/cases/:caseId/report', (req, res) => {
    try {
      const report = buildReport(readCase(req.params.caseId, root), readEvidence(req.params.caseId, root));
      res.type('text/markdown; charset=utf-8').send(report);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createInvestigationRouter };
