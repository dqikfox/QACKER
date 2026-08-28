'use strict';

const { createApp } = require('./app');
const config        = require('./config');

if (require.main === module) {
  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    const addr     = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
    const toolCount = Object.keys(require('./tools').tools).length;
    const wslLabel  = config.shouldUseWsl()
      ? `enabled (${config.wslDistro || 'default distro'})`
      : 'disabled';

    // ASCII-only banner — safe on all Windows codepages (cp850, cp1252, utf-8)
    console.log('');
    console.log('  +--------------------------------------------------+');
    console.log('  |   QACKER  --  CyberStrike Arsenal                |');
    console.log('  |   KING@THRONE                                    |');
    console.log('  +--------------------------------------------------+');
    console.log(`  |   Dashboard : ${addr.padEnd(33)}|`);
    console.log(`  |   Tools     : ${String(toolCount).padEnd(33)}|`);
    console.log(`  |   WSL mode  : ${wslLabel.padEnd(33)}|`);
    console.log(`  |   Timeout   : ${String(config.timeoutMs / 1000 + 's per tool').padEnd(33)}|`);
    console.log('  +--------------------------------------------------+');
    console.log('');
    console.log('  Env overrides: PORT  HOST  USE_WSL  WSL_DISTRO');
    console.log('                 WSL_TOOL_PATHS  TOOL_TIMEOUT_MS  SECLISTS_PATH');
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('');
      console.error(`  [ERROR] Port ${config.port} is already in use.`);
      console.error(`  Another QACKER instance may be running.`);
      console.error(`  Close it or set a different PORT env var.`);
      console.error('');
    } else {
      console.error(`  [ERROR] Server error: ${err.message}`);
    }
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = (sig) => {
    console.log(`\n  [QACKER] Received ${sig} - shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

module.exports = { createApp };
