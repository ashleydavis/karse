# Step 10: App shell and home page

Wire the routed app shell plus the one initial page that turns the components into a running app. Covers plan section 11 (substep 26). Frontend, not unit-tested.

## Files to create

1. **`frontend/src/lib/font-awesome.ts`**: `config.autoAddCss = false;` and `import "@fortawesome/fontawesome-svg-core/styles.css";`. `library.add(faCircleCheck, faCircleXmark, faCircleQuestion, faServer, faLayerGroup, faCube, faDharmachakra, faRotate, faSort, faSortUp, faSortDown, faMagnifyingGlass);` (last four for nodes-table sort indicators + search). Side-effect import only, no named exports.

2. **`frontend/src/components/app-layout.tsx`**: stateless. Renders `<Header />` and `<Container maxWidth="lg" className="py-6"><Outlet /></Container>`. Holds no state (selected context lives in `KubeContextProvider`).

3. **`frontend/src/pages/cluster-home-page.tsx`**: renders `<ClusterOverview />` and `<NodesTable />` stacked. No props, no `key` remount (React Query refetches when `current` in each query key changes). (These two components are created in step 11; this page references them.)

4. **`frontend/src/app.tsx`**: `<BrowserRouter>` with `path="/"` element `<AppLayout />` and `<Route index element={<ClusterHomePage />} />`.

5. **`frontend/src/main.tsx`**: imports `./index.css` and `./lib/font-awesome` (side effect). Renders the tree outermost-first:
   ```
   <QueryClientProvider client={queryClient}>   (from ./lib/query-client)
     <KubeContextProvider>                       (from ./lib/kube-context)
       <ThemeProvider theme={createTheme()}>
         <CssBaseline />
         <App />
       </ThemeProvider>
     </KubeContextProvider>
   </QueryClientProvider>
   ```
   `QueryClientProvider` must be outermost so `KubeContextProvider` (which calls `useQuery`) sits inside it.

## Note on ordering

This step references `<ClusterOverview />` and `<NodesTable />` built in step 11. Either implement step 11 first, or stub the two components here and complete them in step 11. Type-check (`bun run compile`) only passes once both components exist, so treat steps 10 and 11 as compiling together at the end of step 11 if stubbing is used.

## Tests

Frontend is not unit-tested. No tests in this step.

## Verification

From `frontend/`: `bun run compile` (passes once the referenced components exist). From `backend/`: `bun run test` remains green. Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
