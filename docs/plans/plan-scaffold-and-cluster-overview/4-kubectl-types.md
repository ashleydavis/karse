# Step 4: Shared types package

Create the `packages/karse-types` workspace package that exports the five contract types shared between the backend and frontend. Update the root workspaces, backend dependency, and Jest config to resolve the package. Covers plan section 5 (substep 14).

## Files to create

1. **`packages/karse-types/package.json`**:
   - `"name": "karse-types"`, `"type": "module"`, `"private": true`.
   - `"exports": { ".": "./src/index.ts" }`.
   - No runtime dependencies.

2. **`packages/karse-types/tsconfig.json`**: `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `skipLibCheck: true`, `rootDir: "src"`.

3. **`packages/karse-types/src/index.ts`** exporting:

```ts
// A single kubectl context entry from kubeconfig.
export type Context = {
    name: string;
    cluster: string;
    user: string;
    namespace: string | null;
};

// The full list of contexts plus the currently-active context name.
export type ContextsResponse = {
    contexts: Context[];
    current: string | null;
};

// The Ready/NotReady/Unknown health state of a node.
export type NodeStatus = "Ready" | "NotReady" | "Unknown";

// A single cluster node with display-ready fields.
export type Node = {
    name: string;
    status: NodeStatus;
    roles: string[];           // empty array means "<none>"
    version: string;           // kubeletVersion
    createdAt: string;         // ISO timestamp; UI computes age
};

// Aggregate cluster statistics for the overview tiles.
export type ClusterOverview = {
    serverVersion: string | null;   // null if cluster unreachable
    nodeCount: number;
    namespaceCount: number;
    podCount: number;
};
```

## Configuration changes

4. Update **`package.json`** (repo root) workspaces to `["backend", "frontend", "packages/*"]` so any future package added under `packages/` is automatically picked up without editing the root config.

5. Update **`backend/package.json`** to add `"karse-types": "*"` under `dependencies`.

6. Update **`backend/jest.config.js`** to add `moduleNameMapper` so Jest resolves the workspace package to its TypeScript source (Jest ignores workspace symlinks in `node_modules` by default):

```js
export default {
    testEnvironment: "node",
    testMatch: ["<rootDir>/src/tests/**/*.test.ts"],
    transform: { "^.+\\.ts$": "@swc/jest" },
    moduleNameMapper: {
        "^karse-types$": "<rootDir>/../packages/karse-types/src/index.ts"
    }
};
```

## Tests

No tests: this file contains only type aliases (no runtime code). `bun run test` is unchanged (still green).

## Verification

From the repo root: `bun install` (picks up the new workspace). From `backend/`: `bun run compile` and `bun run test` (unchanged, still passing). Run all tests and confirm they pass before marking this step complete.

## Summary

Created the `packages/karse-types` workspace package with three files:

- `package.json`: name `karse-types`, `"exports": { ".": "./src/index.ts" }` (replaced the placeholder `"main"` field that was already present).
- `tsconfig.json`: created fresh with ESNext target/module, bundler moduleResolution, strict, skipLibCheck, rootDir `"src"`.
- `src/index.ts`: populated with the five contract types (`Context`, `ContextsResponse`, `NodeStatus`, `Node`, `ClusterOverview`).

The root `package.json` workspaces (`["backend", "frontend", "packages/*"]`), `backend/package.json` dependency (`"karse-types": "*"`), and `backend/jest.config.js` `moduleNameMapper` were all already correct from the prior scaffolding step and required no changes.

`bun install` picked up the new workspace. `bun run compile` and `bun run test` (7 command-runner tests) both pass.
