import { useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
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
import { useQuery } from "@tanstack/react-query";
import { useShareableNavigate } from "../../../lib/nav-state";
import type { Deployment } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { fetchDeployments } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { StatusFilter } from "../../../components/status-filter";
import { statusColumnFilterFn, makeStatusFilterController } from "../../../lib/status-filter-state";
import { LoadError } from "../../../components/load-error";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { LabelsCell } from "../../../components/labels-cell";
import { labelsToPairs } from "../../../components/labels-cell-pairs";
import { LabelFilter } from "../../../components/label-filter";
import { labelColumnFilterFn, makeLabelFilterController } from "../../../lib/label-filter-state";
import { ResourceStatsHeader } from "../../../components/resource-stats-header";
import { computeDeploymentStats, deploymentHealth, HEALTH_FILTER_OPTIONS } from "../../../lib/resource-stats";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";

// Formats a Kubernetes creationTimestamp into a human-readable age string.
function formatAge(createdAt: string): string {
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

// Column definitions for the deployments table.
const columns: ColumnDef<Deployment>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "namespace", header: "Namespace" },
    { accessorKey: "ready", header: "Ready" },
    { accessorKey: "upToDate", header: "Up-to-date" },
    { accessorKey: "available", header: "Available" },
    {
        id: "age",
        accessorKey: "createdAt",
        header: "Age",
        cell: (info) => formatAge(info.getValue<string>()),
        sortingFn: (a, b) =>
            new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
    },
    {
        id: "labels",
        // Joins labels into searchable "key=value" text so the table's fuzzy
        // search matches on both label keys and values.
        accessorFn: (row) => labelsToPairs(row.labels).join(" "),
        header: "Labels",
        cell: (info) => <LabelsCell labels={info.row.original.labels} />,
        enableSorting: false,
        // Keeps a row only when its labels satisfy the label-filter selection.
        // An empty selection clears this filter (set by the label-filter controller),
        // so every row passes by default.
        filterFn: labelColumnFilterFn,
    },
    {
        // Hidden column carrying each deployment's derived health ("Healthy"/
        // "Error"/"Other") so the health filter can narrow rows. Never rendered
        // (hidden via columnVisibility) and excluded from the fuzzy global filter.
        id: "health",
        accessorFn: (row) => deploymentHealth(row),
        filterFn: statusColumnFilterFn,
        enableSorting: false,
        enableGlobalFilter: false,
        // Excluded from the column-config modal: it is an always-hidden filter helper, never shown.
        enableHiding: false,
    },
];

// Sortable, filterable table of Kubernetes deployments for the active context.
export function DeploymentsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["deployments", current, namespace],
        queryFn: () => fetchDeployments(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    // The selected health states live in the hidden "health" column filter; an absent filter means "all".
    const healthFilterController = makeStatusFilterController("health", HEALTH_FILTER_OPTIONS, columnFilters, setColumnFilters);

    // The label-filter selection lives in the table's "labels" column filter; an absent filter means "no selection" (all rows show).
    const labelFilterController = makeLabelFilterController("labels", data?.deployments ?? [], columnFilters, setColumnFilters);

    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("deployments", columns);

    const table = useReactTable({
        data: data?.deployments ?? [],
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters,
            columnOrder,
            columnVisibility: { ...columnVisibility, health: false },
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
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
    const all = data?.deployments ?? [];
    const stats = computeDeploymentStats(all);

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
            <ResourceStatsHeader stats={stats} testIdPrefix="deployments" />
            <div className="flex flex-row gap-2 items-center">
                <TextField
                    size="small"
                    placeholder="Search deployments..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="deployments-search"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />
                <StatusFilter
                    all={HEALTH_FILTER_OPTIONS}
                    selected={healthFilterController.selected}
                    onChange={healthFilterController.setSelected}
                    label="Health"
                    testIdPrefix="deployments-health-filter"
                />
                <LabelFilter
                    available={labelFilterController.available}
                    selection={labelFilterController.selection}
                    onToggle={labelFilterController.toggleValue}
                    onDeselectAll={labelFilterController.deselectAll}
                    selectedCount={labelFilterController.selectedCount}
                    testIdPrefix="deployments-label-filter"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
            </div>
            <TableContainer component={Paper} data-test-id="deployments-table">
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
                                    <Typography color="text.secondary" data-test-id="no-deployments-empty">No deployments.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-deployments-match">No deployments match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="deployment-row"
                                onClick={() => navigate(`/deployments/${row.original.namespace}/${row.original.name}`)}
                                sx={tableRowSx(true)}
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
