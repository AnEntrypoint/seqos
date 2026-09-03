import * as db from '../core/db.js';
import { createRunner, createRunnerFromState } from '../core/runner/index.js';
import { getStackFrame, getParentFrame } from '../core/utils/db-helpers.js';
import { getConfig } from '../core/config.js';
import { catchAtBoundary } from '../core/recovery.js';
import { jsonResponse } from '../core/utils/http.js';

const FRAME_STATUS = { ACTIVE: 'active', SUSPENDED: 'suspended', COMPLETED: 'completed', FAILED: 'failed' };

async function getFrameCode(frame) {
  const d = await db.getDB();
  const rows = await d.query(
    'MATCH (t:TaskRun {id: $taskRunId})-[:CONTAINS]->(n:Node) RETURN n.config AS config',
    { taskRunId: frame.task_run_id }
  );
  if (!rows[0]?.config) return null;
  const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
  return config.code || null;
}

async function spawnRunner(stackFrameId) {
  const frame = await getStackFrame(stackFrameId);
  if (!frame) throw new Error(`Frame not found: ${stackFrameId}`);
  const code = await getFrameCode(frame);
  if (!code) throw new Error(`No code for frame: ${stackFrameId}`);
  const runner = createRunner(stackFrameId, frame.task_run_id);
  const result = await runner.execute(code);
  if (result.status === 'suspended') {
    await callServiceEdge(result.childFrameId, result.suspensionError);
    return { status: 'suspended', childFrameId: result.childFrameId };
  }
  if (result.status === 'error') {
    await db.updateFrameState(stackFrameId, { error: result.error.message }, FRAME_STATUS.FAILED);
    throw result.error;
  }
  await db.updateFrameState(stackFrameId, { result: result.result }, FRAME_STATUS.COMPLETED);
  await notifyParent(stackFrameId);
  return { status: 'completed', result: result.result };
}

async function resumeRunner(stackFrameId, childResult) {
  const frame = await getStackFrame(stackFrameId);
  if (!frame) throw new Error(`Frame not found: ${stackFrameId}`);
  if (frame.status !== FRAME_STATUS.SUSPENDED) throw new Error(`Frame not suspended: ${stackFrameId}`);
  const code = await getFrameCode(frame);
  if (!code) throw new Error(`No code for frame: ${stackFrameId}`);
  const runner = createRunnerFromState(stackFrameId, frame.vm_state, frame.task_run_id);
  await runner.resume(childResult);
  const result = await runner.executeWithResume(code);
  if (result.status === 'suspended') {
    await callServiceEdge(result.childFrameId, result.suspensionError);
    return { status: 'suspended', childFrameId: result.childFrameId };
  }
  if (result.status === 'error') {
    await db.updateFrameState(stackFrameId, { error: result.error.message }, FRAME_STATUS.FAILED);
    throw result.error;
  }
  await db.updateFrameState(stackFrameId, { result: result.result }, FRAME_STATUS.COMPLETED);
  await notifyParent(stackFrameId);
  return { status: 'completed', result: result.result };
}

async function notifyParent(childFrameId) {
  const parent = await getParentFrame(childFrameId);
  if (!parent) return;
  const child = await getStackFrame(childFrameId);
  if (!child || child.status !== FRAME_STATUS.COMPLETED) return;
  const childResult = child.vm_state?.result;
  await triggerRunnerResume(parent.id, childResult);
}

async function callServiceEdge(childFrameId, suspensionError) {
  const endpoint = getConfig('edge.url');
  const payload = suspensionError.type === 'library'
    ? { frameId: childFrameId, service: suspensionError.serviceName, chain: suspensionError.chain }
    : { frameId: childFrameId, workflowId: suspensionError.workflowId, input: suspensionError.dagInput };
  await fetch(`${endpoint}/service`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function triggerRunnerResume(parentFrameId, childResult) {
  const endpoint = getConfig('edge.url');
  await fetch(`${endpoint}/runner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stackFrameId: parentFrameId, resume: true, childResult })
  });
}

async function handleRunnerRequest(req) {
  return catchAtBoundary(async () => {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
    const { stackFrameId, resume, childResult } = body;
    if (!stackFrameId) return jsonResponse({ error: 'stackFrameId required' }, 400);
    try {
      const result = resume ? await resumeRunner(stackFrameId, childResult) : await spawnRunner(stackFrameId);
      return jsonResponse(result);
    } catch (err) {
      await db.updateFrameState(stackFrameId, { error: err.message }, FRAME_STATUS.FAILED).catch(() => {});
      return jsonResponse({ error: err.message }, 500);
    }
  }, 'edge-runner')();
}

export default { fetch: handleRunnerRequest };

export { handleRunnerRequest, spawnRunner, resumeRunner, notifyParent };
