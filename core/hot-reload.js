const stableState = {
  connections: new Map(),
  handlers: new Map(),
  watchers: new Set()
};

export function registerConnection(id, connection) {
  stableState.connections.set(id, connection);
  if (typeof globalThis !== 'undefined') {
    globalThis.__seqosConnections = stableState.connections;
  }
}

export function unregisterConnection(id) {
  stableState.connections.delete(id);
}

export function swapHandlers(oldHandler, newHandler) {
  const id = `${Date.now()}-${Math.random()}`;
  stableState.handlers.set(id, { old: oldHandler, new: newHandler, swapped: false });
  
  return async () => {
    if (stableState.handlers.get(id)?.swapped) return;
    const handler = stableState.handlers.get(id);
    if (handler) {
      if (handler.old?.drain) await handler.old.drain();
      handler.swapped = true;
      stableState.handlers.set(id, handler);
    }
  };
}

export function watch(path, callback) {
  const watcher = { path, callback, active: true };
  stableState.watchers.add(watcher);
  return () => {
    watcher.active = false;
    stableState.watchers.delete(watcher);
  };
}

export function getStableState() {
  return stableState;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__seqosHotReload = stableState;
}