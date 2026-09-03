import crypto from 'crypto';
import * as db from '../core/db.js';
import { getConfig } from '../core/config.js';

const serviceCache = new Map();
const rateLimitCounters = new Map();

function generateId() {
  return crypto.randomUUID();
}

async function registerService(name, endpoint, authRules = {}) {
  const existing = await db.getService(name);
  if (existing) {
    await db.updateService(existing.id, { endpoint, auth_rules: authRules, active: true });
    serviceCache.delete(name);
    return existing.id;
  }
  const id = generateId();
  await db.createService(id, name, endpoint, authRules);
  serviceCache.delete(name);
  return id;
}

async function getService(name) {
  if (serviceCache.has(name)) {
    const cached = serviceCache.get(name);
    if (Date.now() - cached.ts < getConfig('cache.serviceTtl')) return cached.data;
  }
  const svc = await db.getService(name);
  if (svc && svc.active) {
    serviceCache.set(name, { data: svc, ts: Date.now() });
    return svc;
  }
  return null;
}

async function getServiceEndpoint(name) {
  const svc = await getService(name);
  return svc ? svc.endpoint : null;
}

async function listServices() {
  return db.listServices(true);
}

function checkRateLimit(key, limits) {
  if (!limits || !limits.requests_per_minute) return true;
  const now = Date.now();
  const windowStart = now - 60000;
  let counter = rateLimitCounters.get(key);
  if (!counter) {
    counter = { counts: [], lastClean: now };
    rateLimitCounters.set(key, counter);
  }
  if (now - counter.lastClean > 60000) {
    counter.counts = counter.counts.filter(t => t > windowStart);
    counter.lastClean = now;
  }
  const recentCount = counter.counts.filter(t => t > windowStart).length;
  if (recentCount >= limits.requests_per_minute) return false;
  counter.counts.push(now);
  return true;
}

function validateAuth(auth, serviceRules) {
  if (!serviceRules || Object.keys(serviceRules).length === 0) return true;
  if (!auth) return false;
  const { allowed_keys, rate_limits, permissions } = serviceRules;
  if (allowed_keys && allowed_keys.length > 0) {
    const authKey = auth.key || auth.api_key || auth.token;
    if (!authKey || !allowed_keys.includes(authKey)) return false;
  }
  if (rate_limits) {
    const rateLimitKey = auth.key || auth.api_key || auth.client_id || 'anonymous';
    if (!checkRateLimit(rateLimitKey, rate_limits)) return false;
  }
  if (permissions && permissions.length > 0) {
    const authPerms = auth.permissions || [];
    const hasRequired = permissions.every(p => authPerms.includes(p));
    if (!hasRequired) return false;
  }
  return true;
}

async function deactivateService(name) {
  const svc = await db.getService(name);
  if (!svc) return false;
  await db.updateService(svc.id, { active: false });
  serviceCache.delete(name);
  return true;
}

async function updateServiceEndpoint(name, endpoint) {
  const svc = await db.getService(name);
  if (!svc) return false;
  await db.updateService(svc.id, { endpoint });
  serviceCache.delete(name);
  return true;
}

async function updateServiceAuthRules(name, authRules) {
  const svc = await db.getService(name);
  if (!svc) return false;
  await db.updateService(svc.id, { auth_rules: authRules });
  serviceCache.delete(name);
  return true;
}

async function routeCall(name, auth, method, params) {
  const svc = await getService(name);
  if (!svc) throw new Error(`Service not found: ${name}`);
  if (!validateAuth(auth, svc.auth_rules)) throw new Error('Unauthorized');
  const url = new URL(svc.endpoint);
  if (method) url.pathname = `${url.pathname.replace(/\/$/, '')}/${method}`;
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error(`Service error: ${res.status}`);
  return res.json();
}

function clearCache() {
  serviceCache.clear();
}

function clearRateLimits() {
  rateLimitCounters.clear();
}

export {
  registerService,
  getService,
  getServiceEndpoint,
  listServices,
  validateAuth,
  deactivateService,
  updateServiceEndpoint,
  updateServiceAuthRules,
  routeCall,
  clearCache,
  clearRateLimits
};
