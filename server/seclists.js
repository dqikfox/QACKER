'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Resolves the SecLists root directory. Configurable via SECLISTS_PATH so
 * users can point at a local checkout of https://github.com/danielmiessler/SecLists
 */
function getSeclistsRoot() {
  return path.resolve(process.env.SECLISTS_PATH || path.join(__dirname, '..', 'SecLists'));
}

/**
 * Lists the contents of a directory inside the SecLists root. `relativePath`
 * is resolved and validated to stay within the root to prevent path
 * traversal (e.g. `../../etc/passwd`).
 */
function listSeclists(relativePath = '') {
  const root = getSeclistsRoot();
  const target = path.resolve(root, '.' + path.sep + relativePath);

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Invalid path');
  }

  if (!fs.existsSync(root)) {
    return { available: false, root, entries: [] };
  }

  if (!fs.existsSync(target)) {
    throw new Error('Path not found');
  }

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    throw new Error('Not a directory');
  }

  const entries = fs.readdirSync(target, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: path.join(relativePath, entry.name).split(path.sep).join('/'),
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { available: true, root, entries };
}

module.exports = { getSeclistsRoot, listSeclists };
