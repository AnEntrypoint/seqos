## 2026-04-16
### observability
- server.js /debug now returns executors map with per-executor getStatus()
- /debug/executors already exposed via api-routes.js
- window.__debug.api, .workflow, .ui permanently registered in ui-init-v2.js

### test-coverage
- test.js created at project root: 9 assertions covering health, workflow CRUD, run, task-run status, debug/executors
- All 9 pass against real server on port 3099


### ui-api-routes
- Added seqos/api-routes.js: GET/POST /api/workflows, GET/DELETE /api/workflows/:id, POST /api/workflows/:id/run, GET /api/task-runs/:id, GET /debug/executors
- Added listWorkflows, deleteWorkflow, getTaskRunById to core/db.js
- Split service DB functions to core/db-services.js (200-line compliance)
- server.js imports registerApiRoutes, dispatches via tryApiRoute before static serving

### ui-backend-connect
- Added ui/api.js: listWorkflows, saveWorkflow, deleteWorkflow, getWorkflow, runWorkflow, getTaskRun fetch helpers
- ui/ui-init-v2.js: loads first workflow from backend on init, creates+saves demo if none exists
- Run button in top bar with polling banner (running/completed/failed, auto-hide 3s)
- syncWorkflow() called on all node/connection mutations
- window.__debug.api = { connectionStatus, lastRun } registered on init

