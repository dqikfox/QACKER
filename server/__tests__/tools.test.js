'use strict';

const tools = require('../tools');

describe('tool command builders', () => {
  test('every tool exposes required metadata', () => {
    Object.values(tools).forEach((tool) => {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.binary).toBeTruthy();
      expect(typeof tool.buildArgs).toBe('function');
      expect(Array.isArray(tool.fields)).toBe(true);
    });
  });

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
    expect(args).toEqual(['-u', 'https://example.com?id=1', '--level', '3', '--risk', '2', '--dbs', '--batch']);
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

  test('shell metacharacters in input are treated as literal argv values, not injected', () => {
    const malicious = '10.0.0.1; rm -rf / #';
    const args = tools.nmap.buildArgs({ target: malicious });
    // The malicious string must appear as a single, untouched argv entry.
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

  test('waybackurls passes the domain as a single positional arg', () => {
    expect(tools.waybackurls.buildArgs({ domain: 'example.com' })).toEqual(['example.com']);
  });
});
