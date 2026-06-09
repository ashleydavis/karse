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
    Alert,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useShareableNavigate } from "../../../lib/nav-state";
import type { DaemonSet } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { fetchDaemonSets } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { StatusFilter } from "../../../components/status-filter";
import { statusColumnFilterFn, makeStatusFilterController } from "../../../lib/status-filter-state";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { LabelsCell } from "../../../components/labels-cell";
import { labelsToPairs } from "../../../components/labels-cell-pairs";
import { LabelFilter } from "../../../components/label-filter";
import { labelColumnFilterFn, makeLabelFilterController } from "../../../lib/label-filter-state";
import { ResourceStatsHeader } from "../../../components/resource-stats-header";
import { computeDaemonSetStats, daemonSetHealth, HEALTH_FILTER_OPTIONS } from "../../../lib/resource-stats";

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

// Column definitions for the daemon sets table.
const columns: ColumnDef<DaemonSet>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "namespace", header: "Namespace" },
    { accessorKey: "desired", header: "Desired" },
    { accessorKey: "current", header: "Current" },
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
        // Hidden column carrying each daemon set's derived health ("Healthy"/
        // "Error"/"Other") so the health filter can narrow rows. Never rendered
        // (hidden via columnVisibility) and excluded from the fuzzy global filter.
        id: "health",
        accessorFn: (row) => daemonSetHealth(row),
        filterFn: statusColumnFilterFn,
        enableSorting: false,
        enableGlobalFilter: false,
    },
];

// Sortable, filterable table of Kubernetes daemon sets for the active context.
export function DaemonSetsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading } = useQuery({
        queryKey: ["daemonsets", current, namespace],
        queryFn: () => fetchDaemonSets(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    // The selected health states live in the hidden "health" column filter; an absent filter means "all".
    const healthFilterController = makeStatusFilterController("health", HEALTH_FILTER_OPTIONS, columnFilters, setColumnFilters);

    // The label-filter selection lives in the table's "labels" column filter; an absent filter means "no selection" (all rows show).
    const labelFilterController = makeLabelFilterController("labels", data?.daemonSets ?? [], columnFilters, setColumnFilters);

    const table = useReactTable({
        data: data?.daemonSets ?? [],
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters,
            columnVisibility: {
                health: false,
            },
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
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading) {
        return <LoadingIndicator />;
    }

    const rows = table.getRowModel().rows;
    const all = data?.daemonSets ?? [];
    const stats = computeDaemonSetStats(all);

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
            <ResourceStatsHeader stats={stats} testIdPrefix="daemonsets" />
            <div className="flex flex-row gap-2 items-center">
                <TextField
                    size="small"
                    placeholder="Search daemon sets..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="daemonsets-search"
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
                    testIdPrefix="daemonsets-health-filter"
                />
                <LabelFilter
                    available={labelFilterController.available}
                    selection={labelFilterController.selection}
                    onToggle={labelFilterController.toggleValue}
                    onDeselectAll={labelFilterController.deselectAll}
                    selectedCount={labelFilterController.selectedCount}
                    testIdPrefix="daemonsets-label-filter"
                />
            </div>
            <TableContainer component={Paper} data-test-id="daemonsets-table">
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
                                    <Typography color="text.secondary" data-test-id="no-daemonsets-empty">No daemon sets.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-daemonsets-match">No daemon sets match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="daemonset-row"
                                onClick={() => navigate(`/daemonsets/${row.original.namespace}/${row.original.name}`)}
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
