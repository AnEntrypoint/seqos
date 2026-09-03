import { getNodes, getConnections, getSelectedNodeId } from '/ui/workflow.js';
import { createNodeEditorPanel } from '/ui/node-editor-panel.js';

export function renderConnections() {
  const connections = getConnections();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'dag-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  connections.forEach(conn => {
    const from = getNodes().find(n => n.id === conn.from);
    const to = getNodes().find(n => n.id === conn.to);
    if (!from || !to) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.position.x + 64);
    line.setAttribute('y1', from.position.y + 64);
    line.setAttribute('x2', to.position.x + 64);
    line.setAttribute('y2', to.position.y + 64);
    line.setAttribute('class', 'dag-connection');
    svg.appendChild(line);
  });
  return svg;
}

export function renderSidebar(activeTab, nodeEditorPanel) {
  const selectedId = getSelectedNodeId();
  const selectedNode = selectedId ? getNodes().find(n => n.id === selectedId) : null;

  let sidebarContent = '';
  if (activeTab === 'nodes') {
    sidebarContent = `
      <div class="dag-sidebar-title">Available Nodes</div>
      <div class="dag-node-item" id="btn-trigger">+ Trigger</div>
      <div class="dag-node-item" id="btn-action">+ Action</div>
      <div class="dag-node-item" id="btn-decision">+ Decision</div>
      <div class="dag-sidebar-title" style="margin-top: 24px;">Workflow Info</div>
      <div style="font-size: 12px; color: #999; padding: 8px;">Nodes: ${getNodes().length}<br/>Connections: ${getConnections().length}</div>
    `;
  } else if (activeTab === 'edit' && selectedNode) {
    sidebarContent = nodeEditorPanel.render();
  } else {
    sidebarContent = `<div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">Select a node to edit</div>`;
  }

  return `
    <div class="dag-sidebar-tabs">
      <div class="dag-sidebar-tab ${activeTab === 'nodes' ? 'active' : ''}" id="tab-nodes">Nodes</div>
      <div class="dag-sidebar-tab ${activeTab === 'edit' ? 'active' : ''}" id="tab-edit">Edit</div>
    </div>
    <div class="dag-sidebar-content">
      ${sidebarContent}
    </div>
  `;
}

export function getNodeColor(node) {
  return node.type === 'trigger' ? { vibrant: '#ec4899', light: '#f48dbe' } : { vibrant: '#10b981', light: '#6ee7b7' };
}

export function hexToRgb(hex) {
  const result = hex.match(/[0-9a-f]{2}/gi);
  return result ? result.map(x => parseInt(x, 16)).join(', ') : '102, 182, 129';
}
