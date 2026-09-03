import { getNodes } from '/ui/workflow.js';

export function renderNodeName(node) {
  return `
    <div style="border-bottom: 1px solid rgba(102, 126, 234, 0.1); padding: 16px; background: rgba(102, 126, 234, 0.05);">
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #667eea; margin-bottom: 8px; letter-spacing: 0.5px;">NODE NAME</div>
      <input
        type="text"
        value="${escapeHtml(node.name)}"
        placeholder="Node name..."
        class="node-name-input"
        data-node-id="${node.id}"
        style="width: 100%; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px; box-sizing: border-box; font-family: inherit;"
      />
      <div style="font-size: 11px; color: #999; margin-top: 8px;">Node Type: ${node.type}</div>
    </div>
  `;
}

export function renderTriggerConfig(node) {
  const config = node.config || {};
  const triggerType = config.triggerType || 'http';

  return `
    <div style="space-y: 12px;">
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">Trigger Type</label>
        <select class="node-config-select" data-node-id="${node.id}" data-field="triggerType" style="width: 100%; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px;">
          <option value="http" ${triggerType === 'http' ? 'selected' : ''}>HTTP</option>
          <option value="schedule" ${triggerType === 'schedule' ? 'selected' : ''}>Schedule</option>
          <option value="webhook" ${triggerType === 'webhook' ? 'selected' : ''}>Webhook</option>
        </select>
      </div>
      ${triggerType === 'http' ? renderHttpConfig(node, config) : ''}
      ${triggerType === 'schedule' ? renderScheduleConfig(node, config) : ''}
      ${triggerType === 'webhook' ? renderWebhookConfig(node, config) : ''}
    </div>
  `;
}

function renderHttpConfig(node, config) {
  return `
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">HTTP Method</label>
      <select class="node-config-select" data-node-id="${node.id}" data-field="httpMethod" style="width: 100%; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px;">
        <option value="GET" ${config.httpMethod === 'GET' ? 'selected' : ''}>GET</option>
        <option value="POST" ${config.httpMethod === 'POST' ? 'selected' : ''}>POST</option>
        <option value="PUT" ${config.httpMethod === 'PUT' ? 'selected' : ''}>PUT</option>
        <option value="DELETE" ${config.httpMethod === 'DELETE' ? 'selected' : ''}>DELETE</option>
      </select>
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">Path</label>
      <input type="text" value="${escapeHtml(config.httpPath || '')}" placeholder="/webhook" class="node-config-input" data-node-id="${node.id}" data-field="httpPath" style="width: 100%; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px; box-sizing: border-box; font-family: inherit;" />
    </div>
  `;
}

function renderScheduleConfig(node, config) {
  return `
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">Cron Expression</label>
      <input type="text" value="${escapeHtml(config.cronExpression || '')}" placeholder="0 0 * * *" class="node-config-input" data-node-id="${node.id}" data-field="cronExpression" style="width: 100%; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px; box-sizing: border-box; font-family: inherit;" />
      <div style="font-size: 10px; color: #999; margin-top: 4px;">e.g. "0 0 * * *" for daily at midnight</div>
    </div>
  `;
}

function renderWebhookConfig(node, config) {
  return `
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">Secret</label>
      <input type="password" value="${escapeHtml(config.webhookSecret || '')}" placeholder="Secret key" class="node-config-input" data-node-id="${node.id}" data-field="webhookSecret" style="width: 100%; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px; box-sizing: border-box; font-family: inherit;" />
    </div>
  `;
}

export function renderActionConfig(node) {
  const config = node.config || {};
  return `
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">Description</label>
      <textarea placeholder="What does this action do?" class="node-config-textarea" data-node-id="${node.id}" data-field="description" style="width: 100%; height: 80px; padding: 8px 12px; background: rgba(102, 126, 234, 0.08); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #f2f2f2; font-size: 13px; box-sizing: border-box; font-family: monospace; resize: vertical;">${escapeHtml(config.description || '')}</textarea>
    </div>
  `;
}

export function renderInputOutputs(node) {
  const config = node.config || {};
  const inputs = config.inputs || [];
  const outputs = config.outputs || [];

  return `
    <div style="flex: 1; overflow-y: auto; padding: 16px;">
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <label style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #667eea; letter-spacing: 0.5px;">Input Parameters</label>
          <button class="param-add-btn" data-node-id="${node.id}" data-type="input" style="padding: 4px 8px; background: rgba(102, 126, 234, 0.1); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 4px; color: #667eea; font-size: 11px; cursor: pointer; transition: all 0.2s; font-weight: 600;">+ Add</button>
        </div>
        <div>${inputs.length > 0 ? inputs.map((inp, i) => renderParamItem(node.id, 'input', i, inp)).join('') : '<div style="font-size: 11px; color: #999; padding: 8px;">No inputs</div>'}</div>
      </div>
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <label style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #667eea; letter-spacing: 0.5px;">Output Parameters</label>
          <button class="param-add-btn" data-node-id="${node.id}" data-type="output" style="padding: 4px 8px; background: rgba(102, 126, 234, 0.1); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 4px; color: #667eea; font-size: 11px; cursor: pointer; transition: all 0.2s; font-weight: 600;">+ Add</button>
        </div>
        <div>${outputs.length > 0 ? outputs.map((out, i) => renderParamItem(node.id, 'output', i, out)).join('') : '<div style="font-size: 11px; color: #999; padding: 8px;">No outputs</div>'}</div>
      </div>
    </div>
  `;
}

function renderParamItem(nodeId, type, index, param) {
  return `
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(102, 126, 234, 0.05); border: 1px solid rgba(102, 126, 234, 0.1); border-radius: 6px; font-size: 12px; margin-bottom: 4px;">
      <span style="color: #999; font-weight: 600;">${escapeHtml(param.name)}</span>
      <span style="color: #667eea; font-size: 11px; margin-left: auto;">${param.type}</span>
      <button class="param-remove-btn" data-node-id="${nodeId}" data-type="${type}" data-index="${index}" style="padding: 2px 6px; background: rgba(229, 9, 20, 0.1); border: none; border-radius: 3px; color: #e50914; cursor: pointer; font-size: 11px; font-weight: 600;">Remove</button>
    </div>
  `;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
