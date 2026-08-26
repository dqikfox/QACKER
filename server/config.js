'use strict';

/**
 * QACKER — Central configuration
 *
 * All tunables are overridable via environment variables:
 *   PORT=4000 WSL_DISTRO=OpenClawGateway node server/index.js
 *
 * WSL distro auto-detection:
 *   On startup QACKER reads the default WSL distro from the Windows registry
 *   (HKCU\Software\Microsoft\Windows\CurrentVersion\Lxss).
 *
 * SecLists UNC resolution (Windows):
 *   Windows 11 exposes WSL filesystems at both \\wsl$\<distro>\ and
 *   \\wsl.localhost\<distro>\ — which one works depends on the WSL version
 *   and whether the WSL network redirector is active.  We probe both at
 *   startup and use whichever resolves first.  Falls back gracefully to
 *   "not available" without crashing.
 */

const fs        = require('fs');
const path      = require('path');
const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';

// ── Auto-detect the default WSL distro name ──────────────────────────────────
function detectWslDistro() {
  if (!isWindows) return '';
  if (process.env.WSL_DISTRO) return process.env.WSL_DISTRO;

  try {
    // Read the default distro from the registry key WSL sets.
    const ps = [
      '$def = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss" -ErrorAction SilentlyContinue).DefaultDistribution;',
      'if ($def) {',
      '  $k = Get-ChildItem "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss" | Where-Object { $_.GetValue(\"DistributionName\") -and $_.PSChildName -eq $def } | Select-Object -First 1;',
      '  if ($k) { Write-Output $k.GetValue(\"DistributionName\") }',
      '} else {',
      '  $k = Get-ChildItem "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss" -ErrorAction SilentlyContinue | Select-Object -First 1;',
      '  if ($k) { Write-Output $k.GetValue(\"DistributionName\") }',
      '}',
    ].join(' ');

    const result = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
      encoding: 'utf8',
      timeout:  5000,
      stdio:    ['ignore', 'pipe', 'ignore'],
    });
    const name = result.trim();
    if (name) return name;
  } catch (_) { /* fall through */ }

  return '';
}

// ── Probe which UNC prefix works for WSL filesystem access ───────────────────
// Windows 11 prefers \\wsl.localhost\<distro>\ over \\wsl$\<distro>\.
// We test at startup rather than every request.
function probeWslUncRoot(distro) {
  if (!isWindows || !distro) return null;

  const prefixes = [
    `\\\\wsl.localhost\\${distro}`,
    `\\\\wsl$\\${distro}`,
  ];

  for (const prefix of prefixes) {
    try {
      // Just check the root of the distro — fast, no deep stat.
      if (fs.existsSync(prefix)) return prefix;
    } catch (_) { /* try next */ }
  }

  // Neither worked — WSL may not be running yet.
  // Return the wsl.localhost form as the best default for Win11.
  return distro ? `\\\\wsl.localhost\\${distro}` : null;
}

const wslDistro   = detectWslDistro();
const wslUncRoot  = probeWslUncRoot(wslDistro);

// ── Config object ─────────────────────────────────────────────────────────────
const config = {
  // ── Server ─────────────────────────────────────────────────────────────────
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',

  // ── WSL ────────────────────────────────────────────────────────────────────
  useWsl:       process.env.USE_WSL !== 'false',
  wslBinary:    process.env.WSL_BINARY || 'wsl',
  wslDistro,
  wslUncRoot,   // resolved UNC root, e.g. \\wsl.localhost\OpenClawGateway

  // PATH prepended inside WSL so Go tools and APT tools are always found.
  wslToolPaths: process.env.WSL_TOOL_PATHS || [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/root/go/bin',
    '/home/openclaw/go/bin',
  ].join(':'),

  // ── Runner ─────────────────────────────────────────────────────────────────
  timeoutMs:  Number(process.env.TOOL_TIMEOUT_MS)  || 10 * 60 * 1000,   // 10 min
  maxBuffer:  Number(process.env.TOOL_MAX_BUFFER)  || 20 * 1024 * 1024, // 20 MB

  // ── SecLists ────────────────────────────────────────────────────────────────
  seclistsPath: process.env.SECLISTS_PATH || '',

  // ── Platform ───────────────────────────────────────────────────────────────
  isWindows,
};

// ── Methods ────────────────────────────────────────────────────────────────────

config.shouldUseWsl = function () {
  return config.isWindows && config.useWsl;
};

/**
 * Resolves the SecLists root path that Node.js (running on Windows) can open.
 *
 * Priority:
 *   1. SECLISTS_PATH env var  — used as-is
 *   2. Windows + WSL          — probed UNC root + /usr/share/seclists
 *   3. Linux / WSL shell      — /usr/share/seclists
 */
config.resolveSeclistsRoot = function () {
  if (config.seclistsPath) return config.seclistsPath;

  if (config.isWindows) {
    if (config.wslUncRoot) {
      return path.join(config.wslUncRoot, 'usr', 'share', 'seclists');
    }
    // Last-resort: construct path with known distro name even if UNC probe failed
    const distro = config.wslDistro || 'OpenClawGateway';
    return `\\\\wsl.localhost\\${distro}\\usr\\share\\seclists`;
  }

  return '/usr/share/seclists';
};

module.exports = config;
