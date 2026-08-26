'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('listSeclists', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seclists-test-'));
    fs.mkdirSync(path.join(tmpRoot, 'Discovery', 'Web-Content'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'Discovery', 'Web-Content', 'common.txt'), 'admin\n');
    process.env.SECLISTS_PATH = tmpRoot;
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.SECLISTS_PATH;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('lists top-level directories', () => {
    const { listSeclists } = require('../seclists');
    const result = listSeclists('');
    expect(result.available).toBe(true);
    expect(result.entries).toEqual([{ name: 'Discovery', type: 'directory', path: 'Discovery' }]);
  });

  test('lists nested files', () => {
    const { listSeclists } = require('../seclists');
    const result = listSeclists('Discovery/Web-Content');
    expect(result.entries).toEqual([{ name: 'common.txt', type: 'file', path: 'Discovery/Web-Content/common.txt' }]);
  });

  test('rejects path traversal attempts', () => {
    const { listSeclists } = require('../seclists');
    expect(() => listSeclists('../../etc')).toThrow('Invalid path');
  });

  test('reports unavailable when root does not exist', () => {
    delete process.env.SECLISTS_PATH;
    process.env.SECLISTS_PATH = path.join(tmpRoot, 'does-not-exist');
    jest.resetModules();
    const { listSeclists } = require('../seclists');
    const result = listSeclists('');
    expect(result.available).toBe(false);
  });
});
