# Step 9: Frontend lib

Create the non-UI frontend support layer: axios wrapper, query client, and the kube-context provider. Types come from the `karse-types` workspace package; there is no `kubectl-types.ts` in the frontend. Covers plan section 10 (substeps 23-25). Exempt from unit testing per project policy (exercised by the manual e2e flow and `scripts/smoke-tests.sh`).

## Files to create

1. **`frontend/src/lib/api-client.ts`**:
   - Imports `Context`, `ContextsResponse`, `ClusterOverview`, `Node` from `"karse-types"`.
   - Private axios instance `const http = axios.create({ baseURL: "/api", headers: { "Content-Type": "application/json" } });`.
   - Response error interceptor: on non-2xx, `throw new Error(response.data?.error ?? response.statusText)`.
   - Named async exports (used by React Query, not called directly from components): `fetchContexts(): Promise<ContextsResponse>`, `switchContext(name: string): Promise<ContextsResponse>`, `fetchClusterOverview(): Promise<ClusterOverview>`, `fetchNodes(): Promise<{ nodes: Node[] }>`. Each returns `response.data` typed.

2. **`frontend/src/lib/query-client.ts`**: export `queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } } })`. Single shared client for the whole app.

3. **`frontend/src/lib/kube-context.tsx`**:
   - Imports `Context` from `"karse-types"`.
   - `type KubeContextValue = { contexts: Context[]; current: string | null; isLoading: boolean; error: Error | null; switchTo: (name: string) => Promise<void>; }`.
   - `const Ctx = createContext<KubeContextValue | null>(null);`.
   - `KubeContextProvider({ children }: { children: ReactNode })`: uses `useQuery({ queryKey: ["contexts"], queryFn: fetchContexts })`; `switchTo(name)` calls `switchContext(name)` then invalidates `["contexts"]` and `["cluster"]`; provides `{ contexts: data?.contexts ?? [], current: data?.current ?? null, isLoading: query.isLoading, error: (query.error as Error | null) ?? null, switchTo }`.
   - `useKubeContext(): KubeContextValue`: reads the context; throws if used outside the provider (`if (value === null) { throw new Error("useKubeContext must be used inside <KubeContextProvider>"); }`).
   - The selected context is owned here; pages read it via the hook (no `contextKey` prop, no `<Outlet context>`).

## Tests

Frontend is not unit-tested. No tests in this step.

## Verification

From `frontend/`: `bun run compile` (these modules must type-check). From `backend/`: `bun run test` remains green. Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
