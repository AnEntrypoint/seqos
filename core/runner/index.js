import vm from 'vm';
import { SuspensionError } from './errors.js';
import { SAFE_GLOBALS, createSandbox, transformCode } from './sandbox.js';
import { injectSuspensionHooks } from './hooks.js';
import { captureState, restoreState, deserializeState } from '../state.js';
import { createStackFrame, updateFrameState, setFrameWaiting } from '../db.js';
import { getConfig } from '../config.js';

function createRunner(stackFrameId, taskRunId) {
  const sandbox = createSandbox(stackFrameId, taskRunId || stackFrameId);
  const context = vm.createContext(sandbox);
  let savedState = null;
  let executionCount = 0;

  const runner = {
    stackFrameId,
    sandbox,
    context,

    async execute(code, inputContext = {}) {
      executionCount++;
      for (const [key, value] of Object.entries(inputContext)) {
        sandbox[key] = value;
      }
      injectSuspensionHooks(sandbox, runner);
      if (savedState) {
        restoreState(sandbox, savedState);
        savedState = null;
      }
      try {
        const transformedCode = transformCode(code);
        const wrappedCode = `(async () => { ${transformedCode}; })()`;
        const script = new vm.Script(wrappedCode, { filename: `frame-${stackFrameId}.js` });
        const result = await script.runInContext(context, { timeout: getConfig('execution.timeout') });
        return { status: 'completed', result, executionCount };
      } catch (error) {
        if (error instanceof SuspensionError) {
          savedState = captureState(sandbox);
          await updateFrameState(stackFrameId, savedState, 'suspended');
          const childId = error.childFrameId;
          await createStackFrame(childId, sandbox._taskRunId, executionCount, {});
          await setFrameWaiting(stackFrameId, childId);
          return {
            status: 'suspended',
            suspensionError: error,
            childFrameId: childId,
            savedState,
            executionCount
          };
        }
        return { status: 'error', error, executionCount };
      }
    },

    async resume(result) {
      if (!savedState) {
        savedState = captureState(sandbox);
      }
      sandbox._resume_payload = result;
      sandbox._resume_consumed = false;
      sandbox._suspended = false;
      sandbox._suspensionData = null;
      restoreState(sandbox, savedState, result);
      return { status: 'ready', hasState: !!savedState };
    },

    async executeWithResume(code, inputContext = {}) {
      for (const [key, value] of Object.entries(inputContext)) {
        sandbox[key] = value;
      }
      injectSuspensionHooks(sandbox, runner);
      if (savedState) {
        restoreState(sandbox, savedState);
      }
      try {
        const transformedCode = transformCode(code);
        const wrappedCode = `(async () => { ${transformedCode}; })()`;
        const script = new vm.Script(wrappedCode, { filename: `frame-${stackFrameId}.js` });
        const result = await script.runInContext(context, { timeout: getConfig('execution.timeout') });
        return { status: 'completed', result, executionCount: ++executionCount };
      } catch (error) {
        if (error instanceof SuspensionError) {
          savedState = captureState(sandbox);
          return {
            status: 'suspended',
            suspensionError: error,
            childFrameId: error.childFrameId,
            savedState,
            executionCount: ++executionCount
          };
        }
        return { status: 'error', error, executionCount: ++executionCount };
      }
    },

    getState() {
      return captureState(sandbox);
    },

    setState(state) {
      savedState = typeof state === 'string' ? deserializeState(state) : state;
      restoreState(sandbox, savedState);
    },

    isSuspended() {
      return sandbox._suspended;
    },

    getSuspensionData() {
      return sandbox._suspensionData;
    },

    reset() {
      savedState = null;
      sandbox._suspended = false;
      sandbox._suspensionData = null;
      sandbox._resume_payload = undefined;
      const keys = Object.keys(sandbox);
      for (const key of keys) {
        if (!SAFE_GLOBALS.hasOwnProperty(key) && !key.startsWith('_') &&
          key !== 'console' && key !== 'crypto' &&
          key !== '__callLibrary__' && key !== '__executeDag__') {
          delete sandbox[key];
        }
      }
    }
  };

  injectSuspensionHooks(sandbox, runner);
  return runner;
}

function createRunnerFromState(stackFrameId, serializedState, taskRunId) {
  const runner = createRunner(stackFrameId, taskRunId);
  if (serializedState) {
    runner.setState(serializedState);
  }
  return runner;
}

export {
  SuspensionError,
  createRunner,
  createRunnerFromState,
  SAFE_GLOBALS
};