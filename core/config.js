import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const config = {
  server: {
    port: Number(process.env.SEQOS_PORT) || 3000,
    host: process.env.SEQOS_HOST || 'localhost'
  },
  edge: {
    url: process.env.RUNNER_EDGE_URL || globalThis.RUNNER_EDGE_URL || 'http://localhost:8787'
  },
  execution: {
    timeout: Number(process.env.SEQOS_TIMEOUT) || 30000
  },
  cache: {
    serviceTtl: Number(process.env.SEQOS_CACHE_TTL) || 30000,
    libraryTtl: Number(process.env.SEQOS_CACHE_TTL) || 60000
  }
};

export function getConfig(path) {
  const parts = path.split('.');
  let value = config;
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

export function setConfig(path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let target = config;
  for (const part of parts) {
    if (!target[part]) target[part] = {};
    target = target[part];
  }
  target[last] = value;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__seqosConfig = config;
}

export default config;
