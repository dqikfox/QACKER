'use strict';

const { runTool } = require('../runner');

describe('runTool', () => {
  test('reports a friendly error when the binary is missing', () => {
    const tool = {
      binary: 'this-binary-does-not-exist-xyz',
      buildArgs: () => ['--version'],
    };
    const result = runTool(tool, {});
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/not installed/i);
  });

  test('executes a real binary and captures stdout without using a shell', () => {
    const tool = {
      binary: 'echo',
      buildArgs: (input) => [input.value],
    };
    const result = runTool(tool, { value: '$(whoami); echo pwned' });
    expect(result.success).toBe(true);
    // Because no shell is used, the argument is echoed back literally.
    expect(result.stdout.trim()).toBe('$(whoami); echo pwned');
  });

  test('reports a timeout distinctly from other errors', () => {
    const tool = {
      binary: 'sleep',
      buildArgs: () => ['1'],
    };
    const result = runTool(tool, {}, { timeoutMs: 10 });
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.stderr).toMatch(/timed out/i);
  });
});
