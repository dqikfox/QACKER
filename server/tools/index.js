'use strict';

/**
 * Declarative definitions for every tool exposed by the dashboard.
 *
 * Each definition describes:
 *  - id/name/description: metadata used to render the UI
 *  - binary: the executable that will be spawned (never invoked through a shell)
 *  - fields: form fields shown in the UI, each mapped to a specific CLI flag
 *  - buildArgs(input): turns validated form input into a safe argv array
 *
 * IMPORTANT: buildArgs must always return an array of discrete arguments.
 * Values are never concatenated into a shell string, which prevents shell
 * injection regardless of what a user types into a field.
 */

function pushFlagValue(args, flag, value) {
  if (value === undefined || value === null || value === '') return;
  args.push(flag, String(value));
}

function pushFlag(args, flag, enabled) {
  if (enabled) args.push(flag);
}

const tools = {
  nmap: {
    id: 'nmap',
    name: 'Nmap',
    binary: 'nmap',
    description: 'Network discovery and port/service scanning.',
    fields: [
      { name: 'target', label: 'Target (host/CIDR)', type: 'text', required: true, placeholder: '10.0.0.0/24' },
      { name: 'ports', label: 'Ports (-p)', type: 'text', placeholder: '1-1000,443' },
      { name: 'scanType', label: 'Scan type', type: 'select', options: ['-sV', '-sS', '-sT', '-sU', '-A', '-Pn'] },
      { name: 'timing', label: 'Timing (-T)', type: 'select', options: ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] },
      { name: 'scripts', label: 'NSE scripts (--script)', type: 'text', placeholder: 'vuln,default' },
      { name: 'osDetect', label: 'OS detection (-O)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = [];
      pushFlag(args, input.scanType, input.scanType);
      pushFlag(args, `-${input.timing}`, input.timing);
      pushFlag(args, '-O', input.osDetect);
      pushFlagValue(args, '-p', input.ports);
      pushFlagValue(args, '--script', input.scripts);
      args.push(input.target);
      return args;
    },
  },

  nikto: {
    id: 'nikto',
    name: 'Nikto',
    binary: 'nikto',
    description: 'Web server vulnerability scanner.',
    fields: [
      { name: 'host', label: 'Host (-h)', type: 'text', required: true, placeholder: 'https://example.com' },
      { name: 'port', label: 'Port (-p)', type: 'text', placeholder: '443' },
      { name: 'ssl', label: 'Force SSL (-ssl)', type: 'checkbox' },
      { name: 'tuning', label: 'Tuning (-Tuning)', type: 'text', placeholder: '1,2,3' },
    ],
    buildArgs(input) {
      const args = ['-h', input.host];
      pushFlagValue(args, '-p', input.port);
      pushFlagValue(args, '-Tuning', input.tuning);
      pushFlag(args, '-ssl', input.ssl);
      return args;
    },
  },

  sqlmap: {
    id: 'sqlmap',
    name: 'sqlmap',
    binary: 'sqlmap',
    description: 'Automated SQL injection detection and exploitation.',
    fields: [
      { name: 'url', label: 'Target URL (-u)', type: 'text', required: true, placeholder: 'https://example.com/item?id=1' },
      { name: 'data', label: 'POST data (--data)', type: 'text', placeholder: 'id=1&name=test' },
      { name: 'cookie', label: 'Cookie (--cookie)', type: 'text' },
      { name: 'level', label: 'Level (--level)', type: 'select', options: ['1', '2', '3', '4', '5'] },
      { name: 'risk', label: 'Risk (--risk)', type: 'select', options: ['1', '2', '3'] },
      { name: 'dbs', label: 'Enumerate DBs (--dbs)', type: 'checkbox' },
      { name: 'batch', label: 'Non-interactive (--batch)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '--data', input.data);
      pushFlagValue(args, '--cookie', input.cookie);
      pushFlagValue(args, '--level', input.level);
      pushFlagValue(args, '--risk', input.risk);
      pushFlag(args, '--dbs', input.dbs);
      pushFlag(args, '--batch', input.batch);
      return args;
    },
  },

  nuclei: {
    id: 'nuclei',
    name: 'Nuclei',
    binary: 'nuclei',
    description: 'Template-based vulnerability scanner.',
    fields: [
      { name: 'target', label: 'Target (-u)', type: 'text', required: true, placeholder: 'https://example.com' },
      { name: 'templates', label: 'Templates (-t)', type: 'text', placeholder: 'cves/,exposures/' },
      { name: 'severity', label: 'Severity (-severity)', type: 'text', placeholder: 'critical,high' },
      { name: 'tags', label: 'Tags (-tags)', type: 'text' },
      { name: 'rateLimit', label: 'Rate limit (-rl)', type: 'number' },
    ],
    buildArgs(input) {
      const args = ['-u', input.target];
      pushFlagValue(args, '-t', input.templates);
      pushFlagValue(args, '-severity', input.severity);
      pushFlagValue(args, '-tags', input.tags);
      pushFlagValue(args, '-rl', input.rateLimit);
      return args;
    },
  },

  ffuf: {
    id: 'ffuf',
    name: 'ffuf',
    binary: 'ffuf',
    description: 'Fast web fuzzer for directories, vhosts and parameters.',
    fields: [
      { name: 'url', label: 'URL with FUZZ keyword (-u)', type: 'text', required: true, placeholder: 'https://example.com/FUZZ' },
      { name: 'wordlist', label: 'Wordlist (-w)', type: 'text', required: true, placeholder: '/opt/SecLists/Discovery/Web-Content/common.txt' },
      { name: 'method', label: 'HTTP method (-X)', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { name: 'headers', label: 'Header (-H)', type: 'text', placeholder: 'Authorization: ******' },
      { name: 'matchCodes', label: 'Match codes (-mc)', type: 'text', placeholder: '200,301,302' },
      { name: 'filterCodes', label: 'Filter codes (-fc)', type: 'text', placeholder: '404' },
      { name: 'threads', label: 'Threads (-t)', type: 'number' },
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

  httpx: {
    id: 'httpx',
    name: 'httpx',
    binary: 'httpx',
    description: 'HTTP probing and technology/title detection.',
    fields: [
      { name: 'target', label: 'Target (-u)', type: 'text', required: true, placeholder: 'example.com' },
      { name: 'statusCode', label: 'Show status code (-sc)', type: 'checkbox' },
      { name: 'title', label: 'Show title (-title)', type: 'checkbox' },
      { name: 'techDetect', label: 'Tech detect (-td)', type: 'checkbox' },
      { name: 'followRedirects', label: 'Follow redirects (-fr)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.target];
      pushFlag(args, '-sc', input.statusCode);
      pushFlag(args, '-title', input.title);
      pushFlag(args, '-td', input.techDetect);
      pushFlag(args, '-fr', input.followRedirects);
      return args;
    },
  },

  subfinder: {
    id: 'subfinder',
    name: 'Subfinder',
    binary: 'subfinder',
    description: 'Passive subdomain enumeration.',
    fields: [
      { name: 'domain', label: 'Domain (-d)', type: 'text', required: true, placeholder: 'example.com' },
      { name: 'all', label: 'Use all sources (-all)', type: 'checkbox' },
      { name: 'silent', label: 'Silent output (-silent)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-d', input.domain];
      pushFlag(args, '-all', input.all);
      pushFlag(args, '-silent', input.silent);
      return args;
    },
  },

  katana: {
    id: 'katana',
    name: 'Katana',
    binary: 'katana',
    description: 'Fast web crawler for endpoint discovery.',
    fields: [
      { name: 'url', label: 'URL (-u)', type: 'text', required: true, placeholder: 'https://example.com' },
      { name: 'depth', label: 'Crawl depth (-depth)', type: 'number' },
      { name: 'jsluice', label: 'Extract endpoints from JS (-jsluice)', type: 'checkbox' },
    ],
    buildArgs(input) {
      const args = ['-u', input.url];
      pushFlagValue(args, '-depth', input.depth);
      pushFlag(args, '-jsluice', input.jsluice);
      return args;
    },
  },

  dalfox: {
    id: 'dalfox',
    name: 'Dalfox',
    binary: 'dalfox',
    description: 'XSS scanning and parameter analysis.',
    fields: [
      { name: 'mode', label: 'Mode', type: 'select', options: ['url', 'file', 'pipe'], required: true },
      { name: 'target', label: 'URL / file path', type: 'text', required: true, placeholder: 'https://example.com/search?q=test' },
      { name: 'cookie', label: 'Cookie (--cookie)', type: 'text' },
    ],
    buildArgs(input) {
      const args = [input.mode, input.target];
      pushFlagValue(args, '--cookie', input.cookie);
      return args;
    },
  },

  waybackurls: {
    id: 'waybackurls',
    name: 'waybackurls',
    binary: 'waybackurls',
    description: 'Fetch known URLs from the Wayback Machine.',
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com' },
    ],
    buildArgs(input) {
      return [input.domain];
    },
  },

  msfconsole: {
    id: 'msfconsole',
    name: 'Metasploit (msfconsole)',
    binary: 'msfconsole',
    description: 'Run a module non-interactively via msfconsole -x.',
    fields: [
      { name: 'module', label: 'Module (use)', type: 'text', required: true, placeholder: 'exploit/multi/handler' },
      { name: 'rhosts', label: 'RHOSTS', type: 'text' },
      { name: 'lhost', label: 'LHOST', type: 'text' },
      { name: 'lport', label: 'LPORT', type: 'text' },
      { name: 'payload', label: 'Payload (set PAYLOAD)', type: 'text', placeholder: 'linux/x64/meterpreter/reverse_tcp' },
    ],
    buildArgs(input) {
      const commands = [`use ${input.module}`];
      if (input.payload) commands.push(`set PAYLOAD ${input.payload}`);
      if (input.rhosts) commands.push(`set RHOSTS ${input.rhosts}`);
      if (input.lhost) commands.push(`set LHOST ${input.lhost}`);
      if (input.lport) commands.push(`set LPORT ${input.lport}`);
      commands.push('run', 'exit');
      return ['-q', '-x', commands.join('; ')];
    },
  },

  msfvenom: {
    id: 'msfvenom',
    name: 'Metasploit (msfvenom)',
    binary: 'msfvenom',
    description: 'Generate payloads with msfvenom.',
    fields: [
      { name: 'payload', label: 'Payload (-p)', type: 'text', required: true, placeholder: 'windows/x64/meterpreter/reverse_tcp' },
      { name: 'lhost', label: 'LHOST', type: 'text' },
      { name: 'lport', label: 'LPORT', type: 'text' },
      { name: 'format', label: 'Format (-f)', type: 'text', placeholder: 'exe' },
    ],
    buildArgs(input) {
      const args = ['-p', input.payload];
      if (input.lhost) args.push(`LHOST=${input.lhost}`);
      if (input.lport) args.push(`LPORT=${input.lport}`);
      pushFlagValue(args, '-f', input.format);
      return args;
    },
  },
};

module.exports = tools;
