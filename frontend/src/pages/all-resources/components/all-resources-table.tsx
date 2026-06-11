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
    TextField,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { useQueries } from "@tanstack/react-query";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { useShareableNavigate } from "../../../lib/nav-state";
import {
    fetchPods, fetchNodes, fetchNamespaces,
    fetchDeployments, fetchStatefulSets, fetchDaemonSets,
} from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { TableFilter } from "../../../components/table-filter";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { valueColumnFilterFn, labelsColumnFilterFn, collectLabelColumns, type FilterableColumn } from "../../../lib/table-filter-state";
import { useTableFilter } from "../../../lib/use-table-filter";
import { LabelsCell } from "../../../components/labels-cell";
import { labelsToPairs } from "../../../components/labels-cell-pairs";
import { HEALTH_FILTER_OPTIONS } from "../../../lib/resource-stats";
import { aggregateResources, presentKinds, type AllResource } from "../../../lib/all-resources";

// Formats a Kubernetes creationTimestamp into a human-readable age string. An
// empty timestamp (kinds whose list carries no creation time, e.g. namespaces)
// shows as "-".
function formatAge(createdAt: string): string {
    if (createdAt === "") {
        return "-";
    }
    const ms = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0) {
        return `${days}d`;
    }
    if (hours > 0) {
        return `${hours}h`;
    }
    return `${minutes}m`;
}

// Builds the column definitions for the All resources table: Kind, Namespace,
// Name, Status, Age, Labels, plus a hidden Health column that backs the health
// filter (matching every other table).
function buildColumns(): ColumnDef<AllResource>[] {
    return [
        {
            accessorKey: "kind",
            header: "Kind",
            // Keeps a row only when its kind is among the values ticked in the shared
            // filter editor. An empty selection clears this filter, so every row shows.
            filterFn: valueColumnFilterFn,
        },
        {
            accessorKey: "namespace",
            header: "Namespace",
            // Cluster-scoped kinds (Node, Namespace) have no namespace; show blank.
            cell: (info) => info.getValue<string>() || "",
        },
        {
            accessorKey: "name",
            header: "Name",
        },
        {
            accessorKey: "status",
            header: "Status",
        },
        {
            id: "age",
            accessorKey: "createdAt",
            header: "Age",
            cell: (info) => formatAge(info.getValue<string>()),
            // An empty timestamp sorts oldest (treated as 0) so age sort stays total.
            sortingFn: (a, b) => {
                const ta = a.original.createdAt === "" ? 0 : new Date(a.original.createdAt).getTime();
                const tb = b.original.createdAt === "" ? 0 : new Date(b.original.createdAt).getTime();
                return ta - tb;
            },
        },
        {
            id: "labels",
            // Joins labels into searchable "key=value" text so the table's fuzzy
            // search matches on both label keys and values.
            accessorFn: (row) => labelsToPairs(row.labels).join(" "),
            header: "Labels",
            cell: (info) => <LabelsCell labels={info.row.original.labels} />,
            enableSorting: false,
            // Keeps a row only when its labels satisfy the shared editor's label
            // selection. An empty selection clears this filter, so every row passes.
            filterFn: labelsColumnFilterFn,
        },
        {
            // Hidden column carrying each resource's derived health so the health
            // filter can narrow rows. Never rendered and excluded from the fuzzy
            // global filter, matching the other tables.
            id: "health",
            accessorFn: (row) => row.health,
            filterFn: valueColumnFilterFn,
            enableSorting: false,
            enableGlobalFilter: false,
            enableHiding: false,
        },
    ];
}

// Combined, searchable, sortable, filterable table of every resource Karse lists
// across all kinds in the active context. It composes the existing per-kind list
// queries and normalises them into one row shape (see lib/all-resources). When a
// namespace is selected, namespaced kinds are scoped to it; cluster-scoped kinds
// (Node, Namespace) are always shown. Each row links to that resource's own detail
// page, degrading to plain text for kinds without one.
export function AllResourcesTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    // One query per kind, run together. They reuse the same query keys/functions as
    // the per-kind pages, so the cache is shared with those pages.
    const results = useQueries({
        queries: [
            { queryKey: ["pods", current, namespace], queryFn: () => fetchPods(current!, namespace ?? undefined), enabled: current !== null },
            { queryKey: ["cluster", "nodes", current], queryFn: () => fetchNodes(current!), enabled: current !== null },
            { queryKey: ["namespaces", current], queryFn: () => fetchNamespaces(current!), enabled: current !== null },
            { queryKey: ["deployments", current, namespace], queryFn: () => fetchDeployments(current!, namespace ?? undefined), enabled: current !== null },
            { queryKey: ["statefulsets", current, namespace], queryFn: () => fetchStatefulSets(current!, namespace ?? undefined), enabled: current !== null },
            { queryKey: ["daemonsets", current, namespace], queryFn: () => fetchDaemonSets(current!, namespace ?? undefined), enabled: current !== null },
        ],
    });

    const [podsResult, nodesResult, namespacesResult, deploymentsResult, statefulSetsResult, daemonSetsResult] = results;

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const columns = buildColumns();

    const allResources = aggregateResources({
        pods: podsResult.data?.pods,
        nodes: nodesResult.data?.nodes,
        namespaces: namespacesResult.data?.namespaces,
        deployments: deploymentsResult.data?.deployments,
        statefulSets: statefulSetsResult.data?.statefulSets,
        daemonSets: daemonSetsResult.data?.daemonSets,
    });

    // The filterable columns the shared editor offers: the Kind and Health value
    // columns plus one column per label key present across every loaded resource.
    const filterableColumns: FilterableColumn[] = [
        { columnId: "kind", label: "Kind", options: presentKinds(allResources), kind: "value" },
        { columnId: "health", label: "Health", options: HEALTH_FILTER_OPTIONS, kind: "value" },
        ...collectLabelColumns(allResources),
    ];
    const filter = useTableFilter(filterableColumns);

    const table = useReactTable({
        data: allResources,
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters: filter.columnFilters,
            columnVisibility: { health: false },
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    // Surface the first failing query so a broken kind does not silently vanish.
    const failed = results.find((result) => result.error);
    if (failed?.error) {
        return <LoadError message={(failed.error as Error).message} onRetry={() => results.forEach((r) => r.refetch())} />;
    }

    // Show the spinner until every kind's first load has settled, so the combined
    // table is not assembled from a partial set of kinds.
    if (results.some((result) => result.isLoading)) {
        return <LoadingIndicator />;
    }

    const rows = table.getRowModel().rows;

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
                <TextField
                    size="small"
                    placeholder="Search resources..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="all-resources-search"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />
                <TableFilter
                    columns={filter.columns}
                    selection={filter.selection}
                    onToggle={filter.onToggle}
                    onDeselectAll={filter.onDeselectAll}
                    totalSelected={filter.totalSelected}
                    testIdPrefix="all-resources-filter"
                />
            </div>
            <TableContainer component={Paper} data-test-id="all-resources-table">
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
                        {rows.length === 0 && allResources.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-all-resources-empty">No resources.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && allResources.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-all-resources-match">No resources match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => {
                            const path = row.original.detailPath;
                            return (
                                <TableRow
                                    key={row.id}
                                    data-test-id="all-resource-row"
                                    // Tag the destination with from=all-resources so the
                                    // detail page's breadcrumb shows the All resources origin.
                                    onClick={path ? () => navigate(path, { from: "all-resources" }) : undefined}
                                    sx={tableRowSx(path !== null)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
