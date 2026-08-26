'use strict';

const { spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Executes a tool binary with a fixed argv array. Never uses a shell, so
 * user-supplied values cannot be interpreted as shell metacharacters.
 */
function runTool(tool, input, options = {}) {
  const args = tool.buildArgs(input || {});
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const result = spawnSync(tool.binary, args, {
    shell: false,
    timeout,
    maxBuffer: 10 * 1024 * 1024, // 10MB
    encoding: 'utf8',
  });

  if (result.error) {
    const notFound = result.error.code === 'ENOENT';
    const timedOut = result.error.code === 'ETIMEDOUT';
    let stderr = result.error.message;
    if (notFound) stderr = `"${tool.binary}" is not installed or not on PATH.`;
    else if (timedOut) stderr = `"${tool.binary}" timed out after ${timeout}ms.`;
    return {
      command: tool.binary,
      args,
      stdout: '',
      stderr,
      code: null,
      timedOut,
      success: false,
    };
  }

  return {
    command: tool.binary,
    args,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    code: result.status,
    signal: result.signal,
    timedOut: false,
    success: result.status === 0,
  };
}

module.exports = { runTool, DEFAULT_TIMEOUT_MS };
