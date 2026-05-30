# Step 11: Frontend components

Build the four visual components that make up the feature. Covers plan section 12 (substeps 27-30). Frontend, not unit-tested.

## Files to create

1. **`frontend/src/components/context-picker.tsx`**: props `{ contexts: Context[]; current: string | null; onSwitch: (name: string) => void; }`. MUI `Chip` showing `current ?? "no context"`; MUI `Select` of context names rendered only when `contexts.length > 1`; picking a different name calls `onSwitch(name)`.

2. **`frontend/src/components/header.tsx`**: reads `{ contexts, current, switchTo, isLoading, error }` from `useKubeContext()`; reads `queryClient` via `useQueryClient()` for the refresh button. Layout MUI `AppBar` + `Toolbar`. Left: `<FontAwesomeIcon icon={["fas","dharmachakra"]} />` + `<Typography variant="h6">Karse</Typography>`. Right: `<ContextPicker .../>` + refresh icon button (`faRotate`) that invalidates everything under `["contexts"]` and `["cluster"]`. Renders an MUI `Alert` when `error` is non-null.

3. **`frontend/src/components/cluster-overview.tsx`**: reads `current` from `useKubeContext()`; `useQuery({ queryKey: ["cluster", "overview", current], queryFn: fetchClusterOverview, enabled: current !== null })`. When `current === null`, renders a muted "Select a context to see cluster overview." message. Renders four MUI `Card`s in `grid grid-cols-2 md:grid-cols-4 gap-4` with Font Awesome icons; version cell is "-" when `data.serverVersion` is null. On `error`, MUI `Alert severity="error"` with the message.

4. **`frontend/src/components/nodes-table.tsx`**: reads `current` from `useKubeContext()`; `useQuery({ queryKey: ["cluster", "nodes", current], queryFn: fetchNodes, enabled: current !== null })`. Local state `const [sorting, setSorting] = useState<SortingState>([]);` and `const [globalFilter, setGlobalFilter] = useState("");`. `useReactTable` with:
   - `columns: ColumnDef<Node>[]`: Name | Status | Roles | Version | Age. Custom cells for Status (MUI `Chip` + Font Awesome icon, success/error/default per `NodeStatus`), Roles (comma-joined or `<none>`), Age (`Date.now() - new Date(node.createdAt).getTime()` formatted as largest non-zero unit `Nd`/`Nh`/`Nm`). Define `sortingFn` for non-string cells (status string, joined roles, raw `createdAt` ms).
   - `data: data?.nodes ?? []`; `state: { sorting, globalFilter }`; `onSortingChange: setSorting`; `onGlobalFilterChange: setGlobalFilter`.
   - Row models: `getCoreRowModel()`, `getSortedRowModel()`, `getFilteredRowModel()`; `globalFilterFn: "includesString"`.
   - MUI `TextField` above the table bound to `globalFilter`/`setGlobalFilter`; render as MUI `<Table>`/`<TableHead>`/`<TableBody>`; header cells call `getToggleSortingHandler()` and render an up/down chevron from `getIsSorted()`.
   - Empty state: `<Typography color="text.secondary">No nodes.</Typography>`; distinct "no nodes match the search" state when filtered results are empty but `data.nodes.length > 0`.

## Tests

Frontend is not unit-tested. No tests in this step. The two behaviours most worth guarding (context-switch refetch, `enabled` gating) are covered by the explicit manual steps in `docs/e2e-testing.md`.

## Verification

From `frontend/`: `bun run compile` and `bun run build` (the full frontend now type-checks and builds, including the home page from step 10). From `backend/`: `bun run test` remains green. Run all tests and confirm they pass before marking this step complete.

## Summary

Created all four visual components:

- `context-picker.tsx`: shows a `Chip` when there is zero or one context; shows an MUI `Select` when there are multiple contexts; calls `onSwitch` on change.
- `header.tsx`: `AppBar` with dharmachakra icon, "Karse" title, `ContextPicker`, and a refresh `IconButton` that invalidates `["contexts"]` and `["cluster"]`; renders an MUI `Alert` when the kube-context query has an error.
- `cluster-overview.tsx`: four-tile `Grid` with server version, node count, namespace count, pod count. Shows a muted message when no context is selected; shows `Alert severity="error"` on query error. Fixed a TS error by typing the `icon` prop as `IconProp` (from `@fortawesome/fontawesome-svg-core`) rather than `["fas", string]`.
- `nodes-table.tsx`: TanStack Table with sorting and global-filter state; MUI `Table` + `TextField` search input; `StatusChip` with Font Awesome icons per `NodeStatus`; age formatted as largest non-zero unit (`Nd`/`Nh`/`Nm`); distinct empty vs. "no match" states.

Frontend `bun run compile`, `bun run build`, and backend `bun run test` (51 tests) all green.
