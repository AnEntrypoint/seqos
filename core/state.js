const SERIALIZABLE_TYPES = ['string', 'number', 'boolean', 'undefined'];
const BUILTIN_GLOBALS = new Set([
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
  'RegExp', 'Promise', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'crypto', 'console', 'module', 'exports', '__callHostTool__', '_hostLog',
  '_taskRunId', '_stackRunId', '_resume_payload', '_stackFrameId', '_suspended',
  '_suspensionData', '_resume_consumed', '__callLibrary__', '__executeDag__', '_getResult',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'Symbol', 'Proxy', 'Reflect', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array',
  'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView',
  'undefined', 'NaN', 'Infinity'
]);

function isSerializable(value, seen = new WeakSet()) {
  if (value === null) return true;
  const type = typeof value;
  if (SERIALIZABLE_TYPES.includes(type)) return true;
  if (type === 'function') return false;
  if (type !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every(v => isSerializable(v, seen));
  if (value instanceof Date) return true;
  if (value instanceof RegExp) return true;
  const ctorName = value.constructor?.name;
  if (ctorName && ctorName !== 'Object') return false;
  return Object.values(value).every(v => isSerializable(v, seen));
}

function serializeValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return { type: 'primitive', value };
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return { type: 'primitive', value };
  }
  if (type === 'function') return { type: 'function', name: value.name || 'anonymous' };
  if (value instanceof Date) return { type: 'date', value: value.toISOString() };
  if (value instanceof RegExp) return { type: 'regexp', source: value.source, flags: value.flags };
  if (value instanceof Error) {
    return { type: 'error', name: value.name, message: value.message, stack: value.stack };
  }
  if (seen.has(value)) return { type: 'circular' };
  seen.add(value);
  if (Array.isArray(value)) {
    return { type: 'array', value: value.map(v => serializeValue(v, seen)) };
  }
  if (type === 'object') {
    const serialized = {};
    for (const [k, v] of Object.entries(value)) {
      serialized[k] = serializeValue(v, seen);
    }
    return { type: 'object', value: serialized };
  }
  return { type: 'unknown' };
}

function deserializeValue(serialized) {
  if (!serialized || typeof serialized !== 'object') return serialized;
  switch (serialized.type) {
    case 'primitive': return serialized.value;
    case 'date': return new Date(serialized.value);
    case 'regexp': return new RegExp(serialized.source, serialized.flags);
    case 'error': {
      const err = new Error(serialized.message);
      err.name = serialized.name;
      err.stack = serialized.stack;
      return err;
    }
    case 'array': return serialized.value.map(v => deserializeValue(v));
    case 'object': {
      const obj = {};
      for (const [k, v] of Object.entries(serialized.value)) {
        obj[k] = deserializeValue(v);
      }
      return obj;
    }
    case 'function': return undefined;
    case 'circular': return undefined;
    default: return undefined;
  }
}

function captureState(sandbox) {
  const state = {
    version: 1,
    timestamp: Date.now(),
    variables: {},
    metadata: {
      taskRunId: sandbox._taskRunId,
      stackRunId: sandbox._stackRunId
    },
    pendingResult: null,
    resumePayload: sandbox._resume_payload || null
  };
  for (const [key, value] of Object.entries(sandbox)) {
    if (BUILTIN_GLOBALS.has(key)) continue;
    if (key.startsWith('_')) continue;
    if (isSerializable(value)) {
      state.variables[key] = serializeValue(value);
    }
  }
  return state;
}

function serializeState(state) {
  return JSON.stringify(state);
}

function deserializeState(json) {
  if (!json) return null;
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  return {
    version: parsed.version || 1,
    timestamp: parsed.timestamp || Date.now(),
    variables: parsed.variables || {},
    metadata: parsed.metadata || {},
    pendingResult: parsed.pendingResult || null,
    resumePayload: parsed.resumePayload || null
  };
}

function restoreState(sandbox, state, result) {
  if (!state) return sandbox;
  for (const [key, serialized] of Object.entries(state.variables || {})) {
    sandbox[key] = deserializeValue(serialized);
  }
  if (state.metadata) {
    if (state.metadata.taskRunId) sandbox._taskRunId = state.metadata.taskRunId;
    if (state.metadata.stackRunId) sandbox._stackRunId = state.metadata.stackRunId;
  }
  if (result !== undefined) {
    sandbox._resume_payload = result;
  } else if (state.resumePayload !== null) {
    sandbox._resume_payload = state.resumePayload;
  }
  return sandbox;
}

function createEmptyState() {
  return {
    version: 1,
    timestamp: Date.now(),
    variables: {},
    metadata: {},
    pendingResult: null,
    resumePayload: null
  };
}

function mergeStates(base, overlay) {
  return {
    version: overlay.version || base.version || 1,
    timestamp: Date.now(),
    variables: { ...base.variables, ...overlay.variables },
    metadata: { ...base.metadata, ...overlay.metadata },
    pendingResult: overlay.pendingResult ?? base.pendingResult,
    resumePayload: overlay.resumePayload ?? base.resumePayload
  };
}

function extractVariables(state) {
  const vars = {};
  for (const [key, serialized] of Object.entries(state.variables || {})) {
    vars[key] = deserializeValue(serialized);
  }
  return vars;
}

function injectResult(state, result) {
  return {
    ...state,
    resumePayload: result,
    pendingResult: null
  };
}

export {
  captureState,
  serializeState,
  deserializeState,
  restoreState,
  createEmptyState,
  mergeStates,
  extractVariables,
  injectResult,
  isSerializable,
  serializeValue,
  deserializeValue
};
