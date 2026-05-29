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
export type Context = {
  name: string;
  cluster: string;
  user: string;
  namespace: string | null;
};

export type ContextsResponse = {
  contexts: Context[];
  current: string | null;
};

export type NodeStatus = "Ready" | "NotReady" | "Unknown";

export type Node = {
  name: string;
  status: NodeStatus;
  roles: string[];           // empty array means "<none>"
  version: string;           // kubeletVersion
  createdAt: string;         // ISO timestamp; UI computes age
};

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

_To be completed when this step is implemented._
