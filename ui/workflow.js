let currentWorkflow = null;
let workflows = new Map();
let listeners = [];
let selectedNodeId = null;

export function createWorkflow(id, name = 'Untitled') {
  const workflow = {
    id,
    name,
    nodes: [],
    connections: [],
    metadata: {
      created: Date.now(),
      modified: Date.now(),
      version: 1
    }
  };
  workflows.set(id, workflow);
  currentWorkflow = workflow;
  notifyListeners();
  return workflow;
}

export function getWorkflow(id = null) {
  if (!id) return currentWorkflow;
  return workflows.get(id);
}

export function addNode(node) {
  if (!currentWorkflow) return null;
  const newNode = {
    id: node.id || `node-${Date.now()}-${Math.random()}`,
    name: node.name || 'Node',
    icon: node.icon || '📦',
    type: node.type || 'action',
    position: node.position || { x: 100, y: 100 },
    config: node.config || {}
  };
  currentWorkflow.nodes.push(newNode);
  currentWorkflow.metadata.modified = Date.now();
  notifyListeners();
  return newNode;
}

export function updateNode(nodeId, updates) {
  if (!currentWorkflow) return null;
  const node = currentWorkflow.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  Object.assign(node, updates);
  currentWorkflow.metadata.modified = Date.now();
  notifyListeners();
  return node;
}

export function selectNode(nodeId) {
  selectedNodeId = nodeId;
  notifyListeners();
}

export function getSelectedNodeId() {
  return selectedNodeId;
}

export function deleteNode(nodeId) {
  if (!currentWorkflow) return;
  currentWorkflow.nodes = currentWorkflow.nodes.filter(n => n.id !== nodeId);
  currentWorkflow.connections = currentWorkflow.connections.filter(
    c => c.from !== nodeId && c.to !== nodeId
  );
  if (selectedNodeId === nodeId) selectedNodeId = null;
  currentWorkflow.metadata.modified = Date.now();
  notifyListeners();
}

export function addConnection(fromId, toId) {
  if (!currentWorkflow) return null;
  if (currentWorkflow.connections.some(c => c.from === fromId && c.to === toId)) return null;
  const connection = { from: fromId, to: toId, id: `conn-${Date.now()}` };
  currentWorkflow.connections.push(connection);
  currentWorkflow.metadata.modified = Date.now();
  notifyListeners();
  return connection;
}

export function deleteConnection(fromId, toId) {
  if (!currentWorkflow) return;
  currentWorkflow.connections = currentWorkflow.connections.filter(
    c => !(c.from === fromId && c.to === toId)
  );
  currentWorkflow.metadata.modified = Date.now();
  notifyListeners();
}

export function getNodes() {
  return currentWorkflow?.nodes || [];
}

export function getConnections() {
  return currentWorkflow?.connections || [];
}

export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach(l => l(currentWorkflow));
}

export function exportWorkflow() {
  return JSON.stringify(currentWorkflow, null, 2);
}

export function importWorkflow(json) {
  try {
    const workflow = JSON.parse(json);
    currentWorkflow = workflow;
    workflows.set(workflow.id, workflow);
    notifyListeners();
    return workflow;
  } catch (e) {
    console.error('Import failed:', e);
    return null;
  }
}

globalThis.workflow = {
  createWorkflow,
  getWorkflow,
  addNode,
  updateNode,
  selectNode,
  getSelectedNodeId,
  deleteNode,
  addConnection,
  deleteConnection,
  getNodes,
  getConnections,
  subscribe,
  exportWorkflow,
  importWorkflow
};
