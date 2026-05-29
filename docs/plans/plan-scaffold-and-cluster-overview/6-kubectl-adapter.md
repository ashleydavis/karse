# Step 6: kubectl adapter (code + tests)

Build the read-only kubectl adapter as free async functions that parse kubectl JSON. Covers plan section 7 (substep 16).

## Code

Create **`backend/src/kubectl/kubectl-adapter.ts`** (no factory, no interface, no injection). Imports `run` from `../command-runner` and `audit` from `../audit-log`. Private helper:
```ts
async function kubectl(args: readonly string[]): Promise<CommandResult> {
    await audit("./logs", "kubectl", args);
    return run("kubectl", args);
}
```
Every exported function calls `kubectl(args)`, never `run` directly. **The set of kubectl invocations is hard-coded by the five exported functions; there is no public "run any kubectl" interface.** Create/write/edit commands must never be added.

Exports and behaviour:
- `listContexts(): Promise<Context[]>` runs `["config", "view", "-o", "json"]`. `contexts: null` → `[]`. Missing or empty-string `namespace` → `null`. Iterate with `for...of`/`.map` (not numeric indexing) per `noUncheckedIndexedAccess` discipline.
- `getCurrentContext(): Promise<string | null>` runs `["config", "current-context"]`, trims stdout. Non-zero exit **and** stderr contains `current-context is not set` → `null`; other non-zero → `throw new Error(stderr)`.
- `setCurrentContext(name): Promise<void>` runs `["config", "use-context", name]`, throws `new Error(stderr)` on non-zero. No in-adapter validation (route handles it).
- `listNodes(): Promise<Node[]>` runs `["get", "nodes", "-o", "json"]`. Per item: `name` from `metadata.name`; `status` from the `Ready` condition (`"True"`→`Ready`, `"False"`→`NotReady`, else/missing→`Unknown`, other conditions ignored); `roles` from `metadata.labels` keys matching `^node-role\.kubernetes\.io/(.+)$`, sorted alphabetically, none→`[]`; `version` from `status.nodeInfo.kubeletVersion`; `createdAt` from `metadata.creationTimestamp`.
- `getClusterOverview(): Promise<ClusterOverview>` runs four `kubectl(...)` calls via `Promise.allSettled` (not `Promise.all`). Resolve branches deterministically (version, nodes, namespaces, pods):
  - version (`["version", "-o", "json"]`): on fulfilled exit 0, `serverVersion = data.serverVersion?.gitVersion ?? null`; on **any** other outcome (rejected or non-zero), `serverVersion = null`. Never throws.
  - nodes / namespaces / pods (`get ... -o json`, pods with `-A`): if the settled result is `rejected`, **re-throw `reason`**; if fulfilled with non-zero exit, `throw new Error(stderr)`; otherwise count `= items.length`. Throw on the first count failure encountered.

Also create the Jest manual mock **`backend/src/__mocks__/command-runner.ts`**:
```ts
export const run = jest.fn();
```

## Tests

Create **`backend/src/tests/kubectl/kubectl-adapter.test.ts`** using Jest globals:
- Top: `jest.mock("../../command-runner");` and `jest.mock("../../audit-log");`. Import `run` and `audit`, cast to `jest.Mock`.
- `beforeEach`: `(run as jest.Mock).mockReset();` and `(audit as jest.Mock).mockReset().mockResolvedValue(undefined);`.
- Helper `setRunnerHandlers(handlers)` keyed by `args.join(" ")`; **unmatched argv throws a loud error**; handlers may throw or return `Promise.reject(...)`.
- Audit wiring case: `listContexts()` success → `expect(audit).toHaveBeenCalledWith("./logs", "kubectl", ["config", "view", "-o", "json"])`.
- Contexts: parses two real-shaped contexts (deep-equal both, second's missing namespace → `null`); empty-string namespace → `null`; `contexts: null` → `[]`; throws on non-zero exit (`"boom"`); `getCurrentContext` trimmed name; returns `null` when not set; throws on other non-zero exit (`"permission denied"`); `setCurrentContext` exact argv `["config", "use-context", "my-ctx"]` called once; throws on non-zero exit (`"no such context"`).
- Nodes: parses Ready + NotReady fixture (deep-equal both rows; control-plane role from label, worker `[]`); multiple role labels sorted (`["control-plane", "etcd"]`); Unknown when Ready missing; `[]` when items empty; throws on non-zero exit (`"denied"`).
- Overview: happy path deep-equals `{ serverVersion: "v1.30.0", nodeCount: 3, namespaceCount: 4, podCount: 15 }`; `serverVersion: null` when version call non-zero; `serverVersion: null` when version handler throws; throws when nodes/namespaces/pods non-zero (`"denied"`); rejects when a count call *rejects* (`get nodes` handler returns `Promise.reject(new Error("spawn kubectl ENOENT"))`); tolerates the version call *rejecting* (`serverVersion === null`, counts intact).

Use non-null assertions at indices (`result[0]!.namespace`) in tests per `noUncheckedIndexedAccess` discipline.

## Verification

From `backend/`: `bun run compile` and `bun run test` (command-runner + audit-log + every adapter case). Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
