import { useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    Paper,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { HorizontalPodAutoscaler } from "karse-types";
import { useShareableNavigate, useOriginTag } from "../../../lib/nav-state";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { fetchHorizontalPodAutoscalers } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { LabelsCell } from "../../../components/labels-cell";
import { CopyNameCell } from "../../../components/copy-button";
import { labelsToPairs } from "../../../components/labels-cell-pairs";
import { ResourceRef } from "../../../components/resource-ref";
import { ResourceBarCell } from "../../../components/resource-utilization/resource-bar-cell";
import { ColumnConfigButton } from "../../../components/column-config-modal";
import { useColumnConfig } from "../../../lib/column-config";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { useSearchFilter } from "../../../lib/use-search-filter";
import {
    parseHpaTargets, metricPercent, metricLevel, formatHpaMetrics,
    replicaPercent, replicaLevel, formatReplicas, splitHpaReference,
} from "../../../lib/autoscalers";
import { Timestamp } from "../../../components/timestamp";
import { SearchBox } from "../../../components/search-box";

// Column definitions for the autoscalers table. Targets and Replicas are the two
// performance columns: each renders the shared table bar (fill plus a monospace value)
// so how hard an HPA is working, and how much room it has left, read at a glance. Both
// sort on the numeric percentage behind the bar rather than its display text.
const columns: ColumnDef<HorizontalPodAutoscaler>[] = [
    {
        accessorKey: "name",
        header: "Name",
        // The name is a resource name, so it carries the two-form copy menu.
        cell: (info) => (
            <CopyNameCell
                segments={[info.row.original.namespace, info.row.original.name]}
                label="autoscaler name"
                testId="autoscaler-row-name-copy"
            />
        ),
    },
    {
        accessorKey: "namespace",
        header: "Namespace",
        // The autoscaler's namespace links to its own detail page, like the scale-target
        // reference beside it. The row navigates to the autoscaler, so the link stops its
        // click from bubbling up to the row.
        cell: (info) => (
            <span onClick={(e) => e.stopPropagation()}>
                <ResourceRef kind="Namespace" name={info.getValue<string>()} testId="autoscaler-row-namespace-link" />
            </span>
        ),
    },
    {
        id: "reference",
        accessorKey: "reference",
        header: "Reference",
        cell: (info) => {
            const { kind, name } = splitHpaReference(info.row.original.reference);
            // The reference links to the scale target, so its click must not also
            // navigate the row to the autoscaler.
            return (
                <span onClick={(e) => e.stopPropagation()}>
                    <ResourceRef
                        kind={kind}
                        name={name}
                        namespace={info.row.original.namespace}
                        label={info.row.original.reference}
                        testId="autoscaler-reference"
                    />
                </span>
            );
        },
    },
    {
        id: "targets",
        header: "Targets",
        // Sorts on how close the first metric is to its target (null last), while the
        // cell shows every metric's current/target reading.
        accessorFn: (row) => metricPercent(parseHpaTargets(row.targets)[0]) ?? -1,
        cell: (info) => {
            const metrics = parseHpaTargets(info.row.original.targets);
            const percent = metricPercent(metrics[0]);
            return (
                <ResourceBarCell
                    percent={percent}
                    displayText={formatHpaMetrics(metrics)}
                    level={metricLevel(percent)}
                    testId="autoscaler-targets"
                />
            );
        },
    },
    {
        id: "replicas",
        header: "Replicas",
        // Sorts on the share of maxReplicas in use, while the cell shows current/desired.
        accessorFn: (row) => replicaPercent(row) ?? -1,
        cell: (info) => (
            <ResourceBarCell
                percent={replicaPercent(info.row.original)}
                displayText={formatReplicas(info.row.original)}
                level={replicaLevel(info.row.original)}
                testId="autoscaler-replicas"
            />
        ),
    },
    { accessorKey: "minReplicas", header: "Min" },
    { accessorKey: "maxReplicas", header: "Max" },
    {
        id: "age",
        accessorKey: "createdAt",
        header: "Age",
        // Excluded from the fuzzy search: this cell's value is the raw ISO timestamp,
        // not the relative age the column renders, so searching it matches text the
        // user cannot see (a query of digits matched every row through it).
        enableGlobalFilter: false,
        cell: (info) => <Timestamp value={info.getValue<string>()} />,
        sortingFn: (a, b) =>
            new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
    },
    {
        id: "labels",
        // Joins labels into searchable "key=value" text so the table's fuzzy search
        // matches on both label keys and values.
        accessorFn: (row) => labelsToPairs(row.labels).join(" "),
        header: "Labels",
        cell: (info) => <LabelsCell labels={info.row.original.labels} resourceKind="HorizontalPodAutoscaler" resourceName={info.row.original.name} />,
        enableSorting: false,
    },
];

// Sortable, searchable table of the horizontal pod autoscalers in the active context,
// scoped to the active namespace when one is selected. Read-only: it reports how each
// HPA is performing (metric against target, replicas against its bounds) and never
// offers a scaling action.
export function AutoscalersTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();
    // Tags each row link with this page, so the HPA detail page's breadcrumb shows the
    // trail the user actually took and its origin crumb links back here.
    const from = useOriginTag();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["horizontalpodautoscalers", current, namespace],
        queryFn: () => fetchHorizontalPodAutoscalers(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();

    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("autoscalers", columns);

    const table = useReactTable({
        data: data?.horizontalPodAutoscalers ?? [],
        columns,
        state: {
            sorting,
            globalFilter: deferredSearch,
            columnOrder,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearch,
        // No pagination row model is installed (every matching row is rendered, bounded only by
        // DataTableRows' render limit), so the page index is meaningless here. TanStack would
        // otherwise reset it whenever a row model is rebuilt, and since the row-model inputs are
        // rebuilt on every render that reset would write table state, re-render, and loop.
        autoResetPageIndex: false,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading) {
        return <LoadingIndicator />;
    }

    const rows = table.getRowModel().rows;
    const all = data?.horizontalPodAutoscalers ?? [];

    // Renders the appropriate sort direction icon for a column header.
    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") {
            return <FontAwesomeIcon icon={faSortUp} />;
        }
        if (sorted === "desc") {
            return <FontAwesomeIcon icon={faSortDown} />;
        }
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2 items-center">
                <SearchBox
                    placeholder="Search autoscalers..."
                    value={search}
                    onChange={setSearch}
                    testId="autoscalers-search"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
            </div>
            <TableContainer component={Paper} data-test-id="autoscalers-table">
                <Table size="small">
                    <TableHead>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        sx={{
                                            cursor: header.column.getCanSort() ? "pointer" : "default",
                                            userSelect: "none",
                                        }}
                                    >
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getCanSort() && <SortIcon columnId={header.id} />}
                                        </span>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody>
                        {rows.length === 0 && all.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-autoscalers-empty">No autoscalers.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-autoscalers-match">No autoscalers match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="autoscaler-row"
                                sx={tableRowSx(true)}
                                onClick={() => navigate(
                                    `/autoscalers/${row.original.namespace}/${row.original.name}`,
                                    { from },
                                )}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
