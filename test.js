const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function assert(label, condition, detail = '') {
  if (condition) { console.log('✓', label); passed++; }
  else { console.error('✗', label, detail); failed++; }
}

const health = await req('GET', '/health');
assert('GET /health returns ok', health.data.status === 'ok', JSON.stringify(health.data));

const wfId = 'test-wf-' + Date.now();
const n1 = wfId + '-n1';
const n2 = wfId + '-n2';
const create = await req('POST', '/api/workflows', {
  id: wfId, name: 'Test Workflow',
  nodes: [
    { id: n1, name: 'Start', icon: '', type: 'trigger', position: { x: 0, y: 0 }, config: {} },
    { id: n2, name: 'End', icon: '', type: 'action', position: { x: 100, y: 0 }, config: {} }
  ],
  connections: [{ from: n1, to: n2 }]
});
assert('POST /api/workflows creates workflow', create.status === 200 && create.data.id === wfId, JSON.stringify(create.data));

const list = await req('GET', '/api/workflows');
assert('GET /api/workflows lists workflow', Array.isArray(list.data) && list.data.some(w => w.id === wfId), JSON.stringify(list.data));

const get = await req('GET', `/api/workflows/${wfId}`);
assert('GET /api/workflows/:id returns workflow', get.data.id === wfId && Array.isArray(get.data.nodes) && get.data.nodes.length === 2, JSON.stringify(get.data));

const run = await req('POST', `/api/workflows/${wfId}/run`, { input: { test: true } });
assert('POST /api/workflows/:id/run returns taskRunId', typeof run.data.taskRunId === 'string', JSON.stringify(run.data));

if (run.data.taskRunId) {
  const tr = await req('GET', `/api/task-runs/${run.data.taskRunId}`);
  assert('GET /api/task-runs/:id returns completed task run', tr.data.id === run.data.taskRunId && tr.data.executorStatus?.status === 'completed', JSON.stringify(tr.data));
}

const dbg = await req('GET', '/debug/executors');
assert('GET /debug/executors returns count', typeof dbg.data.count === 'number', JSON.stringify(dbg.data));

const del = await req('DELETE', `/api/workflows/${wfId}`);
assert('DELETE /api/workflows/:id removes workflow', del.data.ok === true, JSON.stringify(del.data));

const listAfter = await req('GET', '/api/workflows');
assert('workflow gone after delete', Array.isArray(listAfter.data) && !listAfter.data.some(w => w.id === wfId));

const uiHtml = await fetch(BASE).then(r => r.text());
assert('GET / serves UI HTML', uiHtml.includes('SeqOS') && uiHtml.includes('<div id="root">'));

const apiJs = await fetch(`${BASE}/ui/api.js`).then(r => r.text());
assert('GET /ui/api.js serves module', apiJs.includes('listWorkflows'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
