import crypto from 'crypto';

export const SAFE_GLOBALS = {
  Object, Array, String, Number, Boolean, Date, Math, JSON, RegExp,
  Promise, Map, Set, WeakMap, WeakSet,
  parseInt, parseFloat, isNaN, isFinite,
  encodeURI, decodeURI, encodeURIComponent, decodeURIComponent,
  Error, TypeError, RangeError, SyntaxError, ReferenceError,
  Symbol, Proxy, Reflect,
  Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array,
  Float32Array, Float64Array, ArrayBuffer, DataView,
  undefined, NaN, Infinity
};

export const SAFE_GLOBAL_KEYS = new Set(Object.keys(SAFE_GLOBALS));

export function transformCode(code) {
  let transformed = code.replace(/\b(const|let)\s+(\w+)\s*=/g, '$2 =');
  const statements = transformed.split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length === 0) return transformed;
  const last = statements[statements.length - 1];
  if (!/^(return|throw|if|for|while|switch|try|function|class)\b/.test(last) &&
    !/^\s*\}/.test(last) && !/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/.test(last)) {
    statements[statements.length - 1] = `return (${last})`;
  } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/.test(last)) {
    const match = last.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
    if (match) statements[statements.length - 1] = `return (${match[1]} = ${match[2]})`;
  }
  return statements.join('; ');
}

export function createSandbox(stackFrameId, taskRunId) {
  const sandbox = { ...SAFE_GLOBALS };
  sandbox._stackFrameId = stackFrameId;
  sandbox._taskRunId = taskRunId;
  sandbox._suspended = false;
  sandbox._suspensionData = null;
  sandbox.console = {
    log: (...args) => console.log(`[${stackFrameId}]`, ...args),
    error: (...args) => console.error(`[${stackFrameId}]`, ...args),
    warn: (...args) => console.warn(`[${stackFrameId}]`, ...args),
    info: (...args) => console.info(`[${stackFrameId}]`, ...args)
  };
  sandbox.crypto = { randomUUID: () => crypto.randomUUID() };
  return sandbox;
}