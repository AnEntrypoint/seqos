export class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.listeners = new Set();
  }

  register(name, config) {
    if (!name || typeof name !== 'string') throw new Error('Plugin name required');
    if (!config.template) throw new Error(`Plugin '${name}' missing template`);

    this.plugins.set(name, {
      name,
      template: config.template,
      observedAttributes: config.observedAttributes || [],
      handlers: config.handlers || {},
      defaults: config.defaults || {},
      config: config.config || {},
      timestamp: Date.now()
    });
    this.notifyListeners();
  }

  get(name) {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin '${name}' not found`);
    }
    return this.plugins.get(name);
  }

  has(name) {
    return this.plugins.has(name);
  }

  list() {
    return Array.from(this.plugins.values());
  }

  unregister(name) {
    const removed = this.plugins.delete(name);
    if (removed) this.notifyListeners();
    return removed;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notifyListeners() {
    this.listeners.forEach(fn => {
      try { fn(this); } catch (e) { console.error('Plugin listener error:', e); }
    });
  }

  clear() {
    this.plugins.clear();
    this.notifyListeners();
  }
}

export const registry = new PluginRegistry();

export function registerPlugin(name, config) {
  registry.register(name, config);
}

export function getPlugin(name) {
  return registry.get(name);
}

export function hasPlugin(name) {
  return registry.has(name);
}

export function listPlugins() {
  return registry.list();
}

export function unregisterPlugin(name) {
  return registry.unregister(name);
}

export function onPluginChange(fn) {
  return registry.onChange(fn);
}
