function validateChain(chain) {
  const errors = [];
  if (!Array.isArray(chain)) {
    errors.push('Chain must be an array');
    return { valid: false, errors };
  }
  if (chain.length === 0) {
    errors.push('Chain cannot be empty');
    return { valid: false, errors };
  }
  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    if (!step || typeof step !== 'object') {
      errors.push(`Step ${i}: must be an object`);
      continue;
    }
    if (typeof step.property !== 'string' || step.property.length === 0) {
      errors.push(`Step ${i}: property must be a non-empty string`);
    }
    if (step.args !== undefined && !Array.isArray(step.args)) {
      errors.push(`Step ${i}: args must be an array if provided`);
    }
  }
  return { valid: errors.length === 0, errors };
}

async function executeChain(target, chain) {
  const validation = validateChain(chain);
  if (!validation.valid) {
    throw new Error(`Invalid chain: ${validation.errors.join(', ')}`);
  }
  let current = target;
  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const { property, args } = step;
    if (current === null || current === undefined) {
      throw new Error(`Step ${i}: Cannot access property '${property}' on ${current}`);
    }
    const member = current[property];
    if (member === undefined) {
      throw new Error(`Step ${i}: Property '${property}' not found`);
    }
    if (args !== undefined) {
      if (typeof member !== 'function') {
        throw new Error(`Step ${i}: '${property}' is not callable`);
      }
      const result = member.apply(current, args);
      current = result instanceof Promise ? await result : result;
    } else {
      current = typeof member === 'function' ? member.bind(current) : member;
    }
  }
  if (current instanceof Promise) {
    current = await current;
  }
  return current;
}

function createWrapper(library) {
  const wrapper = {
    library,
    async execute(chain) {
      return executeChain(this.library, chain);
    },
    validate(chain) {
      return validateChain(chain);
    },
    async call(chain) {
      return this.execute(chain);
    }
  };
  return wrapper;
}

function chainToString(chain) {
  if (!Array.isArray(chain)) return '[invalid]';
  return chain.map(step => {
    if (!step || typeof step.property !== 'string') return '[invalid step]';
    if (step.args !== undefined) {
      return `${step.property}(${step.args.length} args)`;
    }
    return step.property;
  }).join('.');
}

function buildChain(...steps) {
  return steps.map(step => {
    if (typeof step === 'string') return { property: step };
    if (Array.isArray(step) && step.length >= 1) {
      return { property: step[0], args: step.slice(1) };
    }
    return step;
  });
}

function parseMethodPath(path, finalArgs = []) {
  const parts = path.split('.');
  return parts.map((part, i) => {
    if (i === parts.length - 1 && finalArgs.length > 0) {
      return { property: part, args: finalArgs };
    }
    return { property: part };
  });
}

export {
  createWrapper,
  executeChain,
  validateChain,
  chainToString,
  buildChain,
  parseMethodPath
};
