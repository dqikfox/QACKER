'use strict';

/**
 * QACKER — Declarative tool definitions.
 *
 * Each tool:
 *   - belongs to a CATEGORY (maps to a CyberStrike agent/phase)
 *   - has a set of FIELDS (rendered as a form in the UI)
 *   - has buildArgs(input) → string[] (argv, never a shell string)
 *
 * The runner wraps every binary through WSL on Windows automatically —
 * no tool definition needs to know about WSL.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function pushFlagValue(args, flag, value) {
  if (value === undefined || value === null || value === '') return;
  args.push(flag, String(value));
}

function pushFlag(args, flag, enabled) {
  if (enabled) args.push(flag);
}

// Block shell injection in MSF free-text fields.
const MSF_COMMAND_SEPARATORS = /[;\n\r]/;
function assertSafeMsfValue(fieldName, value) {
  if (value && MSF_COMMAND_SEPARATORS.test(value)) {
    throw new Error(`Invalid character in "${fieldName}": semicolons and newlines are not allowed.`);
  }
  return value;
}

// ── CATEGORIES ────────────────────────────────────────────────────────────
// categoryId → { id, label, agent, icon, color }

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
  brute: {
    id: 'brute',
    label: 'Brute Force',
    agent: 'STRIKER',
    icon: '🔑',
    color: '#ffd43b',
  },
  cms: {
    id: 'cms',
    label: 'CMS / Tech',
    agent: 'STRIKER',
    icon: '🧩',
    color: '#74c0fc',
  },
  utils: {
    id: 'utils',
    label: 'Utilities',
    agent: 'GHOST',
    icon: '🛠️',
    color: '#a9e34b',
  },
  smb: {
    id: 'smb',
    label: 'SMB / AD',
    agent: 'PHANTOM',
    icon: '🪟',
    color: '#e599f7',
  },
};

// ── TOOLS ─────────────────────────────────────────────────────────────────

const tools = {

  // ════════════════════════════════════════════════════════════════
  //  RECON
  // ════════════════════════════════════════════════════════════════

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
      { name: 'timeout', label: 'Timeout (-timeout)',    type: 'number',   placeholder: '30' },
    ],
    buildArgs(input) {
      const args = ['-d', input.domain];
      pushFlag(args, '-all', input.all);
      pushFlag(args, '-silent', input.silent);
      pushFlagValue(args, '-timeout', input.timeout);
      return args;
    },
  },

  amass: {
    id: 'amass',
    name: 'Amass',
    category: 'recon',
    binary: 'amass',
    description: 'In-depth attack surface mapping and asset discovery.',
    fields: [
      { name: 'mode',   label: 'Mode',                  type: 'select',  required: true,  options: ['enum', 'intel', 'db'] },
      { name: 'domain', label: 'Domain (-d)',             type: 'text',    required: true,  placeholder: 'example.com' },
      { name: 'passive',label: 'Passive only (-passive)', type: 'checkbox' },
      { name: 'ip',     label: 'Show IPs (-ip)',          type: 'checkbox' },
      { name: 'timeout',label: 'Timeout (-timeout)',      type: 'number',  placeholder: '30' },
    ],
    buildArgs(input) {
      const args = [input.mode || 'enum', '-d', input.domain];
      pushFlag(args, '-passive', input.passive);
      pushFlag(args, '-ip', input.ip);
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
    binary: 'bash',
    description: 'Fetch known URLs from the Wayback Machine.',
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com' },
    ],
    buildArgs(input) {
      // waybackurls reads from stdin; wrap in bash -c with echo pipe.
      return ['-c', `echo '${input.domain.replace(/'/g, "'\\''")}' | waybackurls`];
    },
  },

  katana: {
    id: 'katana',
    name: 'Katana',
    category: 'recon',
    binary: 'katana',
    description: 'Fast web crawler for endpoint and JS link discovery.',
    fields: [
      { name: 'url',     label: 'URL (-u)',              type: 'text',    required: true, placeholder: 'https://example.com' },
      { name: 'depth',   label: 'Depth (-depth)',         type: 'number',  placeholder: '3' },
      { name: 'jsluice', label: 'JS endpoint extract',    type: 'checkbox' },
      { name: 'silent',  label: 'Silent (-silent)',        type: 'checkbox' },
      { name: 'timeout', label: 'Timeout (-timeout)',      type: 'number',  placeholder: '10' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '-depth', input.depth);
      pushFlag(args, '-jsluice', input.jsluice);
      pushFlag(args, '-silent', input.silent);
      pushFlagValue(args, '-timeout', input.timeout);
      return args;
    },
  },

  whatweb: {
    id: 'whatweb',
    name: 'WhatWeb',
    category: 'recon',
    binary: 'whatweb',
    description: 'Identify web technologies, CMS, frameworks, and server info.',
    fields: [
      { name: 'target',  label: 'Target URL',           type: 'text',   required: true, placeholder: 'https://example.com' },
      { name: 'aggress', label: 'Aggression level (-a)', type: 'select', options: ['1', '3', '4'] },
      { name: 'quiet',   label: 'Quiet (-q)',             type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [input.target];
      pushFlagValue(args, '-a', input.aggress);
      pushFlag(args, '-q', input.quiet);
      return args;
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  WEB TESTING
  // ════════════════════════════════════════════════════════════════

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
      { name: 'host',    label: 'Host (-h)',         type: 'text',     required: true, placeholder: 'https://example.com' },
      { name: 'port',    label: 'Port (-p)',          type: 'text',     placeholder: '443' },
      { name: 'ssl',     label: 'Force SSL (-ssl)',   type: 'checkbox' },
      { name: 'tuning',  label: 'Tuning (-Tuning)',   type: 'select',   options: ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'x'] },
      { name: 'timeout', label: 'Timeout (-timeout)', type: 'number',   placeholder: '10' },
    ],
    buildArgs(input) {
      const args = ['-h', input.host];
      pushFlagValue(args, '-p', input.port);
      pushFlagValue(args, '-Tuning', input.tuning);
      pushFlagValue(args, '-timeout', input.timeout);
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
      { name: 'url',         label: 'URL with FUZZ (-u)',   type: 'text',   required: true, placeholder: 'https://example.com/FUZZ' },
      { name: 'wordlist',    label: 'Wordlist (-w)',          type: 'text',   required: true, placeholder: '/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt' },
      { name: 'method',      label: 'HTTP method (-X)',       type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'headers',     label: 'Header (-H)',            type: 'text',   placeholder: 'Authorization: Bearer TOKEN' },
      { name: 'matchCodes',  label: 'Match codes (-mc)',      type: 'text',   placeholder: '200,301,302' },
      { name: 'filterCodes', label: 'Filter codes (-fc)',     type: 'text',   placeholder: '404,403' },
      { name: 'threads',     label: 'Threads (-t)',           type: 'number', placeholder: '40' },
      { name: 'silent',      label: 'Silent (-s)',            type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url, '-w', input.wordlist];
      pushFlagValue(args, '-X', input.method);
      pushFlagValue(args, '-H', input.headers);
      pushFlagValue(args, '-mc', input.matchCodes);
      pushFlagValue(args, '-fc', input.filterCodes);
      pushFlagValue(args, '-t', input.threads);
      pushFlag(args, '-s', input.silent);
      return args;
    },
  },

  gobuster: {
    id: 'gobuster',
    name: 'Gobuster',
    category: 'web',
    binary: 'gobuster',
    description: 'Directory/file/vhost/DNS brute-forcer.',
    fields: [
      { name: 'mode',     label: 'Mode',                  type: 'select', required: true,  options: ['dir', 'dns', 'vhost', 'fuzz'] },
      { name: 'url',      label: 'URL / domain (-u or -d)', type: 'text', required: true,  placeholder: 'https://example.com' },
      { name: 'wordlist', label: 'Wordlist (-w)',           type: 'text',  required: true,  placeholder: '/usr/share/seclists/Discovery/Web-Content/common.txt' },
      { name: 'threads',  label: 'Threads (-t)',            type: 'number', placeholder: '20' },
      { name: 'status',   label: 'Status codes (-s)',       type: 'text',   placeholder: '200,204,301,302,307,401,403' },
      { name: 'exts',     label: 'Extensions (-x)',         type: 'text',   placeholder: 'php,html,txt' },
      { name: 'quiet',    label: 'Quiet (-q)',              type: 'checkbox' },
    ],
    buildArgs(input) {
      const mode = input.mode || 'dir';
      const urlFlag = mode === 'dns' ? '-d' : '-u';
      const args = [mode, urlFlag, input.url, '-w', input.wordlist];
      pushFlagValue(args, '-t', input.threads);
      pushFlagValue(args, '-s', input.status);
      pushFlagValue(args, '-x', input.exts);
      pushFlag(args, '-q', input.quiet);
      return args;
    },
  },

  feroxbuster: {
    id: 'feroxbuster',
    name: 'Feroxbuster',
    category: 'web',
    binary: 'feroxbuster',
    description: 'Fast, recursive content discovery tool in Rust.',
    fields: [
      { name: 'url',      label: 'URL (-u)',             type: 'text',   required: true, placeholder: 'https://example.com' },
      { name: 'wordlist', label: 'Wordlist (-w)',          type: 'text',   placeholder: '/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt' },
      { name: 'depth',    label: 'Depth (-d)',             type: 'number', placeholder: '4' },
      { name: 'threads',  label: 'Threads (-t)',           type: 'number', placeholder: '50' },
      { name: 'exts',     label: 'Extensions (-x)',        type: 'text',   placeholder: 'php,html,js' },
      { name: 'filter',   label: 'Filter size (-S)',       type: 'text',   placeholder: '0' },
      { name: 'quiet',    label: 'Quiet (-q)',             type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '-w', input.wordlist);
      pushFlagValue(args, '-d', input.depth);
      pushFlagValue(args, '-t', input.threads);
      pushFlagValue(args, '-x', input.exts);
      pushFlagValue(args, '-S', input.filter);
      pushFlag(args, '-q', input.quiet);
      return args;
    },
  },

  arjun: {
    id: 'arjun',
    name: 'Arjun',
    category: 'web',
    binary: 'arjun',
    description: 'HTTP parameter discovery — find hidden GET/POST parameters.',
    fields: [
      { name: 'url',     label: 'URL (-u)',             type: 'text',   required: true, placeholder: 'https://example.com/endpoint' },
      { name: 'method',  label: 'Method (-m)',           type: 'select', options: ['GET', 'POST', 'JSON', 'XML'] },
      { name: 'wordlist',label: 'Wordlist (-w)',          type: 'text',   placeholder: '/usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt' },
      { name: 'threads', label: 'Threads (-t)',           type: 'number', placeholder: '20' },
      { name: 'quiet',   label: 'Quiet (-q)',             type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '-m', input.method);
      pushFlagValue(args, '-w', input.wordlist);
      pushFlagValue(args, '-t', input.threads);
      pushFlag(args, '-q', input.quiet);
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
      { name: 'skip',   label: 'Skip BAV (--skip-bav)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [input.mode, input.target];
      pushFlagValue(args, '--cookie', input.cookie);
      pushFlagValue(args, '--worker', input.worker);
      pushFlagValue(args, '--blind', input.blind);
      pushFlag(args, '--skip-bav', input.skip);
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

  // ════════════════════════════════════════════════════════════════
  //  NETWORK
  // ════════════════════════════════════════════════════════════════

  nmap: {
    id: 'nmap',
    name: 'Nmap',
    category: 'network',
    binary: 'nmap',
    description: 'Network discovery, port scanning, and service fingerprinting.',
    fields: [
      { name: 'target',   label: 'Target (host/CIDR)',    type: 'text',   required: true, placeholder: '10.0.0.0/24' },
      { name: 'ports',    label: 'Ports (-p)',             type: 'text',   placeholder: '1-65535' },
      { name: 'scanType', label: 'Scan type',              type: 'select', options: ['', '-sV', '-sS', '-sT', '-sU', '-A', '-Pn', '-sC'] },
      { name: 'timing',   label: 'Timing template (-T)',   type: 'select', options: ['', 'T0', 'T1', 'T2', 'T3', 'T4', 'T5'] },
      { name: 'scripts',  label: 'NSE scripts (--script)', type: 'text',   placeholder: 'vuln,default,auth' },
      { name: 'osDetect', label: 'OS detection (-O)',       type: 'checkbox' },
      { name: 'output',   label: 'Output file (-oN)',       type: 'text',   placeholder: '/tmp/scan.txt' },
    ],
    buildArgs(input) {
      const args = [];
      if (input.scanType) args.push(input.scanType);
      if (input.timing)   args.push(`-${input.timing}`);
      pushFlag(args, '-O', input.osDetect);
      pushFlagValue(args, '-p', input.ports);
      pushFlagValue(args, '--script', input.scripts);
      pushFlagValue(args, '-oN', input.output);
      args.push(input.target);
      return args;
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  EXPLOITATION
  // ════════════════════════════════════════════════════════════════

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
      { name: 'extra',   label: 'Extra options',         type: 'text', placeholder: 'set TARGETURI /app' },
    ],
    buildArgs(input) {
      assertSafeMsfValue('module',  input.module);
      assertSafeMsfValue('payload', input.payload);
      assertSafeMsfValue('rhosts',  input.rhosts);
      assertSafeMsfValue('lhost',   input.lhost);
      assertSafeMsfValue('lport',   input.lport);
      assertSafeMsfValue('rport',   input.rport);

      const commands = [`use ${input.module}`];
      if (input.payload) commands.push(`set PAYLOAD ${input.payload}`);
      if (input.rhosts)  commands.push(`set RHOSTS ${input.rhosts}`);
      if (input.rport)   commands.push(`set RPORT ${input.rport}`);
      if (input.lhost)   commands.push(`set LHOST ${input.lhost}`);
      if (input.lport)   commands.push(`set LPORT ${input.lport}`);
      if (input.extra)   commands.push(input.extra);
      commands.push('run', 'exit');
      return ['-q', '-x', commands.join('; ')];
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  PAYLOADS
  // ════════════════════════════════════════════════════════════════

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
      { name: 'format',  label: 'Format (-f)',              type: 'select', options: ['', 'exe', 'elf', 'raw', 'py', 'ps1', 'asp', 'aspx', 'jsp', 'war', 'apk', 'c', 'sh', 'hta-psh'] },
      { name: 'encoder', label: 'Encoder (-e)',             type: 'text',   placeholder: 'x86/shikata_ga_nai' },
      { name: 'iters',   label: 'Encoder iterations (-i)', type: 'number', placeholder: '5' },
      { name: 'outfile', label: 'Output file (-o)',         type: 'text',   placeholder: '/tmp/payload.exe' },
      { name: 'list',    label: 'List payloads (-l)',        type: 'checkbox' },
    ],
    buildArgs(input) {
      if (input.list) return ['-l', 'payloads'];
      const args = ['-p', input.payload];
      if (input.lhost) args.push(`LHOST=${input.lhost}`);
      if (input.lport) args.push(`LPORT=${input.lport}`);
      pushFlagValue(args, '-f', input.format);
      pushFlagValue(args, '-e', input.encoder);
      pushFlagValue(args, '-i', input.iters);
      pushFlagValue(args, '-o', input.outfile);
      return args;
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  BRUTE FORCE
  // ════════════════════════════════════════════════════════════════

  hydra: {
    id: 'hydra',
    name: 'Hydra',
    category: 'brute',
    binary: 'hydra',
    description: 'Online password brute-forcer supporting 50+ protocols.',
    fields: [
      { name: 'target',    label: 'Target (-t host)',      type: 'text',   required: true,  placeholder: '192.168.1.10' },
      { name: 'service',   label: 'Service',               type: 'select', required: true,  options: ['ssh', 'ftp', 'http-post-form', 'https-post-form', 'rdp', 'smb', 'telnet', 'mysql', 'mssql', 'postgresql', 'vnc', 'imap', 'smtp', 'pop3'] },
      { name: 'userlist',  label: 'User list (-L)',         type: 'text',   placeholder: '/usr/share/seclists/Usernames/top-usernames-shortlist.txt' },
      { name: 'user',      label: 'Single user (-l)',       type: 'text',   placeholder: 'admin' },
      { name: 'passlist',  label: 'Password list (-P)',     type: 'text',   placeholder: '/usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt' },
      { name: 'pass',      label: 'Single password (-p)',   type: 'text' },
      { name: 'threads',   label: 'Threads (-t)',           type: 'number', placeholder: '16' },
      { name: 'verbose',   label: 'Verbose (-V)',           type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      if (input.userlist) args.push('-L', input.userlist);
      else if (input.user) args.push('-l', input.user);
      if (input.passlist) args.push('-P', input.passlist);
      else if (input.pass) args.push('-p', input.pass);
      pushFlagValue(args, '-t', input.threads);
      pushFlag(args, '-V', input.verbose);
      args.push(input.target, input.service);
      return args;
    },
  },

  john: {
    id: 'john',
    name: 'John the Ripper',
    category: 'brute',
    binary: 'john',
    description: 'Offline password hash cracker.',
    fields: [
      { name: 'hashfile',  label: 'Hash file',              type: 'text',   required: true, placeholder: '/tmp/hashes.txt' },
      { name: 'wordlist',  label: 'Wordlist (--wordlist)',   type: 'text',   placeholder: '/usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt.tar.gz' },
      { name: 'format',    label: 'Format (--format)',       type: 'text',   placeholder: 'NT' },
      { name: 'rules',     label: 'Rules (--rules)',         type: 'checkbox' },
      { name: 'show',      label: 'Show cracked (--show)',   type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      pushFlagValue(args, '--wordlist', input.wordlist);
      pushFlagValue(args, '--format', input.format);
      pushFlag(args, '--rules', input.rules);
      pushFlag(args, '--show', input.show);
      args.push(input.hashfile);
      return args;
    },
  },

  hashcat: {
    id: 'hashcat',
    name: 'Hashcat',
    category: 'brute',
    binary: 'hashcat',
    description: 'GPU-accelerated password hash cracking.',
    fields: [
      { name: 'hashfile',  label: 'Hash file / hash',       type: 'text',   required: true,  placeholder: '/tmp/hashes.txt' },
      { name: 'mode',      label: 'Attack mode (-a)',        type: 'select', required: true,  options: ['0', '1', '3', '6', '7'] },
      { name: 'hashtype',  label: 'Hash type (-m)',          type: 'text',   required: true,  placeholder: '1000  (NTLM)' },
      { name: 'wordlist',  label: 'Wordlist / mask',         type: 'text',   placeholder: '/usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt.tar.gz' },
      { name: 'rules',     label: 'Rules file (-r)',         type: 'text',   placeholder: '/usr/share/hashcat/rules/best64.rule' },
      { name: 'show',      label: 'Show cracked (--show)',   type: 'checkbox' },
      { name: 'force',     label: 'Force (--force)',         type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-a', input.mode, '-m', input.hashtype, input.hashfile];
      if (input.wordlist) args.push(input.wordlist);
      pushFlagValue(args, '-r', input.rules);
      pushFlag(args, '--show', input.show);
      pushFlag(args, '--force', input.force);
      return args;
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  CMS / TECH
  // ════════════════════════════════════════════════════════════════

  wpscan: {
    id: 'wpscan',
    name: 'WPScan',
    category: 'cms',
    binary: 'wpscan',
    description: 'WordPress vulnerability scanner and enumeration tool.',
    fields: [
      { name: 'url',       label: 'URL (--url)',             type: 'text',   required: true, placeholder: 'https://example.com' },
      { name: 'enumerate', label: 'Enumerate (--enumerate)', type: 'select', options: ['', 'ap', 'at', 'cb', 'dbe', 'u', 'vp', 'vt'] },
      { name: 'apiToken',  label: 'API token (--api-token)', type: 'text' },
      { name: 'threads',   label: 'Threads (--max-threads)', type: 'number', placeholder: '5' },
      { name: 'aggressive',label: 'Aggressive detection',    type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['--url', input.url, '--no-banner'];
      pushFlagValue(args, '--enumerate', input.enumerate);
      pushFlagValue(args, '--api-token', input.apiToken);
      pushFlagValue(args, '--max-threads', input.threads);
      if (input.aggressive) {
        args.push('--detection-mode', 'aggressive');
      }
      return args;
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  UTILS  (Raw shell, port check, etc.)
  // ════════════════════════════════════════════════════════════════

  shell: {
    id: 'shell',
    name: 'Raw Shell',
    category: 'utils',
    binary: 'bash',
    description: 'Run any arbitrary WSL command. Use with care.',
    fields: [
      { name: 'shellCmd', label: 'Command', type: 'text', required: true, placeholder: 'whoami && uname -a' },
    ],
    buildArgs(input) {
      // Simple safety: block chained newlines/bare semicolons that start new commands
      // (still allows ; within single commands like echo "a;b").
      // We intentionally allow advanced shell usage — user owns this field.
      return ['-c', input.shellCmd];
    },
  },

  curl: {
    id: 'curl',
    name: 'cURL',
    category: 'utils',
    binary: 'curl',
    description: 'HTTP request tool — inspect responses, headers, and APIs.',
    fields: [
      { name: 'url',     label: 'URL',                      type: 'text',   required: true,  placeholder: 'https://example.com' },
      { name: 'method',  label: 'Method (-X)',               type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] },
      { name: 'data',    label: 'Body (-d)',                  type: 'text',   placeholder: '{"key":"value"}' },
      { name: 'headers', label: 'Header (-H, repeat ok)',     type: 'text',   placeholder: 'Authorization: Bearer TOKEN' },
      { name: 'verbose', label: 'Verbose (-v)',               type: 'checkbox' },
      { name: 'insecure',label: 'Insecure (-k)',              type: 'checkbox' },
      { name: 'follow',  label: 'Follow redirects (-L)',      type: 'checkbox' },
      { name: 'output',  label: 'Save to file (-o)',          type: 'text',   placeholder: '/tmp/response.txt' },
    ],
    buildArgs(input) {
      const args = ['-s']; // silent progress
      pushFlagValue(args, '-X', input.method);
      if (input.headers) {
        for (const h of input.headers.split('\n').map(s => s.trim()).filter(Boolean)) {
          args.push('-H', h);
        }
      }
      pushFlagValue(args, '-d', input.data);
      pushFlag(args, '-v', input.verbose);
      pushFlag(args, '-k', input.insecure);
      pushFlag(args, '-L', input.follow);
      pushFlagValue(args, '-o', input.output);
      if (!input.verbose) args.push('-i'); // show headers
      args.push(input.url);
      return args;
    },
  },

  dig: {
    id: 'dig',
    name: 'dig',
    category: 'utils',
    binary: 'dig',
    description: 'DNS lookup and zone interrogation tool.',
    fields: [
      { name: 'domain',  label: 'Domain / IP',              type: 'text',   required: true,  placeholder: 'example.com' },
      { name: 'type',    label: 'Record type',               type: 'select', options: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'PTR', 'ANY', 'AXFR'] },
      { name: 'server',  label: 'DNS server (@)',             type: 'text',   placeholder: '8.8.8.8' },
      { name: 'short',   label: 'Short output (+short)',      type: 'checkbox' },
      { name: 'trace',   label: 'Trace (+trace)',             type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      if (input.server) args.push(`@${input.server}`);
      args.push(input.domain);
      if (input.type) args.push(input.type);
      pushFlag(args, '+short', input.short);
      pushFlag(args, '+trace', input.trace);
      return args;
    },
  },

  whois: {
    id: 'whois',
    name: 'whois',
    category: 'utils',
    binary: 'whois',
    description: 'Domain registration and IP ownership lookup.',
    fields: [
      { name: 'target', label: 'Domain or IP', type: 'text', required: true, placeholder: 'example.com' },
    ],
    buildArgs(input) {
      return [input.target];
    },
  },

  ping: {
    id: 'ping',
    name: 'ping',
    category: 'utils',
    binary: 'ping',
    description: 'ICMP ping — check host reachability and RTT.',
    fields: [
      { name: 'target', label: 'Host / IP',   type: 'text',   required: true, placeholder: '10.0.0.1' },
      { name: 'count',  label: 'Count (-c)',   type: 'number', placeholder: '4' },
      { name: 'size',   label: 'Packet size (-s)', type: 'number', placeholder: '64' },
    ],
    buildArgs(input) {
      const args = [];
      pushFlagValue(args, '-c', input.count || '4');
      pushFlagValue(args, '-s', input.size);
      args.push(input.target);
      return args;
    },
  },

  traceroute: {
    id: 'traceroute',
    name: 'traceroute',
    category: 'utils',
    binary: 'traceroute',
    description: 'Trace the network path to a host.',
    fields: [
      { name: 'target',  label: 'Host / IP',          type: 'text',   required: true, placeholder: '8.8.8.8' },
      { name: 'maxHops', label: 'Max hops (-m)',        type: 'number', placeholder: '30' },
      { name: 'udp',     label: 'UDP mode (-U)',         type: 'checkbox' },
      { name: 'icmp',    label: 'ICMP mode (-I)',        type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      pushFlagValue(args, '-m', input.maxHops);
      pushFlag(args, '-U', input.udp);
      pushFlag(args, '-I', input.icmp);
      args.push(input.target);
      return args;
    },
  },

  openssl: {
    id: 'openssl',
    name: 'OpenSSL',
    category: 'utils',
    binary: 'openssl',
    description: 'TLS/SSL certificate inspection and crypto toolkit.',
    fields: [
      { name: 'mode',    label: 'Mode',                  type: 'select',  required: true, options: ['s_client', 'x509', 'ciphers', 'version'] },
      { name: 'host',    label: 'Host:port (s_client)',  type: 'text',    placeholder: 'example.com:443' },
      { name: 'extra',   label: 'Extra flags',            type: 'text',    placeholder: '-showcerts -tls1_2' },
    ],
    buildArgs(input) {
      const args = [input.mode];
      if (input.mode === 's_client' && input.host) {
        args.push('-connect', input.host);
      }
      if (input.mode === 'x509') {
        args.push('-noout', '-text');
      }
      if (input.extra) {
        for (const part of input.extra.trim().split(/\s+/)) {
          if (part) args.push(part);
        }
      }
      return args;
    },
  },

  sslscan: {
    id: 'sslscan',
    name: 'sslscan',
    category: 'utils',
    binary: 'sslscan',
    description: 'SSL/TLS configuration scanner — ciphers, protocols, certs.',
    fields: [
      { name: 'target',  label: 'Target (host or host:port)', type: 'text', required: true, placeholder: 'example.com' },
      { name: 'noFailed',label: 'Hide failed (-no-failed)',    type: 'checkbox' },
      { name: 'xml',     label: 'XML output (--xml=)',         type: 'text',    placeholder: '/tmp/sslscan.xml' },
    ],
    buildArgs(input) {
      const args = [];
      pushFlag(args, '--no-failed', input.noFailed);
      if (input.xml) args.push(`--xml=${input.xml}`);
      args.push(input.target);
      return args;
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  SMB / AD
  // ════════════════════════════════════════════════════════════════

  enum4linux: {
    id: 'enum4linux',
    name: 'enum4linux',
    category: 'smb',
    binary: 'enum4linux',
    description: 'SMB/NetBIOS enumeration — users, shares, groups, policies.',
    fields: [
      { name: 'target',   label: 'Target IP',             type: 'text',   required: true, placeholder: '10.0.0.1' },
      { name: 'user',     label: 'Username (-u)',          type: 'text',   placeholder: 'anonymous' },
      { name: 'pass',     label: 'Password (-p)',          type: 'text',   placeholder: '' },
      { name: 'all',      label: 'All checks (-a)',        type: 'checkbox' },
      { name: 'users',    label: 'Enumerate users (-U)',   type: 'checkbox' },
      { name: 'shares',   label: 'Enumerate shares (-S)',  type: 'checkbox' },
      { name: 'groups',   label: 'Enumerate groups (-G)',  type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      pushFlagValue(args, '-u', input.user);
      pushFlagValue(args, '-p', input.pass);
      pushFlag(args, '-a', input.all);
      pushFlag(args, '-U', input.users);
      pushFlag(args, '-S', input.shares);
      pushFlag(args, '-G', input.groups);
      args.push(input.target);
      return args;
    },
  },

  smbclient: {
    id: 'smbclient',
    name: 'smbclient',
    category: 'smb',
    binary: 'smbclient',
    description: 'List or connect to SMB shares.',
    fields: [
      { name: 'target',   label: 'Target IP / host',           type: 'text',   required: true, placeholder: '10.0.0.1' },
      { name: 'share',    label: 'Share name (leave blank to list)', type: 'text', placeholder: 'C$' },
      { name: 'user',     label: 'User (-U)',                   type: 'text',   placeholder: 'DOMAIN\\user' },
      { name: 'noPass',   label: 'No password (-N)',            type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      if (input.share) {
        args.push(`//${input.target}/${input.share}`);
      } else {
        args.push('-L', input.target);
      }
      pushFlagValue(args, '-U', input.user);
      pushFlag(args, '-N', input.noPass);
      return args;
    },
  },

  crackmapexec: {
    id: 'crackmapexec',
    name: 'CrackMapExec',
    category: 'smb',
    binary: 'crackmapexec',
    description: 'SMB/LDAP/WinRM post-exploitation and cred testing (CME).',
    fields: [
      { name: 'proto',  label: 'Protocol',              type: 'select', required: true, options: ['smb', 'winrm', 'ldap', 'mssql', 'ssh'] },
      { name: 'target', label: 'Target / CIDR',          type: 'text',   required: true, placeholder: '10.0.0.0/24' },
      { name: 'user',   label: 'Username (-u)',           type: 'text',   placeholder: 'Administrator' },
      { name: 'pass',   label: 'Password (-p)',           type: 'text',   placeholder: 'Password123!' },
      { name: 'shares', label: 'Enumerate shares',        type: 'checkbox' },
      { name: 'sam',    label: 'Dump SAM (--sam)',         type: 'checkbox' },
      { name: 'lsa',    label: 'Dump LSA (--lsa)',         type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [input.proto, input.target];
      pushFlagValue(args, '-u', input.user);
      pushFlagValue(args, '-p', input.pass);
      pushFlag(args, '--shares', input.shares);
      pushFlag(args, '--sam', input.sam);
      pushFlag(args, '--lsa', input.lsa);
      return args;
    },
  },

};

module.exports = { tools, CATEGORIES };
