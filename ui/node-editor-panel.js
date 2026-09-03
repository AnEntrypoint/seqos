import { getNodes, getSelectedNodeId, updateNode } from '/ui/workflow.js';
import { renderNodeName, renderTriggerConfig, renderActionConfig, renderInputOutputs } from '/ui/node-editor-render.js';

export function createNodeEditorPanel() {
  return {
    render() {
      const selectedId = getSelectedNodeId();
      const selectedNode = selectedId ? getNodes().find(n => n.id === selectedId) : null;

      if (!selectedNode) {
        return `<div style="padding: 20px; text-align: center; color: #999; font-size: 13px;">Select a node to edit its configuration</div>`;
      }

      return `<div style="display: flex; flex-direction: column; height: 100%; background: #09090b;">
        ${renderNodeName(selectedNode)}
        <div style="padding: 16px; border-bottom: 1px solid rgba(102, 126, 234, 0.1);">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #667eea; margin-bottom: 12px; letter-spacing: 0.5px;">CONFIGURATION</div>
          ${selectedNode.type === 'trigger' ? renderTriggerConfig(selectedNode) : renderActionConfig(selectedNode) || '<div style="font-size: 12px; color: #999;">No additional configuration</div>'}
        </div>
        ${renderInputOutputs(selectedNode)}
      </div>`;
    }
  };
}

export function attachNodeEditorListeners(container) {
  if (!container) return;

  container.addEventListener('change', (e) => {
    if (e.target.classList.contains('node-name-input')) {
      const nodeId = e.target.dataset.nodeId;
      updateNode(nodeId, { name: e.target.value });
    }
    if (e.target.classList.contains('node-config-select') || e.target.classList.contains('node-config-input')) {
      const nodeId = e.target.dataset.nodeId;
      const field = e.target.dataset.field;
      const node = getNodes().find(n => n.id === nodeId);
      if (node) {
        node.config = node.config || {};
        node.config[field] = e.target.value;
        updateNode(nodeId, { config: node.config });
      }
    }
  });

  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('node-config-textarea')) {
      const nodeId = e.target.dataset.nodeId;
      const field = e.target.dataset.field;
      const node = getNodes().find(n => n.id === nodeId);
      if (node) {
        node.config = node.config || {};
        node.config[field] = e.target.value;
        updateNode(nodeId, { config: node.config });
      }
    }
  });

  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('param-add-btn')) {
      const nodeId = e.target.dataset.nodeId;
      const paramType = e.target.dataset.type;
      const node = getNodes().find(n => n.id === nodeId);
      if (node) {
        node.config = node.config || {};
        const key = paramType === 'input' ? 'inputs' : 'outputs';
        node.config[key] = node.config[key] || [];
        node.config[key].push({ name: `param_${Date.now()}`, type: 'string' });
        updateNode(nodeId, { config: node.config });
      }
    }
    if (e.target.classList.contains('param-remove-btn')) {
      const nodeId = e.target.dataset.nodeId;
      const paramType = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index, 10);
      const node = getNodes().find(n => n.id === nodeId);
      if (node) {
        node.config = node.config || {};
        const key = paramType === 'input' ? 'inputs' : 'outputs';
        node.config[key] = node.config[key] || [];
        node.config[key].splice(index, 1);
        updateNode(nodeId, { config: node.config });
      }
    }
  });
}
