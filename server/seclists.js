'use strict';

const fs   = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Resolves the SecLists root directory.
 * Priority: SECLISTS_PATH env → config.resolveSeclistsRoot() (WSL UNC on Windows).
 */
function getSeclistsRoot() {
  return config.resolveSeclistsRoot();
}

/**
 * Splits a user-supplied relative path into segments, rejecting any
 * `..` traversal, absolute paths, or null bytes.
 */
function sanitizeRelativePath(relativePath) {
  if (typeof relativePath !== 'string') throw new Error('Invalid path');
  if (relativePath.includes('\0'))       throw new Error('Invalid path');

  const segments = relativePath.split(/[\\/]+/).filter((s) => s.length > 0);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') throw new Error('Invalid path');
  }
  return segments;
}

/**
 * Lists the contents of a directory inside the SecLists root.
 */
function listSeclists(relativePath = '') {
  const root     = getSeclistsRoot();
  const segments = sanitizeRelativePath(relativePath);
  const safeRel  = segments.join('/');
  const target   = segments.reduce((dir, seg) => path.join(dir, seg), root);

  if (!fs.existsSync(root)) {
    return { available: false, root, entries: [] };
  }

  if (!fs.existsSync(target)) throw new Error('Path not found');

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) throw new Error('Not a directory');

  const entries = fs.readdirSync(target, { withFileTypes: true })
    .map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: safeRel ? `${safeRel}/${e.name}` : e.name,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { available: true, root, entries };
}

module.exports = { getSeclistsRoot, listSeclists };
