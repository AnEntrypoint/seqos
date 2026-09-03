import { pluginTemplates } from './plugin-templates.js';

const templates = new Map();
const compiled = new Map();
const listeners = new Set();

const helpers = {
  map: (arr, fn) => arr.map(fn).join(''),
  if: (cond, then, otherwise = '') => cond ? then : otherwise,
  json: (data) => JSON.stringify(data).replace(/"/g, '&quot;'),
  escape: (str) => String(str).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m),
  classes: (...cls) => cls.filter(Boolean).join(' '),
  partial: (name, data) => render(name, data)
};

function findClose(src, start, openTag, closeTag) {
  let depth = 1, pos = start;
  while (depth > 0 && pos < src.length) {
    const nextOpen = src.indexOf(openTag, pos);
    const nextClose = src.indexOf(closeTag, pos);
    if (nextClose === -1) return src.length;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + closeTag.length;
    }
  }
  return src.length;
}

function wrapExpr(expr, locals) {
  const reserved = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'parseInt', 'parseFloat'];
  let result = '', inStr = null, i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) { result += ch; if (ch === inStr && expr[i-1] !== '\\') inStr = null; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; result += ch; i++; continue; }
    const m = expr.slice(i).match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (m) {
      const id = m[1], prev = i > 0 ? expr[i-1] : '';
      result += (prev === '.' || reserved.includes(id) || locals.includes(id)) ? id : `__d.${id}`;
      i += id.length;
    } else { result += ch; i++; }
  }
  return result;
}

function transform(src, locals = [], loopVar = null) {
  let result = '', pos = 0;

  while (pos < src.length) {
    const ifMatch = src.slice(pos).match(/^\{\{#if\s+([^}]+)\}\}/);
    const eachMatch = src.slice(pos).match(/^\{\{#each\s+([^\s]+)\s+as\s+([^\s},]+)(?:\s*,\s*([^\s}]+))?\s*\}\}/);
    const partialMatch = src.slice(pos).match(/^\{\{>\s*([^}]+)\}\}/);
    const exprMatch = src.slice(pos).match(/^\$\{([^}]+)\}/);

    if (ifMatch) {
      const cond = wrapExpr(ifMatch[1].trim(), locals);
      const afterOpen = pos + ifMatch[0].length;
      const closePos = findClose(src, afterOpen, '{{#if', '{{/if}}');
      const inner = src.slice(afterOpen, closePos);

      let thenPart = inner, elsePart = '';
      let depth = 0, elsePos = -1;
      for (let i = 0; i < inner.length; i++) {
        if (inner.slice(i).startsWith('{{#if')) depth++;
        else if (inner.slice(i).startsWith('{{/if}}')) depth--;
        else if (depth === 0 && inner.slice(i).startsWith('{{else}}')) { elsePos = i; break; }
      }
      if (elsePos !== -1) {
        thenPart = inner.slice(0, elsePos);
        elsePart = inner.slice(elsePos + 8);
      }

      result += `\${(${cond}) ? \`${transform(thenPart, locals, loopVar)}\` : \`${transform(elsePart, locals, loopVar)}\`}`;
      pos = closePos + 7;
    } else if (eachMatch) {
      const [full, arr, item, idx] = eachMatch;
      const afterOpen = pos + full.length;
      const closePos = findClose(src, afterOpen, '{{#each', '{{/each}}');
      const inner = src.slice(afterOpen, closePos);
      const idxVar = idx || '__i';
      const newLocals = [...locals, item, idxVar];
      result += `\${(${wrapExpr(arr, locals)} || []).map((${item}, ${idxVar}) => \`${transform(inner, newLocals, item)}\`).join('')}`;
      pos = closePos + 9;
    } else if (partialMatch) {
      const partialData = loopVar ? `{...__d, ...${loopVar}}` : '__d';
      result += `\${__h.partial('${partialMatch[1].trim()}', ${partialData})}`;
      pos += partialMatch[0].length;
    } else if (exprMatch) {
      result += `\${${wrapExpr(exprMatch[1], locals)}}`;
      pos += exprMatch[0].length;
    } else {
      result += src[pos];
      pos++;
    }
  }
  return result;
}

function compileTemplate(templateString) {
  const transformed = transform(templateString);
  try {
    const fn = new Function('__d', '__h', `return \`${transformed}\`;`);
    return (data) => fn(data || {}, helpers);
  } catch (e) {
    console.error('Compile error:', e, '\nTransformed:', transformed);
    return () => `<!-- Compilation error: ${e.message} -->`;
  }
}

function registerTemplate(name, templateString) {
  templates.set(name, templateString);
  compiled.delete(name);
  listeners.forEach(fn => fn(name, templateString));
}

function getTemplate(name) {
  if (compiled.has(name)) return compiled.get(name);
  const src = templates.get(name);
  if (!src) return null;
  const fn = compileTemplate(src);
  compiled.set(name, fn);
  return fn;
}

function render(templateName, data = {}) {
  const fn = getTemplate(templateName);
  if (!fn) return `<!-- Template "${templateName}" not found -->`;
  try { return fn(data); }
  catch (e) { console.error(`Render error "${templateName}":`, e); return `<!-- Render error: ${e.message} -->`; }
}

function clearCache() { compiled.clear(); }
function getTemplateString(name) { return templates.get(name); }
function hasTemplate(name) { return templates.has(name); }
function deleteTemplate(name) { compiled.delete(name); return templates.delete(name); }
function getTemplateNames() { return Array.from(templates.keys()); }
function onTemplateChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function registerTemplates(obj) { Object.entries(obj).forEach(([n, t]) => registerTemplate(n, t)); }
function exportTemplates() { const o = {}; templates.forEach((v, k) => o[k] = v); return o; }
function importTemplates(obj) { registerTemplates(obj); }

registerTemplates(pluginTemplates);

export {
  registerTemplate, getTemplate, render, compileTemplate, clearCache,
  getTemplateString, hasTemplate, deleteTemplate, getTemplateNames,
  onTemplateChange, registerTemplates, exportTemplates, importTemplates, helpers
};
