'use strict';

/**
 * Runner tests.
 *
 * On Windows, the runner wraps every call through WSL, so we use the real
 * WSL-available binaries.  On Linux/WSL (USE_WSL=false) we use the native
 * binaries directly.
 *
 * All tests probe the error-handling and argument-passing behaviour of
 * runTool(), not the underlying tool functionality.
 */

const config   = require('../config');
const { runTool } = require('../runner');

// When running in CI on Linux (or WSL with USE_WSL=false) we can use
// native binaries.  On Windows with WSL the runner tunnels through WSL.
const ON_WINDOWS = config.isWindows && config.shouldUseWsl();

describe('runTool', () => {
  test('reports a friendly error when the binary is missing', () => {
    const tool = {
      binary: 'this-binary-does-not-exist-xyz-abc-qacker',
      buildArgs: () => ['--version'],
    };
    const result = runTool(tool, {});
    expect(result.success).toBe(false);
    // Should mention "not found" or "not installed"
    expect(result.stderr).toMatch(/not found|not installed/i);
  });

  test('executes a real binary and captures stdout without shell interpretation', () => {
    // Use 'true' (always-succeeds, no output) on Linux, or test via WSL on Windows.
    // The critical assertion is that shell metacharacters are NOT evaluated.
    const shell_meta = '$(whoami); echo pwned';
    const tool = ON_WINDOWS
      ? {
          // On Windows-WSL, use 'printf' which is a bash builtin; wrap in bash -c via binary=bash
          binary: 'bash',
          buildArgs: () => ['-c', `printf '%s' '${shell_meta.replace(/'/g, "'\\''")}'`],
        }
      : {
          binary: 'echo',
          buildArgs: (input) => [input.value],
        };

    const result = ON_WINDOWS
      ? runTool(tool, {})
      : runTool(tool, { value: shell_meta });

    expect(result.success).toBe(true);
    if (!ON_WINDOWS) {
      // On Linux the echo args are never interpreted by a shell.
      expect(result.stdout.trim()).toBe(shell_meta);
    }
  });

  test('reports timeout distinctly from other errors', () => {
    // Use a cross-platform sleep via bash when on Windows/WSL,
    // or native sleep on Linux.
    const tool = ON_WINDOWS
      ? { binary: 'bash', buildArgs: () => ['-c', 'sleep 10'] }
      : { binary: 'sleep', buildArgs: () => ['10'] };

    const result = runTool(tool, {}, { timeoutMs: 50 });
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.stderr).toMatch(/timed out/i);
  }, 8000);
});
