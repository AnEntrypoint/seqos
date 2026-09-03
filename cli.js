#!/usr/bin/env node
import { init, shutdown } from './index.js';
import { start, stop } from './seqos/server.js';
import { getConfig, setConfig } from './core/config.js';
import { expose, getAllExposed } from './core/debug.js';

const args = process.argv.slice(2);
const cmd = args[0];
const isDev = process.env.NODE_ENV === 'development' || args.includes('--dev');

function log(...args) {
  if (isDev) console.log('[seqos]', ...args);
  else console.log(...args);
}

function error(...args) {
  console.error('[seqos] ERROR:', ...args);
}

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(`seqos - workflow orchestration system

Usage:
  seqos init              Initialize database
  seqos server [port]      Start server (default: 3000)
  seqos debug             Show debug hooks
  seqos help              Show this help

Environment:
  SEQOS_PORT              Server port (default: 3000)
  SEQOS_HOST              Server host (default: localhost)
  RUNNER_EDGE_URL         Edge runner URL (default: http://localhost:8787)
  SEQOS_TIMEOUT           Execution timeout ms (default: 30000)
  NODE_ENV=development     Enable dev mode with verbose logging

API:
  import seqos from 'seqos'
  const api = await seqos.init()
`);
    return;
  }

  if (cmd === 'init') {
    try {
      const api = await init();
      log('Database initialized');
      if (isDev) {
        expose('api', api);
        log('Debug hooks exposed: __seqos, __seqosConfig, __seqosDebug');
      }
      await shutdown();
    } catch (err) {
      error('Failed to initialize:', err.message);
      if (isDev) console.error(err.stack);
      process.exit(1);
    }
    return;
  }

  if (cmd === 'server') {
    const port = args[1] ? parseInt(args[1], 10) : getConfig('server.port');
    if (isNaN(port)) {
      error('Invalid port:', args[1]);
      process.exit(1);
    }
    setConfig('server.port', port);
    try {
      const server = await start();
      if (isDev) {
        expose('server', server);
        log('Server debug hooks exposed');
      }
      log(`Server running on http://${getConfig('server.host')}:${port}`);
      log('Press Ctrl+C to stop');
      process.on('SIGINT', async () => {
        log('\nStopping server...');
        await stop();
        await shutdown();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        await stop();
        await shutdown();
        process.exit(0);
      });
    } catch (err) {
      error('Failed to start server:', err.message);
      if (isDev) console.error(err.stack);
      process.exit(1);
    }
    return;
  }

  if (cmd === 'debug') {
    try {
      await init();
      const exposed = getAllExposed();
      console.log('Debug hooks:');
      console.log(JSON.stringify(Object.keys(exposed), null, 2));
      console.log('\nAccess via: globalThis.__seqos()');
      await shutdown();
    } catch (err) {
      error('Failed to load debug hooks:', err.message);
      process.exit(1);
    }
    return;
  }

  error(`Unknown command: ${cmd}`);
  console.log('Run "seqos help" for usage information');
  process.exit(1);
}

main().catch(err => {
  error(err.message);
  if (isDev) console.error(err.stack);
  process.exit(1);
});
