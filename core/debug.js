const debugState = {
  hooks: new Map(),
  exposed: {}
};

export function expose(name, value) {
  debugState.exposed[name] = value;
  debugState.hooks.set(name, value);
  
  if (typeof globalThis !== 'undefined') {
    globalThis[name] = value;
  }
}

export function getExposed(name) {
  return debugState.exposed[name];
}

export function getAllExposed() {
  return { ...debugState.exposed };
}

export function clearExposed(name) {
  delete debugState.exposed[name];
  debugState.hooks.delete(name);
  if (typeof globalThis !== 'undefined') {
    delete globalThis[name];
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__seqosDebug = debugState;
  globalThis.__seqos = getAllExposed;
}