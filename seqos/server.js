import http from 'http';
import { handleRunnerRequest } from '../edge/runner.js';
import { handleServiceRequest } from '../edge/service.js';
import { createExecutor } from '../dag/executor.js';
import { getConfig } from '../core/config.js';
import { catchAtBoundary, supervise } from '../core/recovery.js';
import { registerConnection, unregisterConnection } from '../core/hot-reload.js';
import { expose, getAllExposed } from '../core/debug.js';
import { jsonResponse, parseBody, createWebRequest, convertWebResponse, parseRoute, log, CORS_HEADERS, serveStatic } from './helpers.js';
import { registerApiRoutes } from './api-routes.js';

let server = null;
const executors = new Map();
let tryApiRoute = null;
const serverSupervisor = supervise('server', {
  async restart() {
    await stop();
    await start();
  }
});

async function handleDagRequest(body) {
  const { workflowId, taskRunId, input, action, frameId, result } = body;
  if (action === 'resume') {
    if (!taskRunId || !frameId) throw new Error('taskRunId and frameId required for resume');
    let executor = executors.get(taskRunId);
    if (!executor) {
      executor = createExecutor(taskRunId);
      executors.set(taskRunId, executor);
    }
    return executor.resume(frameId, result);
  }
  if (!taskRunId) throw new Error('taskRunId required');
  let executor = executors.get(taskRunId);
  if (!executor) {
    executor = createExecutor(taskRunId);
    executors.set(taskRunId, executor);
  }
  return executor.start(input);
}

async function handleRequest(req, res) {
  const start = Date.now();
  const { method, url } = req;

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    log(method, url, 204, Date.now() - start);
    return;
  }

  const { path, segments } = parseRoute(url);

  try {
    if (method === 'GET' && path === '/health') {
      jsonResponse(res, { status: 'ok', uptime: process.uptime() });
      log(method, url, 200, Date.now() - start);
      return;
    }

    if (method === 'POST' && path === '/edge/runner') {
      const body = await parseBody(req);
      const webReq = createWebRequest(req, body);
      const webRes = await handleRunnerRequest(webReq);
      const { status, data } = await convertWebResponse(webRes);
      jsonResponse(res, data, status);
      log(method, url, status, Date.now() - start);
      return;
    }

    if (method === 'POST' && segments[0] === 'edge' && segments[1] === 'service') {
      const serviceName = segments[2];
      const body = await parseBody(req);
      body.serviceName = body.serviceName || serviceName;
      const webReq = createWebRequest(req, body);
      const webRes = await handleServiceRequest(webReq);
      const { status, data } = await convertWebResponse(webRes);
      jsonResponse(res, data, status);
      log(method, url, status, Date.now() - start);
      return;
    }

    if (method === 'POST' && segments[0] === 'edge' && segments[1] === 'dag') {
      const workflowId = segments[2];
      const body = await parseBody(req);
      body.workflowId = body.workflowId || workflowId;
      const result = await handleDagRequest(body);
      jsonResponse(res, result);
      log(method, url, 200, Date.now() - start);
      return;
    }

    if (method === 'GET' && path === '/debug') {
      const executorStatuses = {};
      for (const [id, ex] of executors) executorStatuses[id] = ex.getStatus();
      jsonResponse(res, { uptime: process.uptime(), executorCount: executors.size, executors: executorStatuses, exposedKeys: Object.keys(getAllExposed()) });
      log(method, url, 200, Date.now() - start);
      return;
    }

    if (tryApiRoute && await tryApiRoute(req, res, start)) return;
    if (serveStatic(req, res)) return;
    jsonResponse(res, { error: 'Not found' }, 404);
    log(method, url, 404, Date.now() - start);
  } catch (err) {
    const status = err.message.includes('Invalid JSON') ? 400 : 500;
    jsonResponse(res, { error: err.message }, status);
    log(method, url, status, Date.now() - start);
  }
}

function start(port = getConfig('server.port')) {
  return new Promise((resolve, reject) => {
    try {
      server = http.createServer(catchAtBoundary(handleRequest, 'server'));
      server.on('error', (err) => {
        console.error('[server] Error:', err.message);
        serverSupervisor.restart().catch(() => {});
        reject(err);
      });
      server.listen(port, () => {
        tryApiRoute = registerApiRoutes(executors);
        console.log(`SeqOS server listening on port ${port}`);
        registerConnection('server', server);
        expose('server', server);
        expose('executors', executors);
        resolve(server);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function stop() {
  return new Promise((resolve, reject) => {
    if (!server) return resolve();
    executors.clear();
    unregisterConnection('server');
    server.close(err => {
      if (err) return reject(err);
      server = null;
      resolve();
    });
  });
}

function getServer() {
  return server;
}

export { start, stop, getServer, handleRequest };
export default { start, stop, getServer };
