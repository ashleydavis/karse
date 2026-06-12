import { useMemo, useState } from "react";
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
    Box,
    Paper,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import type { PodUsage, PerformanceMetric } from "karse-types";
import { formatCpu, formatMemory } from "../../lib/performance";
import { fuzzyGlobalFilter } from "../../lib/fuzzy-filter";
import {
    type ProvisioningRow,
    buildProvisioningRows,
    distinctProvisioningPods,
    filterRowsByPods,
} from "../../lib/provisioning-rows";
import { PodFilter } from "../pod-filter";

// Formats one metric figure for display, "—" when it is null/unset.
function formatValue(value: number | null, metric: PerformanceMetric): string {
    return metric === "cpu" ? formatCpu(value) : formatMemory(value);
}

// A single metric bar (usage / request / limit) sized against the row's own scale,
// with the formatted figure alongside so it reads without hovering.
function MetricBar({
    value,
    scale,
    color,
    metric,
}: {
    value: number | null;
    scale: number;
    color: string;
    metric: PerformanceMetric;
}) {
    const width = value === null || scale === 0 ? 0 : Math.min(100, (value / scale) * 100);
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flexGrow: 1, position: "relative", height: 10, bgcolor: "action.hover", borderRadius: 1, minWidth: 60 }}>
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${width}%`,
                        bgcolor: color,
                        borderRadius: 1,
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ width: 64, textAlign: "right", fontFamily: "monospace" }}>
                {formatValue(value, metric)}
            </Typography>
        </Box>
    );
}

// Props for the node Provisioning subtab table. `pods` are the node's pods (one
// table row per container), `metric` is the CPU/Memory selection driving the bar
// figures.
type ProvisioningTableProps = {
    pods: PodUsage[];
    metric: PerformanceMetric;
};

// The node Provisioning subtab: the per-container usage/request/limit rows rendered
// as a searchable, sortable, filterable table. Free-text search (the shared fuzzy
// global filter) matches the namespace/pod/container text; the columns sort; and
// the shared Logs PodFilter narrows the rows to the ticked pods (or, with none
// ticked, the picker's search box as a pod-name substring). Bars render even with
// no Metrics API (request/limit come from the pod spec; the usage bar is empty),
// so the view degrades cleanly.
export function ProvisioningTable({ pods, metric }: ProvisioningTableProps) {
    const theme = useTheme();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    // The pod picker's search box text and ticked pod names. An explicit tick wins;
    // otherwise the picker's search box doubles as a pod-name substring filter.
    const [podSearch, setPodSearch] = useState("");
    const [selectedPods, setSelectedPods] = useState<string[]>([]);

    const allRows = useMemo(() => buildProvisioningRows(pods, metric), [pods, metric]);
    const pickerPods = useMemo(() => distinctProvisioningPods(allRows), [allRows]);

    // Rows narrowed by the pod picker before search/sort: an explicit selection
    // keeps only those pods; otherwise the picker's search box (when non-empty) is a
    // case-insensitive substring filter over the pod name.
    const podFilteredRows = useMemo(
        () => filterRowsByPods(allRows, selectedPods, podSearch),
        [allRows, selectedPods, podSearch],
    );

    const columns = useMemo<ColumnDef<ProvisioningRow>[]>(
        () => [
            {
                id: "container",
                // The pod/container identity, joined so the fuzzy search matches on
                // namespace, pod, and container text.
                accessorFn: (row) => `${row.namespace}/${row.pod} ${row.container}`,
                header: "Container",
                cell: (info) => (
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {info.row.original.namespace}/{info.row.original.pod} · {info.row.original.container}
                    </Typography>
                ),
            },
            {
                id: "usage",
                accessorFn: (row) => row.usage ?? -1,
                header: "Usage",
                enableGlobalFilter: false,
                cell: (info) => {
                    const row = info.row.original;
                    const scale = Math.max(row.usage ?? 0, row.request ?? 0, row.limit ?? 0);
                    return <MetricBar value={row.usage} scale={scale} color={theme.palette.primary.main} metric={metric} />;
                },
            },
            {
                id: "request",
                accessorFn: (row) => row.request ?? -1,
                header: "Request",
                enableGlobalFilter: false,
                cell: (info) => {
                    const row = info.row.original;
                    const scale = Math.max(row.usage ?? 0, row.request ?? 0, row.limit ?? 0);
                    return <MetricBar value={row.request} scale={scale} color={theme.palette.info.main} metric={metric} />;
                },
            },
            {
                id: "limit",
                accessorFn: (row) => row.limit ?? -1,
                header: "Limit",
                enableGlobalFilter: false,
                cell: (info) => {
                    const row = info.row.original;
                    const scale = Math.max(row.usage ?? 0, row.request ?? 0, row.limit ?? 0);
                    return <MetricBar value={row.limit} scale={scale} color={theme.palette.warning.main} metric={metric} />;
                },
            },
        ],
        [metric, theme],
    );

    const table = useReactTable({
        data: podFilteredRows,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
        getRowId: (row) => `${row.namespace}/${row.pod}/${row.container}`,
    });

    function togglePod(name: string): void {
        setSelectedPods((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
    }

    function clearPods(): void {
        setSelectedPods([]);
    }

    if (allRows.length === 0) {
        return (
            <Box data-test-id="perf-provisioning-empty" sx={{ color: "text.secondary", py: 2 }}>
                No containers scheduled on this node.
            </Box>
        );
    }

    const rows = table.getRowModel().rows;

    function SortIcon({ columnId }: { columnId: string }) {
        const sorted = table.getColumn(columnId)?.getIsSorted();
        if (sorted === "asc") {
            return <FontAwesomeIcon icon={faSortUp} />;
        }
        if (sorted === "desc") {
            return <FontAwesomeIcon icon={faSortDown} />;
        }
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <Box data-test-id="perf-provisioning" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                <TextField
                    size="small"
                    placeholder="Search containers..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="perf-provisioning-search"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />
                <PodFilter
                    pods={pickerPods}
                    search={podSearch}
                    onSearchChange={setPodSearch}
                    selectedPods={selectedPods}
                    onTogglePod={togglePod}
                    onClear={clearPods}
                    testIdPrefix="perf-provisioning"
                />
            </Box>

            <TableContainer component={Paper} variant="outlined" data-test-id="perf-provisioning-table">
                <Table size="small">
                    <TableHead>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        sx={{ cursor: header.column.getCanSort() ? "pointer" : "default", userSelect: "none" }}
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
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="perf-provisioning-no-match">
                                        No containers match.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.id} data-test-id="perf-provisioning-row">
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
        </Box>
    );
}
