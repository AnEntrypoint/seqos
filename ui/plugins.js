import { registerPlugin } from './plugin-registry.js';

registerPlugin('stat-card', {
  template: 'stat-card',
  observedAttributes: ['title', 'value', 'trend', 'format'],
  defaults: {
    title: 'Stat',
    value: '0',
    trend: 'neutral',
    format: 'currency'
  },
  config: {
    trendOptions: ['up', 'down', 'neutral'],
    formatOptions: ['currency', 'percentage', 'number']
  },
  handlers: {
    click(e) {
      if (e.target.closest('[data-action="card-click"]')) {
        this.emit('card-clicked', {
          title: this._data.title,
          value: this._data.value,
          trend: this._data.trend
        });
      }
    }
  }
});

registerPlugin('data-table', {
  template: 'data-table',
  observedAttributes: ['columns', 'rows', 'sortable', 'filterable'],
  defaults: {
    columns: [],
    rows: [],
    sortable: true,
    filterable: true
  },
  config: {
    pageable: true,
    pageSize: 10,
    selectMode: 'checkbox',
    maxHeight: '600px'
  },
  handlers: {
    'click .row'(e) {
      const row = e.target.closest('[data-row-id]');
      if (row) {
        const rowId = row.dataset.rowId;
        this.emit('row-selected', { rowId, row: this._data.rows.find(r => r.id === rowId) });
      }
    }
  }
});

registerPlugin('form', {
  template: 'form-builder',
  observedAttributes: ['fields', 'submitLabel', 'cancelLabel'],
  defaults: {
    fields: [],
    submitLabel: 'Submit',
    cancelLabel: 'Cancel'
  },
  config: {
    fieldTypes: ['text', 'email', 'password', 'select', 'checkbox', 'textarea', 'number'],
    validation: true,
    asyncSubmit: true,
    showErrors: true
  },
  handlers: {
    submit(e) {
      e.preventDefault();
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      this.emit('form-submit', { data, form });
    },
    'click [data-action="cancel"]'(e) {
      e.preventDefault();
      this.emit('form-cancel');
    }
  }
});

registerPlugin('chart', {
  template: 'chart-renderer',
  observedAttributes: ['type', 'data', 'options'],
  defaults: {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {}
  },
  config: {
    chartTypes: ['bar', 'line', 'pie', 'scatter', 'area', 'doughnut'],
    responsive: true,
    legend: true,
    grid: true,
    animation: true
  },
  handlers: {
    'click .chart-element'(e) {
      const element = e.target.closest('[data-element-id]');
      if (element) {
        this.emit('chart-element-clicked', {
          elementId: element.dataset.elementId,
          type: this._data.type
        });
      }
    }
  }
});

registerPlugin('workflow-canvas', {
  template: 'workflow-canvas',
  observedAttributes: ['nodes', 'edges', 'editable'],
  defaults: {
    nodes: [],
    edges: [],
    editable: true
  },
  config: {
    snapGrid: 10,
    autoLayout: false,
    connectionMode: 'manual',
    nodeTypes: ['action', 'decision', 'start', 'end', 'subprocess'],
    minZoom: 0.5,
    maxZoom: 2.0
  },
  handlers: {
    'click [data-node-id]'(e) {
      const node = e.target.closest('[data-node-id]');
      if (node) {
        const nodeId = node.dataset.nodeId;
        const nodeData = this._data.nodes.find(n => n.id === nodeId);
        this.emit('node-selected', { nodeId, nodeData });
      }
    },
    'dragend [data-node-id]'(e) {
      const node = e.target.closest('[data-node-id]');
      if (node && this._data.editable) {
        const nodeId = node.dataset.nodeId;
        this.emit('node-moved', {
          nodeId,
          x: node.offsetLeft,
          y: node.offsetTop
        });
      }
    }
  }
});
