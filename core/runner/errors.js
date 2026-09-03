export class SuspensionError extends Error {
  constructor(childFrameId, serviceName, chain, workflowId, input) {
    super('Execution suspended');
    this.name = 'SuspensionError';
    this.childFrameId = childFrameId;
    this.serviceName = serviceName;
    this.chain = chain;
    this.workflowId = workflowId;
    this.dagInput = input;
    this.type = serviceName ? 'library' : 'dag';
  }
}