# Todo

## Automated

- Searching for pods still doesn't work. 
    - Typing in the search box is slow (like it's not debounced).
    - The result of typing in the search box is nothing, the list of pods is not updated based on what is typed in. 
- There's a load of console errors that should be fixed:
    MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Context picker (Ctrl+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4213
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ context-quick-picker.tsx:96
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ContextQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:117
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    context-quick-picker.tsx:96 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Context picker (Ctrl+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ context-quick-picker.tsx:96
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ContextQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:117
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    namespace-quick-picker.tsx:130 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Namespace picker (Ctrl+Shift+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4213
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ namespace-quick-picker.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <NamespaceQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    namespace-quick-picker.tsx:130 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Namespace picker (Ctrl+Shift+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ namespace-quick-picker.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <NamespaceQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    context-quick-picker.tsx:96 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Context picker (Ctrl+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4213
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    flushSpawnedWork @ react-dom_client.js?v=4cf6dc1d:8752
    commitRoot @ react-dom_client.js?v=4cf6dc1d:8585
    commitRootWhenReady @ react-dom_client.js?v=4cf6dc1d:8079
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:8051
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ context-quick-picker.tsx:96
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ContextQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:117
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    context-quick-picker.tsx:96 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Context picker (Ctrl+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    flushSpawnedWork @ react-dom_client.js?v=4cf6dc1d:8752
    commitRoot @ react-dom_client.js?v=4cf6dc1d:8585
    commitRootWhenReady @ react-dom_client.js?v=4cf6dc1d:8079
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:8051
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ context-quick-picker.tsx:96
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ContextQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:117
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    namespace-quick-picker.tsx:130 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Namespace picker (Ctrl+Shift+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4213
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    flushSpawnedWork @ react-dom_client.js?v=4cf6dc1d:8752
    commitRoot @ react-dom_client.js?v=4cf6dc1d:8585
    commitRootWhenReady @ react-dom_client.js?v=4cf6dc1d:8079
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:8051
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ namespace-quick-picker.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <NamespaceQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    namespace-quick-picker.tsx:130 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Namespace picker (Ctrl+Shift+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    flushSpawnedWork @ react-dom_client.js?v=4cf6dc1d:8752
    commitRoot @ react-dom_client.js?v=4cf6dc1d:8585
    commitRootWhenReady @ react-dom_client.js?v=4cf6dc1d:8079
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:8051
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ namespace-quick-picker.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <NamespaceQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    context-quick-picker.tsx:96 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Context picker (Ctrl+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4213
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    processRootScheduleInMicrotask @ react-dom_client.js?v=4cf6dc1d:9005
    (anonymous) @ react-dom_client.js?v=4cf6dc1d:9078
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ context-quick-picker.tsx:96
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ContextQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:117
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    context-quick-picker.tsx:96 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Context picker (Ctrl+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    processRootScheduleInMicrotask @ react-dom_client.js?v=4cf6dc1d:9005
    (anonymous) @ react-dom_client.js?v=4cf6dc1d:9078
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ context-quick-picker.tsx:96
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <ContextQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:117
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    namespace-quick-picker.tsx:130 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Namespace picker (Ctrl+Shift+K)` or the Tooltip component.
    Tooltip @ @mui_material.js?v=4cf6dc1d:39780
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4213
    updateForwardRef @ react-dom_client.js?v=4cf6dc1d:5396
    beginWork @ react-dom_client.js?v=4cf6dc1d:6204
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performSyncWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:9067
    flushSyncWorkAcrossRoots_impl @ react-dom_client.js?v=4cf6dc1d:8984
    processRootScheduleInMicrotask @ react-dom_client.js?v=4cf6dc1d:9005
    (anonymous) @ react-dom_client.js?v=4cf6dc1d:9078
    <ForwardRef(Tooltip)>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ namespace-quick-picker.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <NamespaceQuickPicker>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ header.tsx:130
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Header>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app-layout.tsx:25
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <AppLayout>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ app.tsx:35
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <App>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    Root @ main.tsx:110
    react_stack_bottom_frame @ react-dom_client.js?v=4cf6dc1d:12868
    renderWithHooksAgain @ react-dom_client.js?v=4cf6dc1d:4268
    renderWithHooks @ react-dom_client.js?v=4cf6dc1d:4219
    updateFunctionComponent @ react-dom_client.js?v=4cf6dc1d:5569
    beginWork @ react-dom_client.js?v=4cf6dc1d:6140
    runWithFiberInDEV @ react-dom_client.js?v=4cf6dc1d:851
    performUnitOfWork @ react-dom_client.js?v=4cf6dc1d:8429
    workLoopSync @ react-dom_client.js?v=4cf6dc1d:8325
    renderRootSync @ react-dom_client.js?v=4cf6dc1d:8309
    performWorkOnRoot @ react-dom_client.js?v=4cf6dc1d:7957
    performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=4cf6dc1d:9059
    performWorkUntilDeadline @ react-dom_client.js?v=4cf6dc1d:36
    <Root>
    exports.jsxDEV @ react_jsx-dev-runtime.js?v=4cf6dc1d:193
    (anonymous) @ main.tsx:124
    namespace-quick-picker.tsx:130 MUI: You have provided a `title` prop to the child of <Tooltip />.
    Remove this title prop `Namespace picker (Ctrl+Shift+K)` or the Tooltip component.
- The search input to search a table should have a clear button next to it.
- Elements of the UI that the user will want to copy (like pod name, node name, and many others) should have a copy button next to them to make them easy to copy. If the names have two versions (e.g. full path, relative path) then there should be a menu button that allows them to choose which path to copy to the clipboard.

## Me

- Check the performance metrics and make sure they are good.

## Later

- Be great to organize clusters (contexts) by environment. So we can quickly see prod vs dev vs stg.
- Be great to get a total overview.
    - How many clusters do we have?
    - How many nodes in total?
    - Performance over all clusters.
- Be great to get an overview by environment.
    - How many clusters?
    - How many nodes?
    - Performance for an whole env.