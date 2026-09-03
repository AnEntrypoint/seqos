import { getDB } from '../../core/db.js';

const TABLE_NAME = 'KVEntry';
const TABLE_SCHEMA = { id: 'STRING PRIMARY KEY', key: 'STRING', value: 'STRING' };

let initialized = false;

async function ensureTable() {
  if (initialized) return;
  const db = await getDB();
  await db.createNodeTable(TABLE_NAME, TABLE_SCHEMA);
  initialized = true;
}

async function get(key) {
  await ensureTable();
  const db = await getDB();
  const rows = await db.getNodes(TABLE_NAME, { key });
  if (!rows[0]?.n) return undefined;
  return JSON.parse(rows[0].n.value);
}

async function set(key, value) {
  await ensureTable();
  const db = await getDB();
  const existing = await db.getNodes(TABLE_NAME, { key });
  const serialized = JSON.stringify(value);
  if (existing[0]?.n) {
    await db.exec(`MATCH (e:${TABLE_NAME} {key: $key}) SET e.value = $value`, { key, value: serialized });
  } else {
    const id = `kv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.createNode(TABLE_NAME, { id, key, value: serialized });
  }
  return value;
}

async function del(key) {
  await ensureTable();
  const db = await getDB();
  await db.exec(`MATCH (e:${TABLE_NAME} {key: $key}) DELETE e`, { key });
  return true;
}

async function has(key) {
  await ensureTable();
  const db = await getDB();
  const rows = await db.getNodes(TABLE_NAME, { key });
  return !!rows[0]?.n;
}

async function list(prefix = '') {
  await ensureTable();
  const db = await getDB();
  const rows = await db.query(`MATCH (e:${TABLE_NAME}) RETURN e`);
  return rows
    .map(r => r.e.key)
    .filter(k => k.startsWith(prefix))
    .sort();
}

async function getMany(keys) {
  await ensureTable();
  const results = {};
  for (const key of keys) {
    results[key] = await get(key);
  }
  return results;
}

async function setMany(entries) {
  await ensureTable();
  const results = {};
  for (const [key, value] of Object.entries(entries)) {
    results[key] = await set(key, value);
  }
  return results;
}

const kv = {
  get,
  set,
  delete: del,
  has,
  list,
  getMany,
  setMany
};

export default kv;
export { get, set, del as delete, has, list, getMany, setMany };
