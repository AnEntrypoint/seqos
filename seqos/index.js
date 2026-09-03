import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import * as coreDb from '../core/db.js';
import * as coreRunner from '../core/runner/index.js';
import * as coreState from '../core/state.js';
import * as dagTypes from '../dag/types/index.js';
import * as dagExecutor from '../dag/executor.js';
import * as servicesRegistry from '../services/registry.js';
import * as servicesWrapper from '../services/wrapper.js';
import { expose } from '../core/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const core = { db: coreDb, runner: coreRunner, state: coreState };
const dag = { types: dagTypes, executor: dagExecutor };
const services = { registry: servicesRegistry, wrapper: servicesWrapper };

const { getDB, closeDB, createTaskRun, createWorkflow: createWorkflowDB, createNodeInWorkflow, connectNodes, getWorkflow, updateTaskRunStatus } = coreDb;
const { createRunner, SuspensionError } = coreRunner;
const { createNode, createEdge, createWorkflow, validateWorkflow, getExecutionOrder } = dagTypes;
const { createExecutor } = dagExecutor;
const { registerService, getService, validateAuth, routeCall } = servicesRegistry;
const { createWrapper, validateChain } = servicesWrapper;

async function loadEdge() {
  const { pathToFileURL } = await import('url');
  const runner = await import(pathToFileURL(path.join(__dirname, '..', 'edge', 'runner.js')).href);
  const service = await import(pathToFileURL(path.join(__dirname, '..', 'edge', 'service.js')).href);
  return {
    runnerHandler: runner.handleRunnerRequest,
    serviceHandler: service.handleServiceRequest,
    spawnRunner: runner.spawnRunner,
    resumeRunner: runner.resumeRunner,
    executeServiceCall: service.executeServiceCall,
    runner: runner.default,
    service: service.default
  };
}

async function loadUI() {
  const { pathToFileURL } = await import('url');
  const templates = await import(pathToFileURL(path.join(__dirname, '..', 'ui', 'templates.js')).href);
  const isBrowser = typeof globalThis.HTMLElement !== 'undefined';
  let elements = null;
  if (isBrowser) {
    elements = await import(pathToFileURL(path.join(__dirname, '..', 'ui', 'elements.js')).href);
  }
  return {
    SeqElement: elements?.SeqElement || null,
    defineElement: elements?.defineElement || (() => null),
    createElement: elements?.createElement || (() => null),
    html: elements?.html || ((strings, ...values) => strings.reduce((a, s, i) => a + s + (values[i] ?? ''), '')),
    reactive: elements?.reactive || (() => { }),
    registerTemplate: templates.registerTemplate,
    render: templates.render,
    getTemplate: templates.getTemplate,
    compileTemplate: templates.compileTemplate,
    helpers: templates.helpers
  };
}

let initialized = false;

async function init() {
  if (initialized) return await getAPI();
  await getDB();
  initialized = true;
  return await getAPI();
}

async function getAPI() {
  const edge = await loadEdge().catch(() => null);
  const ui = await loadUI().catch(() => null);
  const api = {
    db: { getDB, closeDB },
    core: { createRunner, SuspensionError },
    dag: { createNode, createEdge, createWorkflow, validateWorkflow, getExecutionOrder, createExecutor },
    services: { registerService, getService, createWrapper, validateChain },
    workflow: { run: runWorkflow, create: createWorkflowFull },
    service: { deploy: deployService, call: routeCall },
    edge,
    ui
  };
  expose('api', api);
  expose('workflows', { run: runWorkflow, create: createWorkflowFull });
  expose('services', { deploy: deployService, call: routeCall });
  return api;
}

async function runWorkflow(workflowId, input = {}) {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  const taskRunId = crypto.randomUUID();
  await createTaskRun(taskRunId, workflowId, input);
  const executor = createExecutor(taskRunId);
  return executor.start(input);
}

async function createWorkflowFull(name, nodes = [], edges = []) {
  const workflowId = crypto.randomUUID();
  await createWorkflowDB(workflowId, name);
  const nodeIdMap = new Map();
  for (const node of nodes) {
    const nodeId = node.id || crypto.randomUUID();
    nodeIdMap.set(node.id || node.name, nodeId);
    await createNodeInWorkflow(workflowId, nodeId, node.type, node.config || {});
  }
  for (const edge of edges) {
    const sourceId = nodeIdMap.get(edge.source) || edge.source;
    const targetId = nodeIdMap.get(edge.target) || edge.target;
    await connectNodes(sourceId, targetId, edge.handle || 'default');
  }
  return { id: workflowId, name, nodeCount: nodes.length, edgeCount: edges.length };
}

async function deployService(name, endpoint, authRules = {}) {
  const id = await registerService(name, endpoint, authRules);
  return { id, name, endpoint, active: true };
}

async function shutdown() {
  await closeDB();
  initialized = false;
}

export {
  init,
  shutdown,
  runWorkflow,
  createWorkflowFull as createWorkflow,
  deployService,
  getDB,
  closeDB,
  createRunner,
  SuspensionError,
  createNode,
  createEdge,
  validateWorkflow,
  getExecutionOrder,
  createExecutor,
  registerService,
  getService,
  createWrapper,
  validateChain,
  routeCall,
  validateAuth,
  loadEdge,
  loadUI,
  core,
  dag,
  services
};

export default {
  init,
  shutdown,
  runWorkflow,
  createWorkflow: createWorkflowFull,
  deployService,
  getDB,
  closeDB,
  createRunner,
  SuspensionError,
  createNode,
  createEdge,
  validateWorkflow,
  getExecutionOrder,
  createExecutor,
  registerService,
  getService,
  createWrapper,
  validateChain,
  routeCall,
  validateAuth,
  loadEdge,
  loadUI,
  core,
  dag,
  services
};
