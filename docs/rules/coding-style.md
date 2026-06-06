# Coding style

Conventions for Karse (Bun + TypeScript backend, Vite + React frontend). Every change must follow every rule below.

## File naming

- Filenames are kebab-case (lowercase with hyphens): `cluster-overview.tsx`, `kubectl-adapter.ts`.
- React component **identifiers** stay PascalCase (`function NodesTable`). Only the filename is hyphenated.

## Source layout

- Every source file lives under its package's `src/` (`backend/src/` or `frontend/src/`). No source files sit directly in the package root.
- Backend tests live under `backend/src/tests/`, mirroring the source directory tree. Tests are **not** co-located with the modules they cover.
- The frontend splits its `src/` into `pages/` (route-level), `components/` (visual parts shared across multiple pages), and `lib/` (non-UI code). Each page lives in its own directory as `pages/<page>/index.tsx`, with components used only by that page colocated under `pages/<page>/components/`. A component moves to `components/` only once more than one page needs it.
- The backend has `src/lib/` for reusable server-side code shared across routes and modules.

## Code style

- Idiomatic TypeScript casing: `camelCase` for variables, functions, methods, and object properties; `PascalCase` for types, interfaces, classes, enums, and React components; `UPPER_SNAKE_CASE` only for true compile-time constants and env var names.
- Every module-level symbol (function, type, interface, constant, class) must have a `//` comment explaining its purpose and responsibility.
- Named exports only. No default exports.
- Avoid `as` type casts. Only use them when TypeScript cannot infer the correct type and there is no better alternative (e.g. casting an `allSettled` result array to a tuple so destructuring is non-nullable, or `as jest.Mock` in tests to access mock methods). Never use `as` to silence a type error that could be fixed with a proper type annotation or type guard.
- Prefer `any` over `unknown`. Use `any` for values whose type is not statically known.
- 4-space indentation.
- One statement per line. Never combine multiple statements on a single line with semicolons or commas.
- Object literals are never written on a single line. Every property is on its own line.
- Always use curly braces around conditional bodies (`if`, `else`, `for`, `while`, etc.), even for single-statement bodies.
- `else` always starts on a new line (Allman-style `else`, not K&R `} else {`).

## Module style

- ESM only. Never use `require(...)`. Never use dynamic `import(...)`.
- All imports are static `import` statements at the top of the file.

## Frontend conventions

- **HTTP**: the frontend uses axios via the typed wrapper in `src/lib/api-client.ts`. Components do not call axios directly; they call the named functions in `api-client.ts`, typically through `useQuery` / `useMutation`.
- **Data fetching**: the frontend uses `@tanstack/react-query` for every server call. Components do not own request state in `useState` + `useEffect`.
- **Shared app state**: the frontend uses a React Context provider (`lib/kube-context.tsx`, exporting `KubeContextProvider` and `useKubeContext()`) for state above the pages, currently the selected kubectl context.
- **Tables**: the frontend uses `@tanstack/react-table` (headless) for tabular data, rendered with MUI primitives.
- **Routing**: React Router 7. Routes are declared centrally in `src/app.tsx`. Each page is colocated with its own components: `src/pages/<page>/index.tsx` is the route-level component and `src/pages/<page>/components/` holds components used only by that page. Visual parts shared across multiple pages live under `src/components/`.
- **Icons**: Font Awesome via `@fortawesome/react-fontawesome`. Register icons in `src/lib/font-awesome.ts`, then use `<FontAwesomeIcon icon={["fas","circle-check"]} />` in components.

## Backend runtime rules

- No Bun-specific APIs in backend source (no `Bun.spawn`, `Bun.which`, `Bun.file`, etc.). Use Node-style APIs (`node:child_process`, `node:fs/promises`, etc.).
- No synchronous Node APIs (no `*Sync` calls, no `fs.readFileSync`, no `spawnSync`). Async everywhere.

## Versioning

- **Never pin versions to `"latest"` (or any floating range) anywhere.** Tools (`mise.toml`), dependencies (`package.json`), Docker base images, CI actions, and any other versioned reference must use a concrete, exact version. Floating versions make builds non-reproducible.
- **When adding a new version pin, pin to the latest version released at that time.** Look up the newest available release and pin to that exact version, rather than guessing or carrying over an older one.

## Tooling

- **Prefer official scripts defined in the root `package.json`.** Never use a raw command (e.g. `tsc`, `jest`, `npx`, `vite`, `playwright`) when an official script already covers that task. If no official script exists for a task, other commands are acceptable.

## Implementation rules

These apply to every change.

- Keep it minimal.
- Minimize complexity.
- Don't overengineer.
- Keep it as simple as possible (the developer will say if they want it more complicated).
