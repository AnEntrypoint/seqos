export const pluginTemplates = {
  'stat-card': `<div class="stat-card \${trend}">
    <div class="stat-header">
      <h3 class="stat-title">\${title}</h3>
      {{#if trend}}
        <span class="stat-trend \${trend}">\${trend}</span>
      {{/if}}
    </div>
    <div class="stat-body">
      <p class="stat-value">\${value}</p>
      {{#if subtitle}}
        <p class="stat-subtitle">\${subtitle}</p>
      {{/if}}
    </div>
  </div>`,
  'data-table': `<div class="data-table {{#if filterable}}filterable{{/if}}">
    {{#if filterable}}
      <div class="table-filter">
        <input type="search" placeholder="Filter..." class="filter-input" />
      </div>
    {{/if}}
    <table class="table">
      <thead>
        <tr>
          {{#each columns as col}}
            <th {{#if sortable}}class="sortable"{{/if}}>\${col}</th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each rows as row}}
          <tr class="row" data-id="\${row.id}">
            {{#each columns as col}}
              <td>\${row[col]}</td>
            {{/each}}
          </tr>
        {{/each}}
      </tbody>
    </table>
  </div>`,
  'form-builder': `<form class="dynamic-form">
    {{#each fields as field}}
      <div class="form-group">
        <label class="form-label">\${field.label}</label>
        {{#if field.type}}
          <input type="text" name="\${field.name}" placeholder="\${field.placeholder}" />
        {{/if}}
        {{#if field.options}}
          <select name="\${field.name}">
            {{#each field.options as opt}}
              <option value="\${opt.value}">\${opt.label}</option>
            {{/each}}
          </select>
        {{/if}}
        {{#if field.isTextarea}}
          <textarea name="\${field.name}" placeholder="\${field.placeholder}"></textarea>
        {{/if}}
        {{#if field.isCheckbox}}
          <input type="checkbox" name="\${field.name}" />
        {{/if}}
      </div>
    {{/each}}
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">\${submitLabel}</button>
      {{#if cancelLabel}}
        <button type="button" class="btn btn-secondary">\${cancelLabel}</button>
      {{/if}}
    </div>
  </form>`,
  'chart-renderer': `<div class="chart-container">
    <div class="chart" data-type="\${type}" data-chart-id="\${chartId}"></div>
    {{#if title}}
      <h3 class="chart-title">\${title}</h3>
    {{/if}}
    {{#if legend}}
      <div class="chart-legend">
        {{#each data.datasets as dataset}}
          <div class="legend-item">
            <span class="legend-color" style="background: \${dataset.backgroundColor}"></span>
            <span class="legend-label">\${dataset.label}</span>
          </div>
        {{/each}}
      </div>
    {{/if}}
  </div>`,
  'workflow-canvas': `<div class="workflow-editor {{#if editable}}editable{{/if}}">
    <div class="canvas-toolbar">
      <button class="btn-add-node">+ Add Node</button>
      <button class="btn-layout">Auto Layout</button>
      <button class="btn-export">Export</button>
    </div>
    <svg class="canvas-svg"></svg>
    <div class="canvas">
      {{#each nodes as node}}
        <div class="node" data-id="\${node.id}" style="left: \${node.position.x}px; top: \${node.position.y}px;">
          <div class="node-header" style="background: \${node.color}">
            <span class="node-type">\${node.type}</span>
          </div>
          <div class="node-body">
            <p class="node-label">\${node.label}</p>
          </div>
          {{#if editable}}
            <div class="node-handles">
              <div class="handle handle-input"></div>
              <div class="handle handle-output"></div>
            </div>
          {{/if}}
        </div>
      {{/each}}
    </div>
  </div>`
};
