export const NODE_TYPES = ['trigger', 'action', 'transform', 'condition', 'parallel', 'subworkflow'];
export const NODE_COLORS = ['red', 'green', 'blue', 'purple', 'pink', 'gray', 'cyan', 'orange'];
export const INPUT_TYPES = ['text', 'number', 'select', 'json', 'boolean'];

export const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;