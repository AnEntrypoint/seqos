import { createWorkflow, getNodes, getConnections, addNode, selectNode, updateNode, deleteNode, addConnection, getSelectedNodeId } from '/ui/workflow.js';
import { createNodeEditorPanel, attachNodeEditorListeners } from '/ui/node-editor-panel.js';
import { renderConnections, renderSidebar, getNodeColor, hexToRgb } from '/ui/ui-render.js';
import { listWorkflows, saveWorkflow, runWorkflow, getTaskRun, getWorkflow } from '/ui/api.js';

let currentWorkflowId = null;
let lastRun = null;
let connectionStatus = 'unknown';

export async function initUI() {
  let dragState = { nodeId: null, offset: { x: 0, y: 0 } };
  let lastRenderTime = 0;
  let activeTab = 'nodes';
  let renderCount = 0;
  let bannerText = null;
  let bannerStyle = null;

  window.__debug = window.__debug || {};
  window.__debug.api = { get connectionStatus() { return connectionStatus; }, get lastRun() { return lastRun; } };

  const root = document.getElementById('root');
  const nodeEditorPanel = createNodeEditorPanel();

  async function syncWorkflow() {
    const wf = { id: currentWorkflowId, name: 'SeqOS Workflow', nodes: getNodes(), connections: getConnections() };
    await saveWorkflow(wf);
  }

  function showBanner(text, style, autohide = false) {
    bannerText = text;
    bannerStyle = style;
    render();
    if (autohide) setTimeout(() => { bannerText = null; bannerStyle = null; render(); }, 3000);
  }

  async function doRun() {
    let poll = 0;
    showBanner('Running workflow... (poll 0)', 'background: rgba(102,126,234,0.2); color: #667eea; padding: 8px 16px; font-size: 13px;');
    const { taskRunId } = await runWorkflow(currentWorkflowId);
    const interval = setInterval(async () => {
      poll++;
      showBanner(`Running workflow... (poll ${poll})`, 'background: rgba(102,126,234,0.2); color: #667eea; padding: 8px 16px; font-size: 13px;');
      const tr = await getTaskRun(taskRunId);
      const status = tr.executorStatus?.status || tr.status;
      if (status === 'completed' || status === 'failed' || poll >= 30) {
        clearInterval(interval);
        lastRun = tr;
        if (status === 'completed') showBanner('Completed \u2713', 'background: rgba(0,200,0,0.15); color: #00c800; padding: 8px 16px; font-size: 13px;', true);
        else showBanner(`Failed: ${tr.error || status}`, 'background: rgba(229,9,20,0.15); color: #e50914; padding: 8px 16px; font-size: 13px;', true);
      }
    }, 500);
  }

  function renderNodes() {
    const selectedId = getSelectedNodeId();
    const nodes = getNodes();
    const nodesContainer = document.createElement('div');
    nodesContainer.className = 'dag-nodes-container';
    nodes.forEach(node => {
      const color = getNodeColor(node);
      const vibrantRgb = hexToRgb(color.vibrant);
      const isSelected = node.id === selectedId;
      const el = document.createElement('div');
      el.className = 'dag-node';
      el.dataset.nodeId = node.id;
      el.style.left = node.position.x + 'px';
      el.style.top = node.position.y + 'px';
      if (isSelected) el.style.transform = 'scale(1.05)';
      const inner = document.createElement('div');
      inner.className = 'dag-node-inner';
      const boxShadow = isSelected ? `0 0 60px 30px rgba(${vibrantRgb}, 0.35), 0 0 40px 20px rgba(${vibrantRgb}, 0.25), 0 0 20px 10px rgba(${vibrantRgb}, 0.4), inset 0 0 30px 8px rgba(${vibrantRgb}, 0.3)` : `0px 2px 20px 0px rgba(${vibrantRgb}, 0.8) inset`;
      inner.style.background = `rgba(${vibrantRgb}, ${isSelected ? 0.2 : 0.15})`;
      inner.style.border = `1px solid ${isSelected ? color.vibrant : `rgba(${vibrantRgb}, 0.3)`}`;
      inner.style.boxShadow = boxShadow;
      inner.appendChild(Object.assign(document.createElement('div'), { className: 'dag-node-icon', textContent: node.icon }));
      inner.appendChild(Object.assign(document.createElement('div'), { className: 'dag-node-label', textContent: node.name }));
      inner.appendChild(Object.assign(document.createElement('div'), { className: 'dag-handle input' }));
      inner.appendChild(Object.assign(document.createElement('div'), { className: 'dag-handle output' }));
      el.appendChild(inner);
      if (isSelected) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'dag-delete-btn';
        deleteBtn.textContent = '\u2715';
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteNode(node.id); selectNode(null); syncWorkflow(); render(); };
        el.appendChild(deleteBtn);
      }
      el.onclick = (e) => { e.stopPropagation(); selectNode(node.id); render(); };
      el.onmousedown = (e) => {
        if (e.button !== 0) return;
        const canvasRect = document.getElementById('dag-canvas').getBoundingClientRect();
        dragState = { nodeId: node.id, offset: { x: e.clientX - canvasRect.left - node.position.x, y: e.clientY - canvasRect.top - node.position.y } };
      };
      nodesContainer.appendChild(el);
    });
    return nodesContainer;
  }

  function render() {
    renderCount++;
    const bannerHtml = bannerText ? `<div style="${bannerStyle}">${bannerText}</div>` : '';
    const html = `<div class="dag-container">
      <div class="dag-top-bar">
        <div class="dag-bar-title">SeqOS Workflow Builder</div>
        <div style="margin-left: auto; display: flex; gap: 8px;">
          <button class="dag-bar-button" id="btn-debug">Debug</button>
          <button class="dag-bar-button" id="btn-run" style="background: rgba(102,126,234,0.2); color: #667eea;">Run</button>
          <button class="dag-bar-button" id="btn-add-node">Add Node</button>
        </div>
      </div>
      ${bannerHtml}
      <div class="dag-main">
        <div id="dag-canvas" class="dag-canvas"></div>
        <div class="dag-sidebar">${renderSidebar(activeTab, nodeEditorPanel)}</div>
      </div>
    </div>`;
    root.innerHTML = html;
    const canvas = document.getElementById('dag-canvas');
    canvas.appendChild(renderConnections());
    canvas.appendChild(renderNodes());
    attachNodeEditorListeners(root.querySelector('.dag-sidebar-content'));
    document.getElementById('btn-debug').onclick = () => console.log('Debug:', window.__debug);
    document.getElementById('btn-run').onclick = () => doRun().catch(err => showBanner(`Failed: ${err.message}`, 'background: rgba(229,9,20,0.15); color: #e50914; padding: 8px 16px; font-size: 13px;', true));
    document.getElementById('btn-add-node').onclick = () => { addNode({ name: `Node ${getNodes().length + 1}`, icon: '\ud83d\udce6', type: 'action', position: { x: 280 + getNodes().length * 60, y: 320 } }); syncWorkflow(); render(); };
    const btnTrigger = document.getElementById('btn-trigger');
    const btnAction = document.getElementById('btn-action');
    const btnDecision = document.getElementById('btn-decision');
    if (btnTrigger) btnTrigger.onclick = () => { addNode({ name: 'Trigger', icon: '\u25b6\ufe0f', type: 'trigger', position: { x: 280 + Math.random() * 400, y: 200 + Math.random() * 300 }, config: { triggerType: 'http' } }); syncWorkflow(); render(); };
    if (btnAction) btnAction.onclick = () => { addNode({ name: 'Action', icon: '\u2699\ufe0f', type: 'action', position: { x: 280 + Math.random() * 400, y: 200 + Math.random() * 300 } }); syncWorkflow(); render(); };
    if (btnDecision) btnDecision.onclick = () => { addNode({ name: 'Decision', icon: '\ud83d\udd00', type: 'action', position: { x: 280 + Math.random() * 400, y: 200 + Math.random() * 300 } }); syncWorkflow(); render(); };
    const tabNodes = document.getElementById('tab-nodes');
    const tabEdit = document.getElementById('tab-edit');
    if (tabNodes) tabNodes.onclick = () => { activeTab = 'nodes'; render(); };
    if (tabEdit) tabEdit.onclick = () => { activeTab = 'edit'; render(); };
    window.__debug.workflow = { getNodes, getConnections, getSelectedNodeId };
    window.__debug.ui = { get activeTab() { return activeTab; }, get renderCount() { return renderCount; } };
  }

  document.addEventListener('click', (e) => {
    const canvas = document.getElementById('dag-canvas');
    if (canvas && (e.target === canvas || e.target.tagName === 'svg' || e.target.tagName === 'line')) { selectNode(null); render(); }
  });
  document.addEventListener('mousemove', (e) => {
    if (dragState.nodeId) {
      const canvas = document.getElementById('dag-canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      updateNode(dragState.nodeId, { position: { x: Math.max(0, e.clientX - rect.left - dragState.offset.x), y: Math.max(0, e.clientY - rect.top - dragState.offset.y) } });
      const now = Date.now();
      if (now - lastRenderTime > 33) { render(); lastRenderTime = now; }
    }
  });
  document.addEventListener('mouseup', () => { if (dragState.nodeId) { dragState = { nodeId: null, offset: { x: 0, y: 0 } }; syncWorkflow(); } });
  document.addEventListener('keydown', (e) => {
    const selected = getSelectedNodeId();
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { deleteNode(selected); selectNode(null); syncWorkflow(); render(); }
    }
  });

  try {
    const workflows = await listWorkflows();
    connectionStatus = 'connected';
    const loaded = await Promise.all(workflows.map(w => getWorkflow(w.id)));
    const valid = loaded.find(wf => wf.nodes && wf.nodes.length > 0);
    if (valid) {
      currentWorkflowId = valid.id;
      createWorkflow(valid.id, valid.name);
      valid.nodes.forEach(n => addNode(n));
      valid.connections.forEach(c => addConnection(c.from, c.to));
    } else {
      currentWorkflowId = 'demo-' + Date.now();
      createWorkflow(currentWorkflowId, 'SeqOS Workflow');
      addNode({ id: 'start', name: 'Start', icon: '\u25b6\ufe0f', type: 'trigger', position: { x: 280, y: 320 }, config: { triggerType: 'http', httpMethod: 'POST', httpPath: '/start' } });
      addNode({ id: 'process', name: 'Process', icon: '\u2699\ufe0f', type: 'action', position: { x: 550, y: 320 }, config: { description: 'Process data' } });
      addNode({ id: 'end', name: 'End', icon: '\u2713', type: 'action', position: { x: 820, y: 320 }, config: { description: 'Complete workflow' } });
      addConnection('start', 'process');
      addConnection('process', 'end');
      await syncWorkflow();
    }
  } catch (err) {
    connectionStatus = 'error: ' + err.message;
    currentWorkflowId = 'demo';
    createWorkflow('demo', 'SeqOS Workflow');
    addNode({ id: 'start', name: 'Start', icon: '\u25b6\ufe0f', type: 'trigger', position: { x: 280, y: 320 }, config: { triggerType: 'http', httpMethod: 'POST', httpPath: '/start' } });
    addNode({ id: 'process', name: 'Process', icon: '\u2699\ufe0f', type: 'action', position: { x: 550, y: 320 }, config: { description: 'Process data' } });
    addNode({ id: 'end', name: 'End', icon: '\u2713', type: 'action', position: { x: 820, y: 320 }, config: { description: 'Complete workflow' } });
    addConnection('start', 'process');
    addConnection('process', 'end');
  }

  globalThis.workflow = { getNodes, getConnections, addNode, selectNode, updateNode, deleteNode };
  render();
  console.log('\u2713 SeqOS Workflow Builder loaded');
}
