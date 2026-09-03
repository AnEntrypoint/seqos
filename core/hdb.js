import { Database, Connection } from 'kuzu';

class HDB {
  constructor(path) {
    this.path = path || '';
    this.db = null;
    this.conn = null;
  }

  async open() {
    if (this.db) return this;
    this.db = new Database(this.path);
    this.conn = new Connection(this.db);
    return this;
  }

  async close() {
    this.conn = null;
    this.db = null;
  }

  async query(cypher, params = {}) {
    if (!this.conn) throw new Error('Database not open');
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const stmt = await this.conn.prepare(cypher);
      const result = await this.conn.execute(stmt, params);
      return result.getAll();
    }
    const result = await this.conn.query(cypher);
    return result.getAll();
  }

  async exec(cypher, params = {}) {
    await this.query(cypher, params);
  }

  async createNodeTable(name, schema) {
    const cols = Object.entries(schema).map(([k, v]) => `${k} ${v}`).join(', ');
    try {
      await this.exec(`CREATE NODE TABLE ${name}(${cols})`);
    } catch (e) {
      if (!e.message.includes('already exists')) throw e;
    }
  }

  async createRelTable(name, from, to, schema = {}) {
    const props = Object.entries(schema).map(([k, v]) => `, ${k} ${v}`).join('');
    try {
      await this.exec(`CREATE REL TABLE ${name}(FROM ${from} TO ${to}${props})`);
    } catch (e) {
      if (!e.message.includes('already exists')) throw e;
    }
  }

  async createNode(table, data) {
    const keys = Object.keys(data);
    const props = keys.map(k => `${k}: $${k}`).join(', ');
    await this.exec(`CREATE (:${table} {${props}})`, data);
  }

  async createEdge(relTable, fromTable, fromKey, fromVal, toTable, toKey, toVal, props = {}) {
    const params = { fromVal, toVal, ...props };
    const propKeys = Object.keys(props);
    const propStr = propKeys.length ? ` {${propKeys.map(k => `${k}: $${k}`).join(', ')}}` : '';
    await this.exec(`
      MATCH (a:${fromTable} {${fromKey}: $fromVal}), (b:${toTable} {${toKey}: $toVal})
      CREATE (a)-[:${relTable}${propStr}]->(b)
    `, params);
  }

  async createVectorIndex(table, indexName, column, metric = 'cosine') {
    this._vectorIndexTable = this._vectorIndexTable || {};
    this._vectorIndexTable[indexName] = table;
    await this.exec(`CALL CREATE_VECTOR_INDEX('${table}', '${indexName}', '${column}', metric := '${metric}')`);
  }

  async vectorSearch(table, indexName, vector, k = 10) {
    return this.query(`
      CALL QUERY_VECTOR_INDEX('${table}', '${indexName}', $vec, ${k})
      RETURN node, distance
      ORDER BY distance
    `, { vec: vector });
  }

  async vectorSearchWithTraversal(table, indexName, vector, k, cypher) {
    return this.query(`
      CALL QUERY_VECTOR_INDEX('${table}', '${indexName}', $vec, ${k})
      WITH node, distance
      ${cypher}
    `, { vec: vector });
  }

  async getNodes(table, where = {}) {
    const keys = Object.keys(where);
    const whereClause = keys.length ? `WHERE ${keys.map(k => `n.${k} = $${k}`).join(' AND ')}` : '';
    return this.query(`MATCH (n:${table}) ${whereClause} RETURN n`, where);
  }

  async getRelated(table, key, value, relTable, direction = 'out') {
    const pattern = direction === 'out' ? `(a)-[r:${relTable}]->(b)` : `(a)<-[r:${relTable}]-(b)`;
    return this.query(`MATCH (a:${table} {${key}: $value}), ${pattern} RETURN b, r`, { value });
  }
}

async function createHDB(path) {
  const db = new HDB(path);
  await db.open();
  return db;
}

export { HDB, createHDB };
