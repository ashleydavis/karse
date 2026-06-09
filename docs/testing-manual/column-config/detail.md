# column-config manual tests

Manual tests for per-table configurable columns (visibility + order), persisted per table. See the spec: [column-config](../../spec/column-config/detail.md).

Every resource table (nodes, pods, deployments, stateful sets, daemon sets, events, errors) has a **Columns** button beside its search box. The steps below use the nodes table; the same button and modal appear on every resource table.

## Scenario: Configure and persist columns

A cluster with several nodes so the table has stable columns to reorder and hide.

**Fixture:** [03-many-nodes](../_fixtures-kwok/03-many-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/03-many-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check

Open the **Nodes page**. The table shows the columns: Name, Status, Roles, Version, Age, Labels.

1. **Entry point**: a **Columns** button is shown beside the search box. Click it. A "Configure columns" modal opens with two sections: **Visible** (listing the columns) and **Hidden** (empty).
2. **Hide a column**: drag **Roles** from the Visible section onto the Hidden section. As you drag across to the Hidden section, a lifted preview of the Roles row follows the cursor (the same preview shown when reordering within a section). Close the modal. The Roles column is gone from the table; the other columns remain.
3. **Reorder a column**: open the modal again and drag **Version** so it sits above **Status** in the Visible section. Close the modal. In the table, the Version column now appears before the Status column.
4. **Persistence**: reload the page (or navigate away and back). The Roles column is still hidden and Version still appears before Status: the configuration was saved.
5. **Show it again**: open the modal and drag **Roles** from Hidden back into Visible. The lifted preview again follows the cursor as it crosses back. Close the modal. The Roles column reappears in the table.
6. **Per table**: open the **Pods page** (or any other resource table). Its columns are unaffected by the nodes configuration: configuration is stored independently per table.

Any non-configurable columns (those marked `enableHiding: false`) are intentionally not listed in the modal and always stay at the end of the row.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/03-many-nodes/teardown.sh
```

## Automated coverage

The Playwright suite covers this feature in the `column configuration` describe block in `e2e/src/e2e.test.ts`: opening the modal, listing configurable columns, dragging a column to Hidden (and confirming the table header disappears), reordering within Visible, persistence across a reload, and dragging a hidden column back to Visible.
