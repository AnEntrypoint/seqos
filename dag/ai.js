import { NODE_TYPES, NODE_COLORS, generateId, createNode, createEdge, createWorkflow, validateWorkflow } from './types/index.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const workflowSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: NODE_TYPES },
          name: { type: 'string' },
          color: { type: 'string', enum: NODE_COLORS },
          config: { type: 'object' }
        },
        required: ['type', 'name']
      }
    },
    connections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'number' },
          to: { type: 'number' },
          fromHandle: { type: 'string' },
          toHandle: { type: 'string' }
        },
        required: ['from', 'to']
      }
    }
  },
  required: ['name', 'nodes', 'connections']
};

async function callOpenAI(messages, functions, model = DEFAULT_MODEL) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, functions, function_call: { name: functions[0].name } })
  });
  if (!response.ok) throw new Error(`OpenAI error: ${(await response.json()).error?.message}`);
  const { choices } = await response.json();
  if (choices[0].finish_reason === 'function_call') return JSON.parse(choices[0].message.function_call.arguments);
  throw new Error('Unexpected response');
}

function buildWorkflow(spec) {
  const nodeMap = new Map();
  const nodes = spec.nodes.map((nodeSpec, idx) => {
    const nodeId = generateId();
    nodeMap.set(idx, nodeId);
    return createNode(nodeSpec.type, {
      id: nodeId,
      name: nodeSpec.name,
      color: nodeSpec.color || 'gray',
      position: { x: (idx % 3) * 250, y: Math.floor(idx / 3) * 200 },
      inputs: nodeSpec.config?.inputs || [],
      outputs: nodeSpec.config?.outputs || [],
      settings: nodeSpec.config?.settings || {}
    });
  });
  const edges = spec.connections.map(conn => {
    const sourceId = nodeMap.get(conn.from);
    const targetId = nodeMap.get(conn.to);
    return sourceId && targetId ? createEdge(sourceId, targetId, { source: conn.fromHandle || 'output', target: conn.toHandle || 'input' }) : null;
  }).filter(Boolean);
  return createWorkflow(spec.name, nodes, edges);
}

async function generateWorkflow(description, options = {}) {
  const { model = DEFAULT_MODEL, services = [], examples = [] } = options;
  const systemPrompt = `You are a workflow generation expert. Create valid workflow definitions.
Node types: ${NODE_TYPES.join(', ')}
Colors: ${NODE_COLORS.join(', ')}
${services.length > 0 ? `Services: ${services.join(', ')}` : ''}
${examples.length > 0 ? `Examples:\n${examples.map(e => `- ${e}`).join('\n')}` : ''}`;
  const result = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Create workflow for: ${description}` }
  ], [{ name: 'generate_workflow', description: 'Generate workflow', parameters: workflowSchema }], model);
  const workflow = buildWorkflow(result);
  const validation = validateWorkflow(workflow);
  if (!validation.valid) throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
  return workflow;
}

async function suggestNodes(partialDescription, options = {}) {
  const { model = DEFAULT_MODEL, services = [], maxSuggestions = 5 } = options;
  const systemPrompt = `Suggest workflow nodes. Types: ${NODE_TYPES.join(', ')}
${services.length > 0 ? `Services: ${services.join(', ')}` : ''}`;
  const result = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Suggest nodes for: ${partialDescription}` }
  ], [{
    name: 'suggest_nodes', description: 'Suggest nodes',
    parameters: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: NODE_TYPES },
              name: { type: 'string' },
              description: { type: 'string' },
              color: { type: 'string', enum: NODE_COLORS }
            }
          }
        }
      },
      required: ['suggestions']
    }
  }], model);
  return result.suggestions.slice(0, maxSuggestions);
}

async function refineWorkflow(workflow, feedback, options = {}) {
  const { model = DEFAULT_MODEL } = options;
  const spec = {
    name: workflow.name,
    nodes: workflow.nodes.map(n => ({ type: n.type, name: n.name, color: n.color, config: n.config })),
    connections: workflow.edges.map(e => {
      const fromIdx = workflow.nodes.findIndex(n => n.id === e.source);
      const toIdx = workflow.nodes.findIndex(n => n.id === e.target);
      return { from: fromIdx, to: toIdx, fromHandle: e.sourceHandle, toHandle: e.targetHandle };
    })
  };
  const result = await callOpenAI([
    { role: 'system', content: `Refine workflows. Types: ${NODE_TYPES.join(', ')}` },
    { role: 'user', content: `Workflow: ${JSON.stringify(spec)}\nFeedback: ${feedback}` }
  ], [{ name: 'refine_workflow', description: 'Refine workflow', parameters: workflowSchema }], model);
  const refined = buildWorkflow(result);
  const validation = validateWorkflow(refined);
  if (!validation.valid) throw new Error(`Invalid refined workflow: ${validation.errors.join(', ')}`);
  return refined;
}

export { generateWorkflow, suggestNodes, refineWorkflow };
