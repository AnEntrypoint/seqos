# Technical Caveats

## VM Sandbox Return Values
transformCode() already wraps last expression in `return`. Do not double-wrap in async IIFE.

## Import Paths
`dag/ai.js` imports from `./types/index.js` not `./types.js`.

## File Size Compliance
server.js + api-routes.js + helpers.js split to stay under 200-line limit. core/db.js + core/db-services.js split same reason. All files must stay under 200 lines.

## Database Path
DB_PATH = join(__dirname, '..', 'data', 'seqos.db'). Requires data directory to exist.

## Template Syntax
UI templates use `${}` for interpolation, not `{{}}`. Example: `<p>${message}</p>`.

## Service Registry
registerService(name, endpoint, authRules) takes name as first param, not object. Service DB functions live in core/db-services.js, re-exported from core/db.js.

## Debug Exposure
getAllExposed() returns exposed functions. Use expose(name, value) to add to global scope.

## Suspension Hooks
__callLibrary__(serviceName, chain) and __executeDag__(workflowId, input) throw SuspensionError. Resume via runner.resume(result).

## State Lifecycle
captureState(sandbox) captures variables. restoreState(sandbox, state) restores. savedState persists across execute() calls after resume.

## Executor Start
executor.start() requires existing TaskRun in database. Use createTaskRun(id, workflowId, input) first. API route POST /api/workflows/:id/run handles this automatically.

## HDB Incorporation
core/hdb.js contains complete HDB class with Kuzu database integration. db.js imports from ./hdb.js. kuzu is direct dependency in package.json.

## API Routes
seqos/api-routes.js exports registerApiRoutes(executors) which returns a tryApiRoute(req, res, start) handler. Routes dispatch via array of [method, segmentTest, handler] tuples. server.js calls tryApiRoute before serveStatic.

## UI Backend Connection
ui/api.js exports listWorkflows, saveWorkflow, deleteWorkflow, getWorkflow, runWorkflow, getTaskRun. ui/ui-init-v2.js loads first workflow from backend on init, saves demo if none found, syncs on every mutation. Run button polls getTaskRun every 500ms max 30 times.

## Plugin System Architecture
Plugins register dynamically via registerPlugin(name, config). Config includes template string, observedAttributes array, handlers object, defaults object, and config object. createPluginElement(pluginName) generates custom elements at runtime with auto-kebab-case names (stat-card becomes seq-stat-card). Plugin registry notifies listeners on changes via onPluginChange(fn). unregisterPlugin(name) removes and returns boolean. Template syntax uses ${} interpolation. Each plugin config is independent - defaults and config objects are isolated per plugin. No plugin can affect others. getPlugin(name) throws error if not found; use hasPlugin(name) to check existence first.

## DagUI Node Editor - Vanilla JS Implementation
ui/ui-init-v2.js (194 lines) implements dagui's EditNodePanel with backend sync. Sidebar has two tabs: "Nodes" and "Edit". Run button in top bar polls execution status with banner. window.__debug.api = { connectionStatus, lastRun }. ui/node-editor-panel.js (86 lines) exports createNodeEditorPanel(). ui/node-editor-render.js (126 lines) exports render helpers. ui/ui-render.js (64 lines) exports renderConnections/renderSidebar/getNodeColor/hexToRgb. Config persists in node.config = { triggerType, httpMethod, httpPath, cronExpression, webhookSecret, description, inputs: [{name,type}], outputs: [{name,type}] }.
