'use strict';

const express = require('express');
const {
  appendEvidence,
  createCase,
  listCases,
  readCase,
  readEvidence,
  updateCaseStatus,
  verifyEvidence,
} = require('./evidenceStore');
const { extractIndicators } = require('./metadata');
const { parseMetasploitOutput } = require('./metasploit');
const { correlate } = require('./correlation');
const { buildReport } = require('./report');
const { triangulate, extractBearings } = require('./triangulation');
const { runExifTool } = require('./exiftool');

function createInvestigationRouter(options = {}) {
  const router = express.Router();
  const root = options.root;

  router.get('/status', (req, res) => {
    res.json({
      ok: true,
      mode: 'authorized-evidence-correlation',
      activeCollection: false,
      probabilityModel: 'uncalibrated-technical-link-confidence',
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

  router.patch('/cases/:caseId/status', (req, res) => {
    try { res.json(updateCaseStatus(req.params.caseId, req.body && req.body.status, root)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  router.get('/cases/:caseId/evidence', (req, res) => {
    try { res.json({ evidence: readEvidence(req.params.caseId, root) }); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.post('/cases/:caseId/evidence', (req, res) => {
    try {
      const input = req.body || {};
      const indicators = extractIndicators(input.content);
      const derived = {};
      if (String(input.kind || '').toLowerCase() === 'metasploit') {
        derived.metasploit = parseMetasploitOutput(input.content);
      }
      if (String(input.kind || '').toLowerCase() === 'bearing') {
        derived.bearing = true;
      }
      const evidence = appendEvidence(req.params.caseId, input, indicators, derived, root);
      res.status(201).json(evidence);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/media/extract', (req, res) => {
    try {
      const filePath = req.body && req.body.filePath;
      const result = runExifTool(filePath);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/cases/:caseId/media', (req, res) => {
    try {
      const filePath = req.body && req.body.filePath;
      const source = (req.body && req.body.source) || 'exiftool';
      const extracted = runExifTool(filePath);
      const content = {
        file: extracted.file,
        mediaType: extracted.mediaType,
        location: extracted.location,
        metadata: extracted.metadata,
      };
      const indicators = extractIndicators(content);
      const evidence = appendEvidence(
        req.params.caseId,
        { kind: 'media-metadata', source, content },
        indicators,
        { location: extracted.location, mediaType: extracted.mediaType },
        root
      );
      res.status(201).json({ evidence, extracted });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/cases/:caseId/correlations', (req, res) => {
    try { res.json(correlate(readEvidence(req.params.caseId, root))); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.get('/cases/:caseId/triangulate', (req, res) => {
    try {
      const evidence = readEvidence(req.params.caseId, root);
      const bearings = extractBearings(evidence);
      const result = triangulate(bearings);
      res.json(result);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.get('/cases/:caseId/verify', (req, res) => {
    try { res.json(verifyEvidence(req.params.caseId, root)); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.get('/cases/:caseId/report', (req, res) => {
    try {
      const report = buildReport(readCase(req.params.caseId, root), readEvidence(req.params.caseId, root));
      res.setHeader('Content-Disposition', `attachment; filename="qacker-${req.params.caseId}-report.md"`);
      res.type('text/markdown; charset=utf-8').send(report);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.get('/cases/:caseId/export', (req, res) => {
    try {
      const caseRecord = readCase(req.params.caseId, root);
      const evidence = readEvidence(req.params.caseId, root);
      const payload = {
        exportedAt: new Date().toISOString(),
        format: 'qacker-investigation-export-v1',
        case: caseRecord,
        verification: verifyEvidence(req.params.caseId, root),
        correlations: correlate(evidence),
        triangulation: triangulate(extractBearings(evidence)),
        evidence,
      };
      res.setHeader('Content-Disposition', `attachment; filename="qacker-${req.params.caseId}.json"`);
      res.json(payload);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createInvestigationRouter };
