import { createHDB } from './hdb.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'seqos.db');

let db = null;
let initPromise = null;

const NODE_TABLES = {
  Workflow: { id: 'STRING PRIMARY KEY', name: 'STRING', created_at: 'STRING' },
  Node: { id: 'STRING PRIMARY KEY', workflow_id: 'STRING', type: 'STRING', config: 'STRING' },
  TaskRun: { id: 'STRING PRIMARY KEY', workflow_id: 'STRING', status: 'STRING', input: 'STRING' },
  StackFrame: { id: 'STRING PRIMARY KEY', task_run_id: 'STRING', vm_state: 'STRING', status: 'STRING' },
  Service: { id: 'STRING PRIMARY KEY', name: 'STRING', endpoint: 'STRING', auth_rules: 'STRING', created_at: 'INT64', updated_at: 'INT64', active: 'BOOL' }
};

const REL_TABLES = {
  CONTAINS: { from: 'Workflow', to: 'Node', schema: {} },
  CONNECTS: { from: 'Node', to: 'Node', schema: { handle: 'STRING' } },
  HAS_FRAME: { from: 'TaskRun', to: 'StackFrame', schema: { sequence: 'INT64' } },
  WAITING_ON: { from: 'StackFrame', to: 'StackFrame', schema: {} }
};

async function initSchema() {
  for (const [name, schema] of Object.entries(NODE_TABLES)) {
    await db.createNodeTable(name, schema);
  }
  for (const [name, { from, to, schema }] of Object.entries(REL_TABLES)) {
    await db.createRelTable(name, from, to, schema);
  }
}

async function getDB() {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    db = await createHDB(DB_PATH);
    await initSchema();
    return db;
  })();
  return initPromise;
}

async function closeDB() {
  if (db) {
    await db.close();
    db = null;
    initPromise = null;
  }
}

async function createWorkflow(id, name) {
  const d = await getDB();
  await d.createNode('Workflow', { id, name, created_at: new Date().toISOString() });
  return { id, name };
}

async function listWorkflows() {
  const d = await getDB();
  const rows = await d.query('MATCH (w:Workflow) RETURN w');
  return rows.map(r => r.w);
}

async function deleteWorkflow(id) {
  const d = await getDB();
  await d.exec('MATCH (w:Workflow {id: $id})-[:CONTAINS]->(n:Node) DETACH DELETE n', { id });
  await d.exec('MATCH (w:Workflow {id: $id}) DELETE w', { id });
}

async function getWorkflow(id) {
  const d = await getDB();
  const rows = await d.getNodes('Workflow', { id });
  return rows[0]?.n || null;
}

async function getWorkflowNodes(workflowId) {
  const d = await getDB();
  return d.getRelated('Workflow', 'id', workflowId, 'CONTAINS', 'out');
}

async function getNodeConnections(nodeId) {
  const d = await getDB();
  return d.getRelated('Node', 'id', nodeId, 'CONNECTS', 'out');
}

async function createNodeInWorkflow(workflowId, nodeId, type, config = {}) {
  const d = await getDB();
  await d.createNode('Node', { id: nodeId, workflow_id: workflowId, type, config: JSON.stringify(config) });
  await d.createEdge('CONTAINS', 'Workflow', 'id', workflowId, 'Node', 'id', nodeId);
  return { id: nodeId, workflow_id: workflowId, type, config };
}

async function connectNodes(fromNodeId, toNodeId, handle = 'default') {
  const d = await getDB();
  await d.createEdge('CONNECTS', 'Node', 'id', fromNodeId, 'Node', 'id', toNodeId, { handle });
}

async function createTaskRun(id, workflowId, input = {}) {
  const d = await getDB();
  await d.createNode('TaskRun', { id, workflow_id: workflowId, status: 'pending', input: JSON.stringify(input) });
  return { id, workflow_id: workflowId, status: 'pending', input };
}

async function updateTaskRunStatus(id, status) {
  const d = await getDB();
  await d.exec('MATCH (t:TaskRun {id: $id}) SET t.status = $status', { id, status });
}

async function getTaskRunById(id) {
  const d = await getDB();
  const rows = await d.getNodes('TaskRun', { id });
  if (!rows[0]?.n) return null;
  const tr = rows[0].n;
  tr.input = JSON.parse(tr.input || '{}');
  return tr;
}

async function createStackFrame(id, taskRunId, sequence, vmState = {}) {
  const d = await getDB();
  await d.createNode('StackFrame', { id, task_run_id: taskRunId, vm_state: JSON.stringify(vmState), status: 'active' });
  await d.createEdge('HAS_FRAME', 'TaskRun', 'id', taskRunId, 'StackFrame', 'id', id, { sequence });
  return { id, task_run_id: taskRunId, sequence, vm_state: vmState, status: 'active' };
}

async function setFrameWaiting(frameId, waitingOnFrameId) {
  const d = await getDB();
  await d.createEdge('WAITING_ON', 'StackFrame', 'id', frameId, 'StackFrame', 'id', waitingOnFrameId);
}

async function updateFrameState(id, vmState, status) {
  const d = await getDB();
  await d.exec('MATCH (f:StackFrame {id: $id}) SET f.vm_state = $vmState, f.status = $status', { id, vmState: JSON.stringify(vmState), status });
}

async function getTaskRunFrames(taskRunId) {
  const d = await getDB();
  return d.query('MATCH (t:TaskRun {id: $taskRunId})-[r:HAS_FRAME]->(f:StackFrame) RETURN f, r.sequence AS sequence ORDER BY r.sequence', { taskRunId });
}

async function getFrameWaitingOn(frameId) {
  const d = await getDB();
  return d.getRelated('StackFrame', 'id', frameId, 'WAITING_ON', 'out');
}

export { createService, getService, getServiceById, updateService, listServices, deleteService } from './db-services.js';

export {
  getDB,
  closeDB,
  createWorkflow,
  listWorkflows,
  deleteWorkflow,
  getWorkflow,
  getWorkflowNodes,
  getNodeConnections,
  createNodeInWorkflow,
  connectNodes,
  createTaskRun,
  updateTaskRunStatus,
  getTaskRunById,
  createStackFrame,
  setFrameWaiting,
  updateFrameState,
  getTaskRunFrames,
  getFrameWaitingOn,
  DB_PATH,
  NODE_TABLES,
  REL_TABLES
};
