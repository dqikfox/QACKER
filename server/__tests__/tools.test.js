'use strict';

const { tools, CATEGORIES } = require('../tools');

describe('tool catalogue', () => {
  test('every tool exposes required metadata', () => {
    Object.values(tools).forEach((tool) => {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.binary).toBeTruthy();
      expect(typeof tool.buildArgs).toBe('function');
      expect(Array.isArray(tool.fields)).toBe(true);
    });
  });

  test('every tool category is defined in CATEGORIES', () => {
    Object.values(tools).forEach((tool) => {
      expect(CATEGORIES).toHaveProperty(tool.category);
    });
  });

  test('expected tool IDs are all present', () => {
    const expected = [
      'nmap', 'nikto', 'sqlmap', 'nuclei', 'ffuf', 'gobuster', 'feroxbuster',
      'httpx', 'subfinder', 'amass', 'katana', 'waybackurls', 'whatweb',
      'dalfox', 'arjun', 'msfconsole', 'msfvenom',
      'hydra', 'john', 'hashcat', 'wpscan',
      'shell', 'curl', 'dig', 'whois',
      'ping', 'traceroute', 'openssl', 'sslscan',
      'enum4linux', 'smbclient', 'crackmapexec',
    ];
    const ids = Object.keys(tools);
    expected.forEach((id) => expect(ids).toContain(id));
  });
});

describe('tool command builders', () => {
  test('nmap builds expected args', () => {
    const args = tools.nmap.buildArgs({
      target: '10.0.0.1',
      ports: '80,443',
      scanType: '-sV',
      timing: 'T4',
      scripts: 'vuln',
      osDetect: true,
    });
    expect(args).toEqual(['-sV', '-T4', '-O', '-p', '80,443', '--script', 'vuln', '10.0.0.1']);
  });

  test('nmap omits flags for empty optional fields', () => {
    const args = tools.nmap.buildArgs({ target: '10.0.0.1' });
    expect(args).toEqual(['10.0.0.1']);
  });

  test('sqlmap builds expected args with checkboxes', () => {
    const args = tools.sqlmap.buildArgs({
      url: 'https://example.com?id=1',
      level: '3',
      risk: '2',
      dbs: true,
      batch: true,
    });
    expect(args).toEqual([
      '-u', 'https://example.com?id=1',
      '--level', '3',
      '--risk', '2',
      '--dbs',
      '--batch',
    ]);
  });

  test('ffuf requires url and wordlist as discrete args', () => {
    const args = tools.ffuf.buildArgs({
      url: 'https://example.com/FUZZ',
      wordlist: '/opt/SecLists/Discovery/Web-Content/common.txt',
      method: 'POST',
      matchCodes: '200,301',
    });
    expect(args).toEqual([
      '-u', 'https://example.com/FUZZ',
      '-w', '/opt/SecLists/Discovery/Web-Content/common.txt',
      '-X', 'POST',
      '-mc', '200,301',
    ]);
  });

  test('gobuster dir mode builds correct args', () => {
    const args = tools.gobuster.buildArgs({
      mode: 'dir',
      url: 'https://example.com',
      wordlist: '/usr/share/seclists/Discovery/Web-Content/common.txt',
      threads: '20',
    });
    expect(args).toEqual([
      'dir', '-u', 'https://example.com',
      '-w', '/usr/share/seclists/Discovery/Web-Content/common.txt',
      '-t', '20',
    ]);
  });

  test('hydra builds args with userlist and passlist', () => {
    const args = tools.hydra.buildArgs({
      target: '192.168.1.10',
      service: 'ssh',
      userlist: '/usr/share/seclists/Usernames/top-usernames-shortlist.txt',
      passlist: '/usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt',
      threads: '16',
      verbose: true,
    });
    expect(args).toContain('-L');
    expect(args).toContain('-P');
    expect(args).toContain('-V');
    expect(args).toContain('192.168.1.10');
    expect(args).toContain('ssh');
  });

  test('hashcat builds args for dictionary attack', () => {
    const args = tools.hashcat.buildArgs({
      hashfile: '/tmp/hashes.txt',
      mode: '0',
      hashtype: '1000',
      wordlist: '/usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt.tar.gz',
    });
    expect(args).toEqual([
      '-a', '0',
      '-m', '1000',
      '/tmp/hashes.txt',
      '/usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt.tar.gz',
    ]);
  });

  test('wpscan builds correct args with enumerate and api token', () => {
    const args = tools.wpscan.buildArgs({
      url: 'https://target.com',
      enumerate: 'vp',
      apiToken: 'MY_TOKEN',
    });
    expect(args).toEqual(['--url', 'https://target.com', '--no-banner', '--enumerate', 'vp', '--api-token', 'MY_TOKEN']);
  });

  test('waybackurls wraps domain in bash -c echo pipe', () => {
    const args = tools.waybackurls.buildArgs({ domain: 'example.com' });
    // binary is 'bash', args should be ['-c', "echo '...' | waybackurls"]
    expect(args[0]).toBe('-c');
    expect(args[1]).toMatch(/echo.*example\.com.*waybackurls/);
  });

  test('shell metacharacters in input are treated as literal argv values', () => {
    const malicious = '10.0.0.1; rm -rf / #';
    const args = tools.nmap.buildArgs({ target: malicious });
    expect(args).toEqual([malicious]);
    expect(args.some((a) => a.includes('rm') && a !== malicious)).toBe(false);
  });

  test('msfconsole builds a single -x argument with joined commands', () => {
    const args = tools.msfconsole.buildArgs({
      module: 'exploit/multi/handler',
      payload: 'linux/x64/meterpreter/reverse_tcp',
      lhost: '10.0.0.1',
      lport: '4444',
    });
    expect(args).toEqual([
      '-q',
      '-x',
      'use exploit/multi/handler; set PAYLOAD linux/x64/meterpreter/reverse_tcp; set LHOST 10.0.0.1; set LPORT 4444; run; exit',
    ]);
  });

  test('msfconsole rejects command-separator characters', () => {
    expect(() =>
      tools.msfconsole.buildArgs({
        module: 'exploit/multi/handler',
        lhost: '10.0.0.1; set EnableStageEncoding true',
      })
    ).toThrow(/Invalid character/);
  });

  test('msfconsole rejects newlines in field values', () => {
    expect(() =>
      tools.msfconsole.buildArgs({
        module: 'exploit/multi/handler\nset PAYLOAD evil',
      })
    ).toThrow(/Invalid character/);
  });

  test('shell tool wraps command in bash -c', () => {
    const args = tools.shell.buildArgs({ shellCmd: 'whoami && id' });
    expect(args).toEqual(['-c', 'whoami && id']);
  });

  test('curl builds correct args', () => {
    const args = tools.curl.buildArgs({
      url: 'https://example.com',
      method: 'POST',
      data: '{"a":1}',
      insecure: true,
      follow: true,
    });
    expect(args).toContain('-X');
    expect(args).toContain('POST');
    expect(args).toContain('-d');
    expect(args).toContain('{"a":1}');
    expect(args).toContain('-k');
    expect(args).toContain('-L');
    expect(args).toContain('https://example.com');
  });

  test('dig builds args with record type and server', () => {
    const args = tools.dig.buildArgs({
      domain: 'example.com',
      type: 'MX',
      server: '8.8.8.8',
      short: true,
    });
    expect(args).toContain('@8.8.8.8');
    expect(args).toContain('example.com');
    expect(args).toContain('MX');
    expect(args).toContain('+short');
  });

  test('whois builds minimal args', () => {
    const args = tools.whois.buildArgs({ target: 'example.com' });
    expect(args).toEqual(['example.com']);
  });

  test('utils category is defined in CATEGORIES', () => {
    expect(CATEGORIES).toHaveProperty('utils');
  });

  test('smb category is defined in CATEGORIES', () => {
    expect(CATEGORIES).toHaveProperty('smb');
  });

  test('ping builds correct -c count args', () => {
    const args = tools.ping.buildArgs({ target: '10.0.0.1', count: '5' });
    expect(args).toContain('-c');
    expect(args).toContain('5');
    expect(args).toContain('10.0.0.1');
  });

  test('traceroute builds icmp flag', () => {
    const args = tools.traceroute.buildArgs({ target: '8.8.8.8', icmp: true });
    expect(args).toContain('-I');
    expect(args).toContain('8.8.8.8');
  });

  test('openssl s_client builds -connect arg', () => {
    const args = tools.openssl.buildArgs({ mode: 's_client', host: 'example.com:443' });
    expect(args).toEqual(['s_client', '-connect', 'example.com:443']);
  });

  test('sslscan passes host and --no-failed', () => {
    const args = tools.sslscan.buildArgs({ target: 'example.com', noFailed: true });
    expect(args).toContain('--no-failed');
    expect(args).toContain('example.com');
  });

  test('enum4linux builds -a flag and target', () => {
    const args = tools.enum4linux.buildArgs({ target: '10.0.0.1', all: true });
    expect(args).toContain('-a');
    expect(args).toContain('10.0.0.1');
  });

  test('smbclient lists shares without share name', () => {
    const args = tools.smbclient.buildArgs({ target: '10.0.0.1', noPass: true });
    expect(args).toContain('-L');
    expect(args).toContain('10.0.0.1');
    expect(args).toContain('-N');
  });

  test('smbclient connects to named share', () => {
    const args = tools.smbclient.buildArgs({ target: '10.0.0.1', share: 'C$' });
    expect(args[0]).toBe('//10.0.0.1/C$');
  });

  test('crackmapexec builds smb proto with creds', () => {
    const args = tools.crackmapexec.buildArgs({
      proto: 'smb', target: '10.0.0.0/24', user: 'admin', pass: 'pass', shares: true,
    });
    expect(args[0]).toBe('smb');
    expect(args).toContain('-u');
    expect(args).toContain('admin');
    expect(args).toContain('--shares');
  });
});
