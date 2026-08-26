'use strict';

/**
 * Declarative tool definitions for the QACKER dashboard.
 *
 * Each tool belongs to a category which maps to a CyberStrike agent/phase.
 * buildArgs() always returns a discrete argv array — never a shell string.
 */

function pushFlagValue(args, flag, value) {
  if (value === undefined || value === null || value === '') return;
  args.push(flag, String(value));
}

function pushFlag(args, flag, enabled) {
  if (enabled) args.push(flag);
}

const MSF_COMMAND_SEPARATORS = /[;\n\r]/;

function assertSafeMsfValue(fieldName, value) {
  if (value && MSF_COMMAND_SEPARATORS.test(value)) {
    throw new Error(`Invalid character in "${fieldName}": ";" and newlines are not allowed.`);
  }
  return value;
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
// Each category maps to a CyberStrike phase / agent codename.
// Tools reference a categoryId; the UI uses this to group the sidebar.

const CATEGORIES = {
  recon: {
    id: 'recon',
    label: 'Reconnaissance',
    agent: 'GHOST',
    icon: '🔍',
    color: '#7c83fd',
  },
  web: {
    id: 'web',
    label: 'Web Testing',
    agent: 'STRIKER',
    icon: '🌐',
    color: '#3ddc97',
  },
  exploit: {
    id: 'exploit',
    label: 'Exploitation',
    agent: 'STRIKER',
    icon: '💥',
    color: '#ff6b6b',
  },
  network: {
    id: 'network',
    label: 'Network',
    agent: 'PHANTOM',
    icon: '🕸️',
    color: '#ffa94d',
  },
  payload: {
    id: 'payload',
    label: 'Payloads',
    agent: 'STRIKER',
    icon: '🎯',
    color: '#f783ac',
  },
};

// ─── TOOLS ───────────────────────────────────────────────────────────────────

const tools = {

  // ── RECON ──────────────────────────────────────────────────────────────────

  subfinder: {
    id: 'subfinder',
    name: 'Subfinder',
    category: 'recon',
    binary: 'subfinder',
    description: 'Passive subdomain enumeration using 40+ sources.',
    fields: [
      { name: 'domain',  label: 'Domain (-d)',          type: 'text',     required: true,  placeholder: 'example.com' },
      { name: 'all',     label: 'All sources (-all)',    type: 'checkbox' },
      { name: 'silent',  label: 'Silent (-silent)',      type: 'checkbox' },
      { name: 'timeout', label: 'Timeout (-timeout)',    type: 'number',  placeholder: '30' },
    ],
    buildArgs(input) {
      const args = ['-d', input.domain];
      pushFlag(args, '-all', input.all);
      pushFlag(args, '-silent', input.silent);
      pushFlagValue(args, '-timeout', input.timeout);
      return args;
    },
  },

  httpx: {
    id: 'httpx',
    name: 'httpx',
    category: 'recon',
    binary: 'httpx',
    description: 'HTTP probing — status codes, titles, tech detection.',
    fields: [
      { name: 'target',          label: 'Target (-u)',               type: 'text',     required: true, placeholder: 'https://example.com' },
      { name: 'statusCode',      label: 'Status code (-sc)',         type: 'checkbox' },
      { name: 'title',           label: 'Page title (-title)',        type: 'checkbox' },
      { name: 'techDetect',      label: 'Tech detect (-td)',          type: 'checkbox' },
      { name: 'webServer',       label: 'Web server (-web-server)',   type: 'checkbox' },
      { name: 'followRedirects', label: 'Follow redirects (-fr)',     type: 'checkbox' },
      { name: 'threads',         label: 'Threads (-t)',               type: 'number',   placeholder: '50' },
    ],
    buildArgs(input) {
      const args = ['-u', input.target];
      pushFlag(args, '-sc', input.statusCode);
      pushFlag(args, '-title', input.title);
      pushFlag(args, '-td', input.techDetect);
      pushFlag(args, '-web-server', input.webServer);
      pushFlag(args, '-fr', input.followRedirects);
      pushFlagValue(args, '-t', input.threads);
      return args;
    },
  },

  waybackurls: {
    id: 'waybackurls',
    name: 'Waybackurls',
    category: 'recon',
    binary: 'waybackurls',
    description: 'Fetch known URLs from the Wayback Machine.',
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com' },
    ],
    buildArgs(input) {
      return [input.domain];
    },
  },

  katana: {
    id: 'katana',
    name: 'Katana',
    category: 'recon',
    binary: 'katana',
    description: 'Fast web crawler for endpoint and JS link discovery.',
    fields: [
      { name: 'url',      label: 'URL (-u)',             type: 'text',    required: true, placeholder: 'https://example.com' },
      { name: 'depth',   label: 'Depth (-depth)',        type: 'number',  placeholder: '3' },
      { name: 'jsluice', label: 'JS endpoint extract',   type: 'checkbox' },
      { name: 'silent',  label: 'Silent (-silent)',       type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '-depth', input.depth);
      pushFlag(args, '-jsluice', input.jsluice);
      pushFlag(args, '-silent', input.silent);
      return args;
    },
  },

  // ── WEB TESTING ────────────────────────────────────────────────────────────

  nuclei: {
    id: 'nuclei',
    name: 'Nuclei',
    category: 'web',
    binary: 'nuclei',
    description: 'Template-based vulnerability scanner (9000+ templates).',
    fields: [
      { name: 'target',    label: 'Target (-u)',           type: 'text',   required: true, placeholder: 'https://example.com' },
      { name: 'severity',  label: 'Severity (-severity)',  type: 'select', options: ['', 'critical', 'critical,high', 'critical,high,medium', 'high', 'medium', 'low'] },
      { name: 'templates', label: 'Templates (-t)',         type: 'text',   placeholder: 'cves/,exposures/' },
      { name: 'tags',      label: 'Tags (-tags)',           type: 'text',   placeholder: 'sqli,xss,ssrf' },
      { name: 'rateLimit', label: 'Rate limit (-rl)',       type: 'number', placeholder: '150' },
      { name: 'silent',    label: 'Silent (-silent)',       type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.target];
      pushFlagValue(args, '-severity', input.severity);
      pushFlagValue(args, '-t', input.templates);
      pushFlagValue(args, '-tags', input.tags);
      pushFlagValue(args, '-rl', input.rateLimit);
      pushFlag(args, '-silent', input.silent);
      return args;
    },
  },

  nikto: {
    id: 'nikto',
    name: 'Nikto',
    category: 'web',
    binary: 'nikto',
    description: 'Web server vulnerability and misconfiguration scanner.',
    fields: [
      { name: 'host',    label: 'Host (-h)',        type: 'text',     required: true, placeholder: 'https://example.com' },
      { name: 'port',    label: 'Port (-p)',         type: 'text',     placeholder: '443' },
      { name: 'ssl',     label: 'Force SSL (-ssl)',  type: 'checkbox' },
      { name: 'tuning',  label: 'Tuning (-Tuning)', type: 'select',   options: ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'x'] },
    ],
    buildArgs(input) {
      const args = ['-h', input.host];
      pushFlagValue(args, '-p', input.port);
      pushFlagValue(args, '-Tuning', input.tuning);
      pushFlag(args, '-ssl', input.ssl);
      return args;
    },
  },

  ffuf: {
    id: 'ffuf',
    name: 'ffuf',
    category: 'web',
    binary: 'ffuf',
    description: 'Fast web fuzzer — directories, vhosts, parameters.',
    fields: [
      { name: 'url',         label: 'URL with FUZZ (-u)',  type: 'text',   required: true, placeholder: 'https://example.com/FUZZ' },
      { name: 'wordlist',    label: 'Wordlist (-w)',        type: 'text',   required: true, placeholder: '/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt' },
      { name: 'method',      label: 'HTTP method (-X)',     type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'headers',     label: 'Header (-H)',          type: 'text',   placeholder: 'Authorization: Bearer TOKEN' },
      { name: 'matchCodes',  label: 'Match codes (-mc)',    type: 'text',   placeholder: '200,301,302' },
      { name: 'filterCodes', label: 'Filter codes (-fc)',   type: 'text',   placeholder: '404,403' },
      { name: 'threads',     label: 'Threads (-t)',         type: 'number', placeholder: '40' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url, '-w', input.wordlist];
      pushFlagValue(args, '-X', input.method);
      pushFlagValue(args, '-H', input.headers);
      pushFlagValue(args, '-mc', input.matchCodes);
      pushFlagValue(args, '-fc', input.filterCodes);
      pushFlagValue(args, '-t', input.threads);
      return args;
    },
  },

  dalfox: {
    id: 'dalfox',
    name: 'Dalfox',
    category: 'web',
    binary: 'dalfox',
    description: 'Automated XSS scanner and parameter analysis.',
    fields: [
      { name: 'mode',   label: 'Mode',                  type: 'select', options: ['url', 'file', 'pipe'], required: true },
      { name: 'target', label: 'URL / file path',        type: 'text',   required: true, placeholder: 'https://example.com/search?q=test' },
      { name: 'cookie', label: 'Cookie (--cookie)',      type: 'text' },
      { name: 'worker', label: 'Workers (--worker)',     type: 'number', placeholder: '100' },
      { name: 'blind',  label: 'Blind XSS (--blind)',    type: 'text',   placeholder: 'https://your-xss-hunter-url' },
    ],
    buildArgs(input) {
      const args = [input.mode, input.target];
      pushFlagValue(args, '--cookie', input.cookie);
      pushFlagValue(args, '--worker', input.worker);
      pushFlagValue(args, '--blind', input.blind);
      return args;
    },
  },

  sqlmap: {
    id: 'sqlmap',
    name: 'sqlmap',
    category: 'web',
    binary: 'sqlmap',
    description: 'Automated SQL injection detection and exploitation.',
    fields: [
      { name: 'url',    label: 'Target URL (-u)',          type: 'text',   required: true, placeholder: 'https://example.com/item?id=1' },
      { name: 'data',   label: 'POST data (--data)',        type: 'text',   placeholder: 'id=1&name=test' },
      { name: 'cookie', label: 'Cookie (--cookie)',         type: 'text' },
      { name: 'level',  label: 'Level (--level)',           type: 'select', options: ['1', '2', '3', '4', '5'] },
      { name: 'risk',   label: 'Risk (--risk)',             type: 'select', options: ['1', '2', '3'] },
      { name: 'dbms',   label: 'DBMS (--dbms)',             type: 'select', options: ['', 'mysql', 'postgresql', 'mssql', 'oracle', 'sqlite'] },
      { name: 'dbs',    label: 'Enumerate DBs (--dbs)',     type: 'checkbox' },
      { name: 'batch',  label: 'Non-interactive (--batch)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '--data', input.data);
      pushFlagValue(args, '--cookie', input.cookie);
      pushFlagValue(args, '--level', input.level);
      pushFlagValue(args, '--risk', input.risk);
      pushFlagValue(args, '--dbms', input.dbms);
      pushFlag(args, '--dbs', input.dbs);
      pushFlag(args, '--batch', input.batch);
      return args;
    },
  },

  // ── NETWORK ────────────────────────────────────────────────────────────────

  nmap: {
    id: 'nmap',
    name: 'Nmap',
    category: 'network',
    binary: 'nmap',
    description: 'Network discovery, port scanning, and service fingerprinting.',
    fields: [
      { name: 'target',   label: 'Target (host/CIDR)',    type: 'text',   required: true, placeholder: '10.0.0.0/24' },
      { name: 'ports',    label: 'Ports (-p)',             type: 'text',   placeholder: '1-65535' },
      { name: 'scanType', label: 'Scan type',              type: 'select', options: ['-sV', '-sS', '-sT', '-sU', '-A', '-Pn', '-sC'] },
      { name: 'timing',   label: 'Timing template (-T)',   type: 'select', options: ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] },
      { name: 'scripts',  label: 'NSE scripts (--script)', type: 'text',   placeholder: 'vuln,default,auth' },
      { name: 'osDetect', label: 'OS detection (-O)',       type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      if (input.scanType) args.push(input.scanType);
      if (input.timing) args.push(`-${input.timing}`);
      pushFlag(args, '-O', input.osDetect);
      pushFlagValue(args, '-p', input.ports);
      pushFlagValue(args, '--script', input.scripts);
      args.push(input.target);
      return args;
    },
  },

  // ── EXPLOITATION ───────────────────────────────────────────────────────────

  msfconsole: {
    id: 'msfconsole',
    name: 'MSF Console',
    category: 'exploit',
    binary: 'msfconsole',
    description: 'Run a Metasploit module non-interactively.',
    fields: [
      { name: 'module',  label: 'Module (use)',          type: 'text', required: true, placeholder: 'exploit/multi/handler' },
      { name: 'rhosts',  label: 'RHOSTS',                type: 'text', placeholder: '192.168.1.10' },
      { name: 'rport',   label: 'RPORT',                 type: 'text', placeholder: '4444' },
      { name: 'lhost',   label: 'LHOST',                 type: 'text', placeholder: '192.168.1.5' },
      { name: 'lport',   label: 'LPORT',                 type: 'text', placeholder: '4444' },
      { name: 'payload', label: 'Payload (set PAYLOAD)', type: 'text', placeholder: 'linux/x64/meterpreter/reverse_tcp' },
    ],
    buildArgs(input) {
      assertSafeMsfValue('module', input.module);
      assertSafeMsfValue('payload', input.payload);
      assertSafeMsfValue('rhosts', input.rhosts);
      assertSafeMsfValue('lhost', input.lhost);
      assertSafeMsfValue('lport', input.lport);
      assertSafeMsfValue('rport', input.rport);

      const commands = [`use ${input.module}`];
      if (input.payload) commands.push(`set PAYLOAD ${input.payload}`);
      if (input.rhosts)  commands.push(`set RHOSTS ${input.rhosts}`);
      if (input.rport)   commands.push(`set RPORT ${input.rport}`);
      if (input.lhost)   commands.push(`set LHOST ${input.lhost}`);
      if (input.lport)   commands.push(`set LPORT ${input.lport}`);
      commands.push('run', 'exit');
      return ['-q', '-x', commands.join('; ')];
    },
  },

  // ── PAYLOADS ───────────────────────────────────────────────────────────────

  msfvenom: {
    id: 'msfvenom',
    name: 'msfvenom',
    category: 'payload',
    binary: 'msfvenom',
    description: 'Generate shellcode and executable payloads.',
    fields: [
      { name: 'payload', label: 'Payload (-p)',            type: 'text',   required: true, placeholder: 'windows/x64/meterpreter/reverse_tcp' },
      { name: 'lhost',   label: 'LHOST',                   type: 'text',   placeholder: '192.168.1.5' },
      { name: 'lport',   label: 'LPORT',                   type: 'text',   placeholder: '4444' },
      { name: 'format',  label: 'Format (-f)',              type: 'select', options: ['', 'exe', 'elf', 'raw', 'py', 'ps1', 'asp', 'jsp', 'war', 'apk', 'c', 'sh'] },
      { name: 'encoder', label: 'Encoder (-e)',             type: 'text',   placeholder: 'x86/shikata_ga_nai' },
      { name: 'iters',   label: 'Encoder iterations (-i)', type: 'number', placeholder: '5' },
      { name: 'list',    label: 'List payloads (-l payloads)', type: 'checkbox' },
    ],
    buildArgs(input) {
      if (input.list) return ['-l', 'payloads'];
      const args = ['-p', input.payload];
      if (input.lhost) args.push(`LHOST=${input.lhost}`);
      if (input.lport) args.push(`LPORT=${input.lport}`);
      pushFlagValue(args, '-f', input.format);
      pushFlagValue(args, '-e', input.encoder);
      pushFlagValue(args, '-i', input.iters);
      return args;
    },
  },
};

module.exports = { tools, CATEGORIES };
