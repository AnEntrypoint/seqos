function buildAdjacencyList(nodes, edges) {
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    if (adj.has(e.source)) adj.get(e.source).push(e.target);
  });
  return adj;
}

export function isAcyclic(nodes, edges) {
  const adj = buildAdjacencyList(nodes, edges);
  const visited = new Set();
  const recursionStack = new Set();

  const hasCycle = (nodeId) => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    for (const neighbor of (adj.get(nodeId) || [])) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) return false;
  }
  return true;
}

export function getExecutionOrder(nodes, edges) {
  if (!isAcyclic(nodes, edges)) return null;
  const adj = buildAdjacencyList(nodes, edges);
  const inDegree = new Map();
  nodes.forEach(n => inDegree.set(n.id, 0));
  edges.forEach(e => {
    if (inDegree.has(e.target)) inDegree.set(e.target, inDegree.get(e.target) + 1);
  });

  const queue = [];
  const result = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

  while (queue.length > 0) {
    const nodeId = queue.shift();
    result.push(nodeId);
    for (const neighbor of (adj.get(nodeId) || [])) {
      const newDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }
  return result.length === nodes.length ? result : null;
}

export function findRoots(nodes, edges) {
  const targets = new Set(edges.map(e => e.target));
  return nodes.filter(n => !targets.has(n.id)).map(n => n.id);
}

export function findLeaves(nodes, edges) {
  const sources = new Set(edges.map(e => e.source));
  return nodes.filter(n => !sources.has(n.id)).map(n => n.id);
}

export function getNodeById(workflow, id) {
  return workflow.nodes.find(n => n.id === id);
}

export function getIncomingEdges(workflow, nodeId) {
  return workflow.edges.filter(e => e.target === nodeId);
}

export function getOutgoingEdges(workflow, nodeId) {
  return workflow.edges.filter(e => e.source === nodeId);
}