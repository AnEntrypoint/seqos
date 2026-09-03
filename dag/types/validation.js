import { NODE_TYPES, NODE_COLORS, INPUT_TYPES } from './constants.js';
import { isAcyclic } from './graph.js';

export function validateNode(node) {
  const errors = [];
  if (!node.id) errors.push('Node missing id');
  if (!node.type) errors.push('Node missing type');
  if (!NODE_TYPES.includes(node.type)) errors.push(`Invalid node type: ${node.type}`);
  if (!node.name) errors.push('Node missing name');
  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('Node missing valid position');
  }
  if (node.color && !NODE_COLORS.includes(node.color)) errors.push(`Invalid color: ${node.color}`);
  if (node.config?.inputs) {
    node.config.inputs.forEach((input, i) => {
      if (!input.id) errors.push(`Input ${i} missing id`);
      if (!input.type) errors.push(`Input ${i} missing type`);
      if (!INPUT_TYPES.includes(input.type)) errors.push(`Input ${i} invalid type: ${input.type}`);
    });
  }
  return { valid: errors.length === 0, errors };
}

export function validateEdge(edge, nodes) {
  const errors = [];
  if (!edge.id) errors.push('Edge missing id');
  if (!edge.source) errors.push('Edge missing source');
  if (!edge.target) errors.push('Edge missing target');
  if (edge.source === edge.target) errors.push('Edge cannot connect node to itself');
  const nodeIds = new Set(nodes.map(n => n.id));
  if (!nodeIds.has(edge.source)) errors.push(`Edge source not found: ${edge.source}`);
  if (!nodeIds.has(edge.target)) errors.push(`Edge target not found: ${edge.target}`);
  return { valid: errors.length === 0, errors };
}

export function validateWorkflow(workflow) {
  const errors = [];
  if (!workflow.id) errors.push('Workflow missing id');
  if (!workflow.name) errors.push('Workflow missing name');
  if (!Array.isArray(workflow.nodes)) errors.push('Workflow nodes must be array');
  if (!Array.isArray(workflow.edges)) errors.push('Workflow edges must be array');

  if (errors.length > 0) return { valid: false, errors };

  const nodeIds = new Set();
  workflow.nodes.forEach((node, i) => {
    const nodeResult = validateNode(node);
    if (!nodeResult.valid) errors.push(...nodeResult.errors.map(e => `Node ${i}: ${e}`));
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
  });

  const edgeKeys = new Set();
  workflow.edges.forEach((edge, i) => {
    const edgeResult = validateEdge(edge, workflow.nodes);
    if (!edgeResult.valid) errors.push(...edgeResult.errors.map(e => `Edge ${i}: ${e}`));
    const key = `${edge.source}-${edge.target}-${edge.sourceHandle}-${edge.targetHandle}`;
    if (edgeKeys.has(key)) errors.push(`Duplicate edge: ${key}`);
    edgeKeys.add(key);
  });

  if (!isAcyclic(workflow.nodes, workflow.edges)) errors.push('Workflow contains cycle');

  const triggers = workflow.nodes.filter(n => n.type === 'trigger');
  if (triggers.length === 0) errors.push('Workflow must have at least one trigger');

  return { valid: errors.length === 0, errors };
}