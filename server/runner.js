'use strict';

const { spawnSync, spawn } = require('child_process');
const config = require('./config');

/**
 * Builds the actual argv that will be passed to spawnSync / spawn.
 *
 * On Windows (with WSL enabled) every tool is wrapped:
 *   wsl [-d <distro>] bash -lc "export PATH=<toolPaths>:$PATH; <binary> <args…>"
 *
 * This lets us run Linux tools (nuclei, ffuf, sqlmap, etc.) from the
 * Windows Node.js process without requiring them on the Windows PATH.
 *
 * On Linux the binary is called directly.
 */
function buildWslArgv(binary, toolArgs) {
  if (!config.shouldUseWsl()) {
    return { cmd: binary, args: toolArgs };
  }

  // Build a single shell command string so PATH is set correctly.
  // Arguments are quoted to handle spaces / special chars.
  const quotedArgs = toolArgs
    .map((a) => `'${String(a).replace(/'/g, "'\\''")}'`)
    .join(' ');
  const shellCmd = `export PATH=${config.wslToolPaths}:$PATH; ${binary} ${quotedArgs}`;

  const wslArgs = [];
  if (config.wslDistro) wslArgs.push('-d', config.wslDistro);
  wslArgs.push('bash', '-lc', shellCmd);

  return { cmd: config.wslBinary, args: wslArgs };
}

// ── Buffered (blocking) run ────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = config.timeoutMs;

/**
 * Runs a tool synchronously and returns { command, args, stdout, stderr,
 * code, signal, timedOut, success }.
 */
function runTool(tool, input, options = {}) {
  const toolArgs = tool.buildArgs(input || {});
  const timeout  = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const { cmd, args } = buildWslArgv(tool.binary, toolArgs);

  const result = spawnSync(cmd, args, {
    shell:     false,
    timeout,
    maxBuffer: config.maxBuffer,
    encoding:  'utf8',
    env: {
      ...process.env,
      // Suppress interactive prompts inside WSL
      DEBIAN_FRONTEND: 'noninteractive',
    },
  });

  if (result.error) {
    const notFound = result.error.code === 'ENOENT';
    const timedOut = result.error.code === 'ETIMEDOUT';
    let stderr = result.error.message;
    if (notFound) {
      stderr = config.shouldUseWsl()
        ? `"${tool.binary}" not found in WSL. Check WSL_TOOL_PATHS or install the tool.`
        : `"${tool.binary}" is not installed or not on PATH.`;
    } else if (timedOut) {
      stderr = `"${tool.binary}" timed out after ${timeout / 1000}s.`;
    }
    return { command: tool.binary, args: toolArgs, stdout: '', stderr, code: null, timedOut, success: false };
  }

  return {
    command:  tool.binary,
    args:     toolArgs,
    stdout:   result.stdout  || '',
    stderr:   result.stderr  || '',
    code:     result.status,
    signal:   result.signal,
    timedOut: false,
    success:  result.status === 0,
  };
}

// ── Streaming (async) run ─────────────────────────────────────────────────

/**
 * Spawns a tool asynchronously and returns the child process.
 * Callers attach stdout/stderr/close handlers.
 */
function spawnTool(tool, toolArgs) {
  const { cmd, args } = buildWslArgv(tool.binary, toolArgs);
  return spawn(cmd, args, {
    shell: false,
    env: {
      ...process.env,
      DEBIAN_FRONTEND: 'noninteractive',
    },
  });
}

module.exports = { runTool, spawnTool, buildWslArgv, DEFAULT_TIMEOUT_MS };
