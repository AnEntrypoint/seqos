import crypto from 'crypto';
import { SuspensionError } from './errors.js';

export function injectSuspensionHooks(sandbox, runner) {
  sandbox.__callLibrary__ = function (serviceName, chain) {
    if (sandbox._resume_payload !== undefined && !sandbox._resume_consumed) {
      sandbox._resume_consumed = true;
      const result = sandbox._resume_payload;
      sandbox._resume_payload = undefined;
      return result;
    }
    const childFrameId = crypto.randomUUID();
    sandbox._suspended = true;
    sandbox._suspensionData = { type: 'library', childFrameId, serviceName, chain };
    throw new SuspensionError(childFrameId, serviceName, chain, null, null);
  };
  sandbox.__executeDag__ = function (workflowId, input) {
    if (sandbox._resume_payload !== undefined && !sandbox._resume_consumed) {
      sandbox._resume_consumed = true;
      const result = sandbox._resume_payload;
      sandbox._resume_payload = undefined;
      return result;
    }
    const childFrameId = crypto.randomUUID();
    sandbox._suspended = true;
    sandbox._suspensionData = { type: 'dag', childFrameId, workflowId, input };
    throw new SuspensionError(childFrameId, null, null, workflowId, input);
  };
  sandbox._getResult = function () {
    return sandbox._resume_payload;
  };
}