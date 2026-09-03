import { getDB } from './db.js';

export async function createService(id, name, endpoint, authRules = {}) {
  const d = await getDB();
  const now = Date.now();
  await d.createNode('Service', { id, name, endpoint, auth_rules: JSON.stringify(authRules), created_at: now, updated_at: now, active: true });
  return { id, name, endpoint, auth_rules: authRules, created_at: now, updated_at: now, active: true };
}

export async function getService(name) {
  const d = await getDB();
  const rows = await d.getNodes('Service', { name });
  if (!rows[0]?.n) return null;
  const svc = rows[0].n;
  svc.auth_rules = JSON.parse(svc.auth_rules || '{}');
  return svc;
}

export async function getServiceById(id) {
  const d = await getDB();
  const rows = await d.getNodes('Service', { id });
  if (!rows[0]?.n) return null;
  const svc = rows[0].n;
  svc.auth_rules = JSON.parse(svc.auth_rules || '{}');
  return svc;
}

export async function updateService(id, updates) {
  const d = await getDB();
  const sets = [];
  const params = { id, updated_at: Date.now() };
  sets.push('s.updated_at = $updated_at');
  if (updates.endpoint !== undefined) { sets.push('s.endpoint = $endpoint'); params.endpoint = updates.endpoint; }
  if (updates.auth_rules !== undefined) { sets.push('s.auth_rules = $auth_rules'); params.auth_rules = JSON.stringify(updates.auth_rules); }
  if (updates.active !== undefined) { sets.push('s.active = $active'); params.active = updates.active; }
  await d.exec(`MATCH (s:Service {id: $id}) SET ${sets.join(', ')}`, params);
}

export async function listServices(activeOnly = true) {
  const d = await getDB();
  const rows = await d.query(`MATCH (s:Service) ${activeOnly ? 'WHERE s.active = true' : ''} RETURN s`);
  return rows.map(r => { r.s.auth_rules = JSON.parse(r.s.auth_rules || '{}'); return r.s; });
}

export async function deleteService(id) {
  const d = await getDB();
  await d.exec('MATCH (s:Service {id: $id}) DELETE s', { id });
}
