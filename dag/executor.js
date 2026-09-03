import * as db from '../core/db.js';
import * as state from '../core/state.js';
import * as types from './types/index.js';

const STATUS = { pending: 'pending', running: 'running', suspended: 'suspended', completed: 'completed', failed: 'failed' };

async function loadWorkflowData(workflowId) {
  const workflow = await db.getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  const nodeRows = await db.getWorkflowNodes(workflowId);
  const nodes = nodeRows.map(r => { const n = r.n || r.b; return { ...n, config: JSON.parse(n.config || '{}') }; });
  const edges = [];
  for (const node of nodes) {
    const conns = await db.getNodeConnections(node.id);
    conns.forEach(c => { const t = c.n || c.b; edges.push({ source: node.id, target: t.id, handle: c.r?.handle || 'default' }); });
  }
  return { ...workflow, nodes, edges };
}

async function getTaskRun(taskRunId) {
  const d = await db.getDB();
  const rows = await d.getNodes('TaskRun', { id: taskRunId });
  if (!rows[0]?.n) return null;
  const tr = rows[0].n;
  tr.input = JSON.parse(tr.input || '{}');
  return tr;
}

function determineNextNodes(workflow, completedNodeIds, suspendedNodeIds = []) {
  const completed = new Set(completedNodeIds);
  const suspended = new Set(suspendedNodeIds);
  const ready = [];
  for (const node of workflow.nodes) {
    if (completed.has(node.id) || suspended.has(node.id)) continue;
    const incoming = types.getIncomingEdges(workflow, node.id);
    if (incoming.length === 0 && node.type === 'trigger') { ready.push(node); continue; }
    const allDepsMet = incoming.every(e => completed.has(e.source));
    if (allDepsMet && incoming.length > 0) ready.push(node);
  }
  return ready;
}

async function executeNode(node, input, taskRunId, frameSeq) {
  const frameId = types.generateId();
  await db.createStackFrame(frameId, taskRunId, frameSeq, { nodeId: node.id, input, status: 'running' });

  if (node.type === 'trigger') {
    await db.updateFrameState(frameId, { nodeId: node.id, input, output: input, status: 'completed' }, 'completed');
    return { frameId, status: 'completed', output: input };
  }

  if (node.type === 'action' || node.type === 'transform') {
    const code = node.config.settings?.code || node.config.code;
    if (!code) {
      await db.updateFrameState(frameId, { nodeId: node.id, input, output: input, status: 'completed' }, 'completed');
      return { frameId, status: 'completed', output: input };
    }
    const result = await runCode(code, input, frameId, taskRunId);
    if (result.suspended) {
      await db.updateFrameState(frameId, { nodeId: node.id, input, suspendedAt: result.suspendedAt, vmState: result.vmState }, 'suspended');
      return { frameId, status: 'suspended', suspendReason: result.reason };
    }
    await db.updateFrameState(frameId, { nodeId: node.id, input, output: result.output, status: 'completed' }, 'completed');
    return { frameId, status: 'completed', output: result.output };
  }

  if (node.type === 'condition') {
    const condition = node.config.settings?.condition || node.config.condition || 'true';
    const result = evaluateCondition(condition, input);
    const activePath = result ? 'true' : 'false';
    await db.updateFrameState(frameId, { nodeId: node.id, input, output: { result, activePath }, status: 'completed' }, 'completed');
    return { frameId, status: 'completed', output: input, activePath };
  }

  if (node.type === 'parallel') {
    await db.updateFrameState(frameId, { nodeId: node.id, input, output: input, status: 'completed' }, 'completed');
    return { frameId, status: 'completed', output: input, parallel: true };
  }

  if (node.type === 'subworkflow') {
    const subWorkflowId = node.config.settings?.workflowId || node.config.workflowId;
    if (!subWorkflowId) throw new Error('Subworkflow node missing workflowId');
    await db.updateFrameState(frameId, { nodeId: node.id, input, subWorkflowId, status: 'suspended' }, 'suspended');
    return { frameId, status: 'suspended', suspendReason: 'subworkflow', subWorkflowId, subInput: input };
  }

  throw new Error(`Unknown node type: ${node.type}`);
}

function runCode(code, input, frameId, taskRunId) {
  return new Promise(resolve => {
    const sandbox = { input, result: null, _suspend: null, _taskRunId: taskRunId, _frameId: frameId };
    sandbox.suspend = (reason) => { sandbox._suspend = { reason, at: Date.now() }; };
    try {
      const fn = new Function('input', 'suspend', code);
      const output = fn.call(sandbox, input, sandbox.suspend);
      if (sandbox._suspend) {
        resolve({ suspended: true, reason: sandbox._suspend.reason, suspendedAt: sandbox._suspend.at, vmState: state.captureState(sandbox) });
      } else {
        resolve({ suspended: false, output: output ?? sandbox.result ?? input });
      }
    } catch (err) {
      resolve({ suspended: false, output: input, error: err.message });
    }
  });
}

function evaluateCondition(condition, data) {
  try {
    const fn = new Function('data', 'input', `return ${condition}`);
    return !!fn(data, data);
  } catch { return false; }
}

function createExecutor(taskRunId) {
  let workflow = null;
  let taskRun = null;
  let completedNodes = new Map();
  let nodeResults = new Map();
  let frameSeq = 0;
  let status = STATUS.pending;
  let suspendedFrames = new Map();

  return {
    async start(input) {
      taskRun = await getTaskRun(taskRunId);
      if (!taskRun) throw new Error(`TaskRun not found: ${taskRunId}`);
      workflow = await loadWorkflowData(taskRun.workflow_id);
      await db.updateTaskRunStatus(taskRunId, STATUS.running);
      status = STATUS.running;
      nodeResults.set('__input__', input || taskRun.input);
      return this.step();
    },

    async step() {
      if (status !== STATUS.running) return { status, completedNodes: [...completedNodes.keys()] };
      const suspendedNodeIds = [...suspendedFrames.values()].map(s => s.node.id);
      let maxIterations = workflow ? workflow.nodes.length + 1 : 100;
      while (maxIterations-- > 0) {
        const completedIds = [...completedNodes.keys()];
        const nextNodes = determineNextNodes(workflow, completedIds, suspendedNodeIds);
        if (nextNodes.length === 0) {
          if (suspendedFrames.size > 0) { status = STATUS.suspended; await db.updateTaskRunStatus(taskRunId, STATUS.suspended); }
          else { status = STATUS.completed; await db.updateTaskRunStatus(taskRunId, STATUS.completed); }
          return { status, completedNodes: completedIds, results: Object.fromEntries(nodeResults), suspendedFrames: [...suspendedFrames.keys()] };
        }
        for (const node of nextNodes) {
          const incoming = types.getIncomingEdges(workflow, node.id);
          let nodeInput = nodeResults.get('__input__');
          if (incoming.length === 1) nodeInput = nodeResults.get(incoming[0].source) ?? nodeInput;
          else if (incoming.length > 1) nodeInput = incoming.map(e => nodeResults.get(e.source));
          const result = await executeNode(node, nodeInput, taskRunId, frameSeq++);
          if (result.status === 'completed') {
            completedNodes.set(node.id, result);
            nodeResults.set(node.id, result.output);
            if (node.type === 'condition') {
              const outEdges = types.getOutgoingEdges(workflow, node.id);
              outEdges.forEach(e => { if ((e.handle || e.sourceHandle) !== result.activePath) completedNodes.set(e.target, { skipped: true }); });
            }
          } else if (result.status === 'suspended') {
            suspendedFrames.set(result.frameId, { node, result });
            suspendedNodeIds.push(node.id);
          }
        }
      }
      throw new Error('Max iterations exceeded');
    },

    async resume(frameId, result) {
      const suspended = suspendedFrames.get(frameId);
      if (!suspended) throw new Error(`Frame not found or not suspended: ${frameId}`);
      suspendedFrames.delete(frameId);
      completedNodes.set(suspended.node.id, { ...suspended.result, status: 'completed', output: result });
      nodeResults.set(suspended.node.id, result);
      await db.updateFrameState(frameId, { output: result, status: 'completed' }, 'completed');
      if (status === STATUS.suspended) { status = STATUS.running; await db.updateTaskRunStatus(taskRunId, STATUS.running); }
      return this.step();
    },

    getStatus() {
      return { status, completedNodes: [...completedNodes.keys()], suspendedFrames: [...suspendedFrames.keys()], nodeResults: Object.fromEntries(nodeResults) };
    }
  };
}

export { createExecutor, loadWorkflowData, executeNode, STATUS };
