import { useCallback, useMemo, useState } from "react";
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
import type { WorkloadUsage, ClusterResourceTotals } from "karse-types";
import { useOriginTag, useShareableNavigate } from "../../../lib/nav-state";
import { ResourceRef } from "../../../components/resource-ref";
import { DataTableRows } from "../../../components/data-table-row";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { ResourceBarCell } from "../../../components/resource-utilization/resource-bar-cell";
import { StatusBadge } from "../../../components/resource-utilization/status-badge";
import { ViewToggles } from "../../../components/resource-utilization/view-toggles";
import {
    ResourceUtilizationProvider,
    useResourceUtilization,
} from "../../../lib/resource-utilization-context";
import {
    clusterPercent,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    classifyWorkloadRequestsRow,
    classifyPodUsageRow,
    type ViewMode,
    type ValueFormat,
} from "../../../lib/resource-utilization";

// Maps a workload's kind (as the backend reports it: "Pod", "Deployment", "StatefulSet",
// "DaemonSet") to its in-app detail route, or null when the kind has no detail page so the
// row stays unlinked. The route plurals match the router definitions in app.tsx.
function detailPathFor(workload: WorkloadUsage): string | null {
    switch (workload.kind) {
        case "Pod":
            return `/pods/${workload.namespace}/${workload.name}`;
        case "Deployment":
            return `/deployments/${workload.namespace}/${workload.name}`;
        case "StatefulSet":
            return `/statefulsets/${workload.namespace}/${workload.name}`;
        case "DaemonSet":
            return `/daemonsets/${workload.namespace}/${workload.name}`;
        default:
            return null;
    }
}

// The figure a workload row shows for a metric under the selected View mode: live usage in
// usage mode, reserved requests in requests mode. Null usage (Metrics API absent) keeps the
// usage-mode bar honest with an em-dash.
// A workload is clickable only when it has a detail page. A module-level function so the row
// list keeps the same predicate on every render.
function hasDetailPage(workload: WorkloadUsage): boolean {
    return detailPathFor(workload) !== null;
}

function metricFor(workload: WorkloadUsage, mode: ViewMode, metric: "cpu" | "memory"): number | null {
    const reading = mode === "usage" ? workload.usage : workload.requests;
    return metric === "cpu" ? reading.cpuMillicores : reading.memoryBytes;
}

// One workload row's bar-cell props for a metric: the percentage of the cluster total (the
// base for cluster-scope bars per the spec) and the display text, which is the percentage
// in % format or the used/total absolute string in Absolute format. The status level
// classifies the row by mode: usage mode grades how close the workload runs to its request,
// requests mode flags a workload claiming a large share of the cluster.
function barProps(
    value: number | null,
    base: number | null,
    format: ValueFormat,
    formatAbsolute: (used: number | null, total: number | null) => string,
): { percent: number | null; displayText: string } {
    const percent = clusterPercent(value, base);
    const displayText = format === "percent"
        ? (percent === null ? "—" : `${percent}%`)
        : formatAbsolute(value, base);
    return { percent, displayText };
}

// The status label and level for a workload row, mode-dependent. Usage mode uses the pod
// usage classifier on the workload's CPU usage versus its own CPU request (how close it
// runs to its reservation); requests mode uses the large-claim classifier on the workload's
// CPU requests as a percentage of the cluster CPU total.
function statusFor(workload: WorkloadUsage, mode: ViewMode, cpuClusterTotal: number | null) {
    if (mode === "usage") {
        const percent = clusterPercent(workload.usage.cpuMillicores, workload.requests.cpuMillicores);
        return classifyPodUsageRow(percent);
    }
    const percent = clusterPercent(workload.requests.cpuMillicores, cpuClusterTotal);
    return classifyWorkloadRequestsRow(percent);
}

// Builds the workloads table columns for the current toggle state. The CPU/memory headers
// and bar values react to the View mode and Value format; the bars are percentages of the
// cluster total. The Status column classifies the row by mode (usage: how close to its
// request; requests: large cluster claim).
function buildColumns(
    mode: ViewMode,
    format: ValueFormat,
    totals: ClusterResourceTotals,
): ColumnDef<WorkloadUsage>[] {
    const cpuBase = totals.allocatable.cpuMillicores;
    const memBase = totals.allocatable.memoryBytes;
    const cpuHeader = mode === "usage" ? "CPU usage" : "CPU requests";
    const memHeader = mode === "usage" ? "Memory usage" : "Memory requests";
    return [
        {
            accessorKey: "name",
            header: "Workload",
            cell: (info) => (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} data-test-id="workload-name">
                        {info.getValue<string>()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{info.row.original.kind}</Typography>
                </Box>
            ),
        },
        {
            accessorKey: "namespace",
            header: "Namespace",
            // The workload's namespace links to its own detail page. The row navigates to
            // the workload, so the link stops its click from bubbling up to the row.
            cell: (info) => (
                <span onClick={(e) => e.stopPropagation()}>
                    <ResourceRef kind="Namespace" name={info.getValue<string>()} testId="cluster-workload-row-namespace-link" />
                </span>
            ),
        },
        {
            id: "cpu",
            header: cpuHeader,
            accessorFn: (row) => clusterPercent(metricFor(row, mode, "cpu"), cpuBase) ?? -1,
            cell: (info) => {
                const { percent, displayText } = barProps(
                    metricFor(info.row.original, mode, "cpu"),
                    cpuBase,
                    format,
                    formatAbsoluteCpu,
                );
                const status = statusFor(info.row.original, mode, totals.allocatable.cpuMillicores);
                return <ResourceBarCell percent={percent} displayText={displayText} level={status.level} testId="workload-cpu" />;
            },
            enableGlobalFilter: false,
        },
        {
            id: "memory",
            header: memHeader,
            accessorFn: (row) => clusterPercent(metricFor(row, mode, "memory"), memBase) ?? -1,
            cell: (info) => {
                const { percent, displayText } = barProps(
                    metricFor(info.row.original, mode, "memory"),
                    memBase,
                    format,
                    formatAbsoluteMemory,
                );
                const status = statusFor(info.row.original, mode, totals.allocatable.cpuMillicores);
                return <ResourceBarCell percent={percent} displayText={displayText} level={status.level} testId="workload-memory" />;
            },
            enableGlobalFilter: false,
        },
        {
            id: "status",
            header: "Status",
            accessorFn: (row) => statusFor(row, mode, totals.allocatable.cpuMillicores).label,
            cell: (info) => {
                const status = statusFor(info.row.original, mode, totals.allocatable.cpuMillicores);
                return <StatusBadge label={status.label} level={status.level} />;
            },
            enableGlobalFilter: false,
        },
    ];
}

// The mode-specific text legend shown below the table. Usage mode explains the pod-usage
// bands (how close a workload runs to its own request); requests mode explains the
// large-claim band. Text only for now; the colours plan adds the swatches.
function StatusLegend({ mode }: { mode: ViewMode }) {
    const text = mode === "usage"
        ? "Status grades each workload's usage against its own request: Under-provisioned (≥ 90% of request), OK, or Over-reserving (≤ 35%)."
        : "Status flags a workload whose requests claim a large share of the cluster: Large claim (≥ 50% of cluster CPU) or OK.";
    return (
        <Typography variant="caption" color="text.secondary" data-test-id="workloads-legend">
            {text}
        </Typography>
    );
}

// The inner table (inside the provider): reads the shared toggles, builds the columns for
// the current mode/format, and renders the searchable/sortable workloads table.
function WorkloadsTableInner({
    workloads,
    totals,
}: {
    workloads: WorkloadUsage[];
    totals: ClusterResourceTotals;
}) {
    const { mode, format } = useResourceUtilization();
    const navigate = useShareableNavigate();
    // Tags each workload link with the cluster page, so the workload detail page's
    // breadcrumb shows "Cluster > <workload>" and links back here.
    const from = useOriginTag();
    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();

    // Memoised so every row keeps the same cells across a render, and the memoised rows below
    // can skip re-rendering when only the search text has changed.
    const columns = useMemo(() => buildColumns(mode, format, totals), [mode, format, totals]);
    const openWorkload = useCallback((workload: WorkloadUsage) => {
        const path = detailPathFor(workload);
        if (path !== null)
        {
            navigate(path, { from });
        }
    }, [navigate, from]);

    const table = useReactTable({
        data: workloads,
        columns,
        state: { sorting, globalFilter: deferredSearch },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearch,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    const rows = table.getRowModel().rows;

    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={faSortUp} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={faSortDown} />;
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}
                >
                    Workloads
                </Typography>
                <ViewToggles />
            </Box>
            <TextField
                size="small"
                placeholder="Search workloads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-test-id="workloads-search"
                sx={{ maxWidth: 320 }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="workloads-table">
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
                        {rows.length === 0 && workloads.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-workloads-empty">No workloads.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && workloads.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-workloads-match">No workloads match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        <DataTableRows
                            rows={rows}
                            visibleColumns={table.getVisibleLeafColumns()}
                            testId="workload-row"
                            isClickable={hasDetailPage}
                            onOpen={openWorkload}
                        />
                    </TableBody>
                </Table>
            </TableContainer>
            <StatusLegend mode={mode} />
        </Box>
    );
}

// The cluster Overview workloads table: a sortable, searchable table of every top-level
// controller's CPU/memory consumption, with shared Usage/Requests + %/Absolute toggles. Bar
// values are the workload's share of the cluster total (see docs/spec/resource-utilization);
// the headers and the status legend below the table react to the View mode. A row links to
// its workload's detail page where one exists (Pod/Deployment/StatefulSet/DaemonSet).
export function ClusterWorkloadsTable({
    workloads,
    totals,
}: {
    workloads: WorkloadUsage[];
    totals: ClusterResourceTotals;
}) {
    return (
        <ResourceUtilizationProvider>
            <WorkloadsTableInner workloads={workloads} totals={totals} />
        </ResourceUtilizationProvider>
    );
}
