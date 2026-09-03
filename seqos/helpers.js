import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../core/config.js';

const __dirname = join(fileURLToPath(import.meta.url), '..');

const MIME_TYPES = {
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

function serveStatic(req, res) {
  const url = req.url.split('?')[0];
  let filePath;
  if (url === '/') {
    filePath = join(__dirname, '..', 'ui', 'index.html');
  } else if (url.startsWith('/ui/')) {
    filePath = join(__dirname, '..', url);
  } else {
    return false;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return true;
  }
  const mime = MIME_TYPES[extname(filePath)] || 'text/plain';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(filePath));
  return true;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function createWebRequest(req, body) {
  const host = req.headers.host || getConfig('server.host');
  const url = `http://${host}${req.url}`;
  return {
    method: req.method,
    url,
    headers: req.headers,
    json: async () => body
  };
}

async function convertWebResponse(webResponse) {
  const text = await webResponse.text();
  let data;
  try { data = JSON.parse(text); }
  catch { data = { raw: text }; }
  return { status: webResponse.status, data };
}

function parseRoute(url) {
  const [path, query] = url.split('?');
  const segments = path.split('/').filter(Boolean);
  const params = {};
  if (query) {
    query.split('&').forEach(p => {
      const [k, v] = p.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { path, segments, params };
}

function log(method, url, status, ms) {
  console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} ${ms}ms`);
}

export { jsonResponse, parseBody, createWebRequest, convertWebResponse, parseRoute, log, CORS_HEADERS, serveStatic };
