'use strict';

const { extractIndicators } = require('./metadata');

// Parses analyst-supplied Metasploit console output. This module never executes
// Metasploit or generates exploitation commands.
function parseMetasploitOutput(output) {
  const text = String(output || '');
  const modules = [...new Set((text.match(/\b(?:exploit|auxiliary|post|scanner)\/[a-z0-9_./-]+/gi) || []).map((x) => x.toLowerCase()))];
  const sessions = [];
  const sessionRx = /(?:meterpreter|command shell) session\s+(\d+)\s+opened/gi;
  let match;
  while ((match = sessionRx.exec(text))) sessions.push(Number(match[1]));

  return {
    modules,
    sessionsOpened: [...new Set(sessions)],
    indicators: extractIndicators(text),
    status: /session\s+\d+\s+opened/i.test(text) ? 'session-observed' : 'no-session-observed',
  };
}

module.exports = { parseMetasploitOutput };
