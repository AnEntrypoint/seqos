import * as db from '../core/db.js';
import { getService, validateAuth } from '../services/registry.js';
import { createWrapper } from '../services/wrapper.js';
import { getParentFrame } from '../core/utils/db-helpers.js';
import { getConfig } from '../core/config.js';
import { catchAtBoundary } from '../core/recovery.js';
import { jsonResponse } from '../core/utils/http.js';

const FRAME_STATUS = { ACTIVE: 'active', SUSPENDED: 'suspended', COMPLETED: 'completed', FAILED: 'failed' };
const libraryCache = new Map();

async function loadServiceLibrary(serviceName) {
  if (libraryCache.has(serviceName)) {
    const cached = libraryCache.get(serviceName);
    if (Date.now() - cached.ts < getConfig('cache.libraryTtl')) return cached.lib;
  }
  const modulePath = `../services/libs/${serviceName}.js`;
  try {
    const mod = await import(modulePath);
    const lib = mod.default || mod;
    libraryCache.set(serviceName, { lib, ts: Date.now() });
    return lib;
  } catch (err) {
    throw new Error(`Failed to load library for service '${serviceName}': ${err.message}`);
  }
}

async function executeServiceCall(serviceName, chain, auth) {
  const service = await getService(serviceName);
  if (!service) throw new Error(`Service not found: ${serviceName}`);
  if (!validateAuth(auth, service.auth_rules)) throw new Error('Unauthorized');
  const library = await loadServiceLibrary(serviceName);
  const wrapper = createWrapper(library);
  return wrapper.execute(chain);
}


async function storeChildResult(frameId, result) {
  await db.updateFrameState(frameId, { result }, FRAME_STATUS.COMPLETED);
}

async function storeChildError(frameId, error) {
  await db.updateFrameState(frameId, { error: error.message || String(error) }, FRAME_STATUS.FAILED);
}

async function triggerParentResume(parentFrameId, childResult) {
  const endpoint = getConfig('edge.url');
  await fetch(`${endpoint}/runner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stackFrameId: parentFrameId, resume: true, childResult })
  });
}

async function handleServiceRequest(req) {
  return catchAtBoundary(async () => {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
    const { serviceName, chain, stackFrameId, auth } = body;
    if (!serviceName) return jsonResponse({ error: 'serviceName required' }, 400);
    if (!chain) return jsonResponse({ error: 'chain required' }, 400);
    if (!stackFrameId) return jsonResponse({ error: 'stackFrameId required' }, 400);
    let result;
    try {
      result = await executeServiceCall(serviceName, chain, auth || {});
    } catch (err) {
      await storeChildError(stackFrameId, err).catch(() => {});
      const parent = await getParentFrame(stackFrameId).catch(() => null);
      if (parent) {
        await triggerParentResume(parent.id, { error: err.message }).catch(() => {});
      }
      return jsonResponse({ error: err.message }, err.message.includes('Unauthorized') ? 401 : 500);
    }
    await storeChildResult(stackFrameId, result);
    const parent = await getParentFrame(stackFrameId);
    if (parent) {
      await triggerParentResume(parent.id, result);
    }
    return jsonResponse({ status: 'completed', result });
  }, 'edge-service')();
}

function clearLibraryCache() {
  libraryCache.clear();
}

export default { fetch: handleServiceRequest };

export {
  handleServiceRequest,
  loadServiceLibrary,
  executeServiceCall,
  clearLibraryCache
};
