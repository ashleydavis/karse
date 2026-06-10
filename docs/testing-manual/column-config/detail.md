# column-config manual tests

Manual tests for per-table configurable columns (visibility + order), persisted per table. See the spec: [column-config](../../spec/column-config/detail.md).

Every resource table (nodes, pods, deployments, stateful sets, daemon sets, events, errors) has a **Columns** button beside its search box. The steps below use the nodes table; the same button and modal appear on every resource table.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear it down with the Teardown step at the end of this doc.

## Scenario: Configure and persist columns

A cluster with several nodes so the table has stable columns to reorder and hide.

**Fixture:** [03-many-nodes](../_fixtures-kwok/03-many-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/03-many-nodes/setup.sh
```

### What to check

Open the **Nodes page**. By default the table shows: Name, Status, Version, Age, Labels. The **Roles** column is hidden by default (it usually reads `<none>`), so it starts in the modal's Hidden section, not in the table. (To start from a clean default, clear the saved config: in the browser console run `localStorage.removeItem('karse-columns-nodes')` and reload.)

1. **Entry point**: a **Columns** button is shown beside the search box. Click it. A "Configure columns" modal opens with two sections: **Visible** (listing Name, Status, Version, Age, Labels) and **Hidden** (containing **Roles**, which is hidden by default).
2. **Show a hidden column**: drag **Roles** from the Hidden section into the Visible section. A lifted preview of the Roles row follows the cursor, and a gap (drop-target indicator) opens in the Visible section showing where the column will land. Close the modal. The Roles column now appears in the table.
3. **Hide a column**: open the modal again and drag **Roles** from Visible back onto the Hidden section. The same lifted preview and gap appear. Close the modal. The Roles column is gone from the table again; the other columns remain.
4. **Reorder a column**: open the modal again and drag **Version** so it sits above **Status** in the Visible section. As you drag, the rows shift to open a gap at the insertion point, marking where Version will land. Close the modal. In the table, the Version column now appears before the Status column.
5. **Persistence**: reload the page (or navigate away and back). Roles is still hidden and Version still appears before Status: the configuration was saved.
6. **Cross-section drop lands where the gap shows**: with at least two columns already in the Hidden section, drag a Visible column and drop it onto a column in the **middle** of the Hidden list (so the gap opens between two hidden columns). On release, the dropped column lands at that middle position, exactly where the gap showed, not appended to the end of the Hidden list.
7. **Cross-section drop at the end**: with at least one column already in the Hidden section, drag a Visible column and release it in the empty area **below the last** Hidden column. The gap opens at the end and, on release, the dropped column lands as the **last** item in the Hidden list. Every slot (start, middle, end) is reachable.
8. **Per table**: open the **Pods page** (or any other resource table). Its columns are unaffected by the nodes configuration: configuration is stored independently per table.

Any non-configurable columns (those marked `enableHiding: false`) are intentionally not listed in the modal and always stay at the end of the row.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/03-many-nodes/teardown.sh
```

## Automated coverage

The Playwright suite covers this feature in the `column configuration` describe block in `e2e/src/e2e.test.ts`: opening the modal, the default-hidden Roles column starting in the Hidden section (and absent from the table), dragging it into Visible to show it, dragging a column to Hidden (and confirming the table header disappears), reordering within Visible, persistence across a reload, dragging a hidden column back to Visible, a cross-section drop at the insertion point, a cross-section drop into the middle of the destination, and a cross-section drop at the end of the destination list.
