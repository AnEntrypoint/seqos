const BASE = `${location.protocol}//${location.host}`;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorkflows() {
  return apiFetch('/api/workflows');
}

export async function saveWorkflow(workflow) {
  return apiFetch('/api/workflows', {
    method: 'POST',
    body: JSON.stringify({
      id: workflow.id,
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections
    })
  });
}

export async function deleteWorkflow(id) {
  return apiFetch(`/api/workflows/${id}`, { method: 'DELETE' });
}

export async function getWorkflow(id) {
  return apiFetch(`/api/workflows/${id}`);
}

export async function runWorkflow(id, input = {}) {
  return apiFetch(`/api/workflows/${id}/run`, { method: 'POST', body: JSON.stringify({ input }) });
}

export async function getTaskRun(id) {
  return apiFetch(`/api/task-runs/${id}`);
}
