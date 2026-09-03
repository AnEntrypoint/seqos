import { createExecutor } from '../dag/executor.js';
import * as db from '../core/db.js';
import { jsonResponse, parseBody, parseRoute, log } from './helpers.js';
import { randomUUID } from 'crypto';

export function registerApiRoutes(executors) {
  const routes = [
    ['GET', (s) => s[0] === 'api' && s[1] === 'workflows' && !s[2], handleListWorkflows],
    ['POST', (s) => s[0] === 'api' && s[1] === 'workflows' && !s[2], handleCreateWorkflow],
    ['GET', (s) => s[0] === 'api' && s[1] === 'workflows' && s[2] && !s[3], handleGetWorkflow],
    ['DELETE', (s) => s[0] === 'api' && s[1] === 'workflows' && s[2] && !s[3], handleDeleteWorkflow],
    ['POST', (s) => s[0] === 'api' && s[1] === 'workflows' && s[2] && s[3] === 'run', handleRunWorkflow],
    ['GET', (s) => s[0] === 'api' && s[1] === 'task-runs' && s[2], handleGetTaskRun],
    ['GET', (s) => s[0] === 'debug' && s[1] === 'executors', handleDebugExecutors],
  ];

  return async function tryApiRoute(req, res, start) {
    const { method, url } = req;
    const { segments } = parseRoute(url);
    const match = routes.find(([m, test]) => m === method && test(segments));
    if (!match) return false;
    const [, , handler] = match;
    const body = (method === 'POST' || method === 'PUT') ? await parseBody(req) : {};
    const result = await handler({ segments, body, executors });
    jsonResponse(res, result.data, result.status || 200);
    log(method, url, result.status || 200, Date.now() - start);
    return true;
  };
}

async function handleListWorkflows() {
  const workflows = await db.listWorkflows();
  return { data: workflows };
}

async function handleCreateWorkflow({ body }) {
  const { id, name, nodes = [], connections = [] } = body;
  if (!id || !name) throw new Error('id and name required');
  const existing = await db.getWorkflow(id);
  if (existing) await db.deleteWorkflow(id);
  await db.createWorkflow(id, name);
  await Promise.all(nodes.map(n => db.createNodeInWorkflow(id, n.id, n.type, { ...n.config, name: n.name, icon: n.icon, position: n.position })));
  await Promise.all(connections.map(c => db.connectNodes(c.from, c.to)));
  return { data: { id, name } };
}

async function handleGetWorkflow({ segments }) {
  const id = segments[2];
  const workflow = await db.getWorkflow(id);
  if (!workflow) return { data: { error: 'Not found' }, status: 404 };
  const nodeRows = await db.getWorkflowNodes(id);
  const nodes = await Promise.all(nodeRows.map(async r => {
    const n = r.n || r.b;
    const config = JSON.parse(n.config || '{}');
    return { id: n.id, name: config.name || n.id, icon: config.icon || '', type: n.type, position: config.position || { x: 0, y: 0 }, config };
  }));
  const connections = [];
  for (const node of nodes) {
    const conns = await db.getNodeConnections(node.id);
    conns.forEach(c => { const t = c.n || c.b; connections.push({ from: node.id, to: t.id }); });
  }
  return { data: { ...workflow, nodes, connections } };
}

async function handleDeleteWorkflow({ segments }) {
  const id = segments[2];
  await db.deleteWorkflow(id);
  return { data: { ok: true } };
}

async function handleRunWorkflow({ segments, body, executors }) {
  const workflowId = segments[2];
  const input = body.input || {};
  const taskRunId = randomUUID();
  await db.createTaskRun(taskRunId, workflowId, input);
  const executor = createExecutor(taskRunId);
  executors.set(taskRunId, executor);
  const result = await executor.start(input);
  return { data: { taskRunId, status: result.status } };
}

async function handleGetTaskRun({ segments, executors }) {
  const id = segments[2];
  const taskRun = await db.getTaskRunById(id);
  if (!taskRun) return { data: { error: 'Not found' }, status: 404 };
  const executor = executors.get(id);
  const executorStatus = executor ? executor.getStatus() : null;
  return { data: { ...taskRun, executorStatus } };
}

async function handleDebugExecutors({ executors }) {
  const statuses = {};
  for (const [id, ex] of executors) statuses[id] = ex.getStatus();
  return { data: { count: executors.size, executors: statuses } };
}
