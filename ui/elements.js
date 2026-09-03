import { render as renderTemplate } from './templates.js';
import { getPlugin, listPlugins, registerPlugin } from './plugin-registry.js';

const reactiveProps = new WeakMap();

export function reactive(target, propertyKey) {
  const props = reactiveProps.get(target.constructor) || new Set();
  props.add(propertyKey);
  reactiveProps.set(target.constructor, props);
}

export class SeqElement extends HTMLElement {
  static observedAttributes = ['data-props'];

  constructor() {
    super();
    this._data = {};
    this._connected = false;
    this._renderScheduled = false;
    this._shadowRoot = null;
    this._cleanupFns = [];
    this._initReactiveProps();
  }

  get template() { return ''; }
  get useShadow() { return false; }
  get data() { return this._data; }
  set data(value) { this._data = value; this._scheduleRender(); }

  _initReactiveProps() {
    const props = reactiveProps.get(this.constructor);
    if (!props) return;
    for (const prop of props) {
      let value = this[prop];
      Object.defineProperty(this, prop, {
        get: () => value,
        set: (newVal) => {
          if (value !== newVal) { value = newVal; this._data[prop] = newVal; this._scheduleRender(); }
        },
        enumerable: true,
        configurable: true
      });
      if (value !== undefined) this._data[prop] = value;
    }
  }

  connectedCallback() {
    this._connected = true;
    this._parseAttributes();
    if (this.useShadow && !this._shadowRoot) this._shadowRoot = this.attachShadow({ mode: 'open' });
    this.render();
    this.onConnect?.();
  }

  disconnectedCallback() {
    this._connected = false;
    this._cleanup();
    this.onDisconnect?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this._parseAttributes();
    this._scheduleRender();
  }

  _parseAttributes() {
    const propsAttr = this.getAttribute('data-props');
    if (propsAttr) {
      try { Object.assign(this._data, JSON.parse(propsAttr)); }
      catch (e) { console.error('SeqElement props parse error:', e); }
    }
    for (const attr of this.attributes) {
      if (attr.name !== 'data-props' && attr.name !== 'data-template') {
        this._data[attr.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = attr.value;
      }
    }
  }

  _scheduleRender() {
    if (this._renderScheduled || !this._connected) return;
    this._renderScheduled = true;
    queueMicrotask(() => { this._renderScheduled = false; if (this._connected) this.render(); });
  }

  render() {
    if (!this.template) return;
    this.setAttribute('data-template', this.template);
    const html = renderTemplate(this.template, this._data);
    (this._shadowRoot || this).innerHTML = html;
    this._attachEventListeners();
  }

  _attachEventListeners() {
    (this._shadowRoot || this).querySelectorAll('[data-on]').forEach(el => {
      for (const handler of el.dataset.on.split(';')) {
        const [event, method] = handler.split(':').map(s => s.trim());
        if (event && method && typeof this[method] === 'function') {
          const fn = (e) => this[method](e);
          el.addEventListener(event, fn);
          this._cleanupFns.push(() => el.removeEventListener(event, fn));
        }
      }
    });
  }

  _cleanup() {
    for (const fn of this._cleanupFns) { try { fn(); } catch {} }
    this._cleanupFns = [];
  }

  updateData(newData) { Object.assign(this._data, newData); this._scheduleRender(); }
  $(selector) { return (this._shadowRoot || this).querySelector(selector); }
  $$(selector) { return (this._shadowRoot || this).querySelectorAll(selector); }
  onCleanup(fn) { this._cleanupFns.push(fn); }

  emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true, detail }));
  }
}

export function defineElement(tagName, ElementClass) {
  if (customElements.get(tagName)) return customElements.get(tagName);
  customElements.define(tagName, ElementClass);
  return ElementClass;
}

export function createElement(tagName, props = {}, children = []) {
  const el = document.createElement(tagName);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'data' && typeof value === 'object') el.setAttribute('data-props', JSON.stringify(value));
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  }
  return el;
}

const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function html(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const value = values[i] ?? '';
    const escaped = typeof value === 'string' ? value.replace(/[&<>"']/g, c => escapeMap[c]) : value;
    return acc + str + escaped;
  }, '');
}

export function createPluginElement(pluginName) {
  const plugin = getPlugin(pluginName);

  class PluginElement extends SeqElement {
    get template() { return plugin.template; }
    static observedAttributes = [...(plugin.observedAttributes || []), 'data-props'];

    constructor() {
      super();
      Object.assign(this._data, plugin.defaults);
      for (const [event, handler] of Object.entries(plugin.handlers)) {
        const boundHandler = handler.bind(this);
        this.addEventListener(event, boundHandler);
        this.onCleanup(() => this.removeEventListener(event, boundHandler));
      }
    }

    getPluginConfig() {
      return { ...plugin.config };
    }
  }

  const elementName = `seq-${pluginName.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
  return defineElement(elementName, PluginElement);
}

globalThis.createPluginElement = createPluginElement;
globalThis.registerPlugin = registerPlugin;
globalThis.listPlugins = listPlugins;
globalThis.getPlugin = getPlugin;
