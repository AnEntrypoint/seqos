class RetryError extends Error {
  constructor(message, retries, originalError) {
    super(message);
    this.name = 'RetryError';
    this.retries = retries;
    this.originalError = originalError;
  }
}

class InterruptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InterruptError';
  }
}

const recoveryState = {
  retryCounts: new Map(),
  checkpoints: new Map(),
  supervisors: new Map()
};

export async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const backoff = options.backoff || 1000;
  const key = options.key || 'default';
  
  let retries = recoveryState.retryCounts.get(key) || 0;
  
  while (retries < maxRetries) {
    try {
      const result = await fn();
      recoveryState.retryCounts.delete(key);
      return result;
    } catch (error) {
      retries++;
      recoveryState.retryCounts.set(key, retries);
      
      if (retries >= maxRetries) {
        throw new RetryError(`Operation failed after ${retries} retries`, retries, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, backoff * retries));
    }
  }
}

export function checkpoint(key, state) {
  recoveryState.checkpoints.set(key, { state, timestamp: Date.now() });
}

export function restore(key) {
  const checkpoint = recoveryState.checkpoints.get(key);
  return checkpoint ? checkpoint.state : null;
}

export function supervise(componentId, component, parentId = null) {
  const supervisor = {
    componentId,
    component,
    parentId,
    restartCount: 0,
    lastRestart: null,
    async restart() {
      this.restartCount++;
      this.lastRestart = Date.now();
      try {
        if (component.restart) {
          await component.restart();
        } else if (component.start) {
          await component.start();
        }
      } catch (error) {
        if (parentId) {
          const parent = recoveryState.supervisors.get(parentId);
          if (parent) await parent.restart();
        }
        throw error;
      }
    }
  };
  recoveryState.supervisors.set(componentId, supervisor);
  return supervisor;
}

export function catchAtBoundary(fn, context = 'unknown') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof InterruptError) {
        throw error;
      }
      console.error(`[${context}] Error caught at boundary:`, error.message);
      console.error(error.stack);
      return { error: error.message, context };
    }
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.__seqosRecovery = recoveryState;
}

export { RetryError, InterruptError };