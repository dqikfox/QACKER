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
 * Splits a user-supplied relative path into path segments, rejecting any
 * `..` traversal segment, absolute paths, or embedded null bytes. Returns a
 * clean array of segment names that are safe to join onto a trusted root.
 */
function sanitizeRelativePath(relativePath) {
  if (typeof relativePath !== 'string') {
    throw new Error('Invalid path');
  }
  if (relativePath.includes('\0')) {
    throw new Error('Invalid path');
  }

  const segments = relativePath.split(/[\\/]+/).filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error('Invalid path');
    }
  }
  return segments;
}

/**
 * Lists the contents of a directory inside the SecLists root. `relativePath`
 * is split into individual segments and validated (no `..`, no absolute
 * paths, no null bytes) before being joined onto the trusted root, which
 * prevents path traversal outside of the SecLists directory.
 */
function listSeclists(relativePath = '') {
  const root = getSeclistsRoot();
  const segments = sanitizeRelativePath(relativePath);
  const safeRelativePath = segments.join('/');
  const target = segments.reduce((dir, segment) => path.join(dir, segment), root);

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
      path: safeRelativePath ? `${safeRelativePath}/${entry.name}` : entry.name,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { available: true, root, entries };
}

module.exports = { getSeclistsRoot, listSeclists };
