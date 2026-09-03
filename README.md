# SeqOS

Node.js workflow orchestration system with a graph-based DAG executor and browser UI.

## Quick Start

```bash
npm install
npm start          # server on port 3000
```

## Architecture

```
seqos/server.js        HTTP server, route dispatch
seqos/api-routes.js    REST API: /api/workflows, /api/task-runs, /debug/executors
seqos/helpers.js       HTTP utilities: jsonResponse, parseBody, serveStatic
core/db.js             Kuzu graph DB: workflows, nodes, task runs, stack frames
core/db-services.js    Service registry DB functions
core/hdb.js            HDB wrapper around Kuzu
dag/executor.js        DAG executor: start, step, resume, getStatus
ui/ui-init-v2.js       Browser workflow builder UI (194 lines)
ui/api.js              Browser fetch helpers for all API endpoints
ui/workflow.js         Client-side workflow state
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/workflows | List all workflows |
| POST | /api/workflows | Create workflow |
| GET | /api/workflows/:id | Get workflow with nodes+connections |
| DELETE | /api/workflows/:id | Delete workflow |
| POST | /api/workflows/:id/run | Run workflow, returns taskRunId |
| GET | /api/task-runs/:id | Get task run status |
| GET | /debug | Server health + executor map |
| GET | /debug/executors | Per-executor getStatus() |

## Testing

```bash
SEQOS_PORT=3099 node test.js
```

9 integration tests covering full workflow CRUD + execution lifecycle. No mocks.

## Observability

Server: `GET /debug` and `GET /debug/executors`

Browser: `window.__debug.api`, `window.__debug.workflow`, `window.__debug.ui`
