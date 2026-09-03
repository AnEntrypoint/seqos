import { NODE_TYPES, generateId } from './constants.js';

export function createNode(type, config = {}) {
  if (!NODE_TYPES.includes(type)) throw new Error(`Invalid node type: ${type}`);
  return {
    id: config.id || generateId(),
    type,
    name: config.name || type,
    icon: config.icon || 'box',
    nodeTypeId: config.nodeTypeId || type,
    color: config.color || 'gray',
    position: config.position || { x: 0, y: 0 },
    status: 'idle',
    config: {
      inputs: config.inputs || [],
      outputs: config.outputs || [],
      settings: config.settings || {}
    }
  };
}

export function createEdge(sourceId, targetId, handle = {}) {
  return {
    id: `${sourceId}-${targetId}-${generateId()}`,
    source: sourceId,
    target: targetId,
    sourceHandle: handle.source || 'output',
    targetHandle: handle.target || 'input'
  };
}

export function createWorkflow(name, nodes = [], edges = []) {
  return {
    id: generateId(),
    name,
    subtitle: '',
    nodes,
    edges,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}