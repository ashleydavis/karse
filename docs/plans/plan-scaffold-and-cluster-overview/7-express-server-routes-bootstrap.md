# Step 7: Express server, routes, and bootstrap (code + tests)

Wire the Express app, both route modules, and the entrypoint. Covers plan section 8 (substeps 17-19).

## Code

1. **`backend/src/server.ts`** exporting `createServer(): express.Express`: apply `express.json()`; mount both routers under `/api`; final error middleware `res.status(500).json({ error: err.message })` (one branch, no `instanceof`).

2. **`backend/src/routes/contexts-route.ts`**: `import * as kubectl from "../kubectl/kubectl-adapter";`, `import { Router } from "express";`, `export const contextsRouter = Router();`.
   - `GET /contexts`: calls `listContexts()` and `getCurrentContext()` in parallel; responds `{ contexts, current }`. Plain `async` handlers (Express 5 forwards rejections natively, no `asyncHandler`).
   - `POST /contexts/current` body `{ name: unknown }`: if `typeof name !== "string"` or `name.trim() === ""` → 400 `{ error: "name must be a non-empty string" }`; if `name.startsWith("-")` → 400 `{ error: "name must not start with '-'" }` (issue 23); otherwise `setCurrentContext(name)` and respond with refreshed `{ contexts, current }`.

3. **`backend/src/routes/cluster-route.ts`**: same imports, `export const clusterRouter = Router();`.
   - `GET /cluster/overview`: returns `getClusterOverview()`.
   - `GET /cluster/nodes`: returns `{ nodes }` from `listNodes()`.
   - Plain `async` handlers.

4. **`backend/src/index.ts`**: `import { createServer } from "./server";`, `import { pruneOldLogs } from "./audit-log";`; read `process.env.KARSE_PORT` (default `5172`); read `process.env.KARSE_LOGS_DIR` (default `"../logs"`) into a `logsDir` const; `await pruneOldLogs(logsDir);` (top-level await; with the backend's cwd `backend/`, the default resolves to the repo root `logs/`); `const app = createServer();`; `app.listen(port, "127.0.0.1", () => console.log(...))`. **No unit tests** (pure wiring; covered by the smoke script in step 12).

5. **`backend/src/kubectl/__mocks__/kubectl-adapter.ts`** Jest manual mock:
   ```ts
   // Jest mock for listContexts.
   export const listContexts = jest.fn();
   // Jest mock for getCurrentContext.
   export const getCurrentContext = jest.fn();
   // Jest mock for setCurrentContext.
   export const setCurrentContext = jest.fn();
   // Jest mock for listNodes.
   export const listNodes = jest.fn();
   // Jest mock for getClusterOverview.
   export const getClusterOverview = jest.fn();
   ```

## Tests

**`backend/src/tests/routes/contexts-route.test.ts`**: `jest.mock("../../kubectl/kubectl-adapter");`; `beforeAll` builds `createServer()` and `app.listen(0, "127.0.0.1", ...)` capturing the port; `afterAll` closes; `beforeEach` resets mocks.
- `GET /api/contexts` happy: 200, body deep-equals `{ contexts: [...], current: "alpha" }`, `listContexts` called once.
- `POST /api/contexts/current` happy: body `{ name: "beta" }` → 200 refreshed payload, `setCurrentContext` called with `"beta"`.
- `POST` missing body → 400 `{ error: "name must be a non-empty string" }`, `setCurrentContext` not called.
- `POST` empty name `{ name: "" }` → 400.
- `POST` non-string `{ name: 42 }` → 400, not called.
- `POST` leading-`-` `{ name: "-x" }` → 400 `{ error: "name must not start with '-'" }`, not called.
- `POST` adapter throws → 500 `{ error: "no such context" }`.
- `GET /api/contexts` adapter throws → 500 `{ error: "denied" }`.

**`backend/src/tests/routes/cluster-route.test.ts`**: same mock + random-port pattern.
- `GET /api/cluster/overview` happy → 200 deep-equals resolved payload.
- overview adapter throws → 500 `{ error: "unreachable" }`.
- `GET /api/cluster/nodes` happy → 200 `{ nodes: [...] }`.
- nodes empty → 200 `{ nodes: [] }`.
- nodes adapter throws → 500 `{ error: "denied" }`.

## Verification

From `backend/`: `bun run compile` and `bun run test` (every backend test). Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
