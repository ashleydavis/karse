import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
    Chip,
    TextField,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCirclePause, faCircleQuestion, faCircleXmark, faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { Pod, PodPhase } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { useShareableNavigate } from "../../../lib/nav-state";
import { fetchPods, fetchClusterPerformance } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { TableFilter } from "../../../components/table-filter";
import { ResourceRef } from "../../../components/resource-ref";
import { DataTableRows } from "../../../components/data-table-row";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { valueColumnFilterFn, labelsColumnFilterFn, collectLabelColumns, type FilterableColumn, type FilterSelection } from "../../../lib/table-filter-state";
import { useTableFilter } from "../../../lib/use-table-filter";
import { LabelsCell } from "../../../components/labels-cell";
import { labelsToPairs } from "../../../components/labels-cell-pairs";
import { ResourceStatsHeader } from "../../../components/resource-stats-header";
import { computePodStats, podHealth, HEALTH_FILTER_OPTIONS } from "../../../lib/resource-stats";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";
import {
    buildPodFiguresMap,
    podFiguresFor,
    podCpuCell,
    podMemoryCell,
    comparePodCells,
    type PodFiguresMap,
} from "../../../lib/pod-utilization";
import { ResourceUtilizationProvider, useResourceUtilization } from "../../../lib/resource-utilization-context";
import { ViewToggles } from "../../../components/resource-utilization/view-toggles";
import { ResourceBarCell } from "../../../components/resource-utilization/resource-bar-cell";
import { StatusBadge } from "../../../components/resource-utilization/status-badge";
import type { ViewMode, ValueFormat } from "../../../lib/resource-utilization";

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

// Renders a colored MUI Chip for a pod phase value.
function PhaseChip({ phase }: { phase: PodPhase }) {
    if (phase === "Running") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label="Running"
                color="success"
                size="small"
            />
        );
    }
    if (phase === "Pending") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCirclePause} />}
                label="Pending"
                color="warning"
                size="small"
            />
        );
    }
    if (phase === "Succeeded") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label="Succeeded"
                color="info"
                size="small"
            />
        );
    }
    if (phase === "Failed") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleXmark} />}
                label="Failed"
                color="error"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={faCircleQuestion} />}
            label="Unknown"
            size="small"
        />
    );
}

// Sort order for pod phases: Running first, Unknown last.
const PHASE_ORDER: Record<PodPhase, number> = {
    Running: 0,
    Pending: 1,
    Succeeded: 2,
    Failed: 3,
    Unknown: 4,
};

// All selectable pod phases, in display order, for the phase filter dropdown.
const ALL_PHASES: PodPhase[] = ["Running", "Pending", "Succeeded", "Failed", "Unknown"];

// Turns the optional `?phase=` query param into the table's initial Status-filter
// selection, so a link can open the pods list already narrowed to one phase (the
// cluster page's POD STATUS counts link here). The seeded filter is an ordinary
// selection: the filter button shows it as applied and the user can clear it. An
// absent or unrecognised phase seeds nothing, leaving the filter off.
function initialPhaseSelection(phase: string | null): FilterSelection {
    if (phase === null) {
        return {};
    }
    const match = ALL_PHASES.find((candidate) => candidate === phase);
    if (match === undefined) {
        return {};
    }
    return {
        phase: [match],
    };
}

// Builds the column definitions for the pods table. `figures` maps each pod
// (namespace/name) to its raw CPU/memory usage and request figures (from the cluster
// Performance snapshot); `mode`/`format` are the shared view-mode and value-format toggle
// state. The CPU and Memory columns render an inline ResourceBarCell whose percentage base
// is the pod's own request (usage mode) or the request itself (requests mode), and a Status
// column shows a StatusBadge grading the usage ratio. All three read mode/format so a toggle
// re-derives every cell.
function buildColumns(figures: PodFiguresMap, mode: ViewMode, format: ValueFormat): ColumnDef<Pod>[] {
    const cols: ColumnDef<Pod>[] = [];

    cols.push(
        {
            accessorKey: "name",
            header: "Name",
        },
        {
            accessorKey: "namespace",
            header: "Namespace",
            // The pod's namespace links to its own detail page. The row navigates to the
            // pod, so the link stops its click from bubbling up to the row.
            cell: (info) => (
                <span onClick={(e) => e.stopPropagation()}>
                    <ResourceRef kind="Namespace" name={info.getValue<string>()} testId="pod-row-namespace-link" />
                </span>
            ),
        },
    );

    cols.push(
        {
            accessorKey: "phase",
            header: "Status",
            cell: (info) => <PhaseChip phase={info.getValue<PodPhase>()} />,
            sortingFn: (a, b) =>
                PHASE_ORDER[a.original.phase] - PHASE_ORDER[b.original.phase],
            // Keeps a row only when its phase is among the values ticked in the shared
            // filter editor. An empty selection clears this filter, so every row shows.
            filterFn: valueColumnFilterFn,
        },
        {
            accessorKey: "ready",
            header: "Ready",
        },
        {
            accessorKey: "containerCount",
            header: "Containers",
            cell: (info) => (
                <span data-test-id="pod-container-count">{info.getValue<number>()}</span>
            ),
        },
        {
            accessorKey: "restarts",
            header: "Restarts",
        },
        {
            accessorKey: "node",
            header: "Node",
            // The node the pod runs on links to that node's detail page. An unscheduled
            // pod has no node, so the reference degrades to plain text.
            cell: (info) => (
                <span onClick={(e) => e.stopPropagation()}>
                    <ResourceRef kind="Node" name={info.getValue<string>()} testId="pod-row-node-link" />
                </span>
            ),
        },
        {
            // Pod CPU utilisation as an inline bar. The percentage base is the pod's own
            // request (usage mode: usage ÷ request; requests mode: the request as a full
            // bar), from the cluster Performance snapshot. Sorts by that percentage via
            // comparePodCells in whichever mode is active.
            id: "cpu",
            header: "CPU",
            accessorFn: (row) => podCpuCell(podFiguresFor(figures, row.namespace, row.name), mode, format).sortValue,
            cell: (info) => {
                const cell = podCpuCell(podFiguresFor(figures, info.row.original.namespace, info.row.original.name), mode, format);
                return <ResourceBarCell percent={cell.percent} displayText={cell.displayText} level={cell.level} testId="pod-cpu" />;
            },
            sortingFn: (a, b) =>
                comparePodCells(
                    podCpuCell(podFiguresFor(figures, a.original.namespace, a.original.name), mode, format),
                    podCpuCell(podFiguresFor(figures, b.original.namespace, b.original.name), mode, format),
                ),
            enableGlobalFilter: false,
        },
        {
            // Pod memory utilisation as an inline bar, base the pod's own request (as CPU
            // above). Sorts by that percentage via comparePodCells in the active mode.
            id: "memory",
            header: "Memory",
            accessorFn: (row) => podMemoryCell(podFiguresFor(figures, row.namespace, row.name), mode, format).sortValue,
            cell: (info) => {
                const cell = podMemoryCell(podFiguresFor(figures, info.row.original.namespace, info.row.original.name), mode, format);
                return <ResourceBarCell percent={cell.percent} displayText={cell.displayText} level={cell.level} testId="pod-memory" />;
            },
            sortingFn: (a, b) =>
                comparePodCells(
                    podMemoryCell(podFiguresFor(figures, a.original.namespace, a.original.name), mode, format),
                    podMemoryCell(podFiguresFor(figures, b.original.namespace, b.original.name), mode, format),
                ),
            enableGlobalFilter: false,
        },
        {
            // CPU utilisation status badge, grading the pod's CPU usage ÷ request ratio
            // (over-reserving / under-provisioned / OK) via classifyPodUsageRow inside
            // podCpuCell. Shown only in usage mode — requests mode has no ratio to grade, so
            // the cell is empty there. Sorts by the same percentage as the CPU bar.
            id: "utilization",
            header: "Utilization",
            accessorFn: (row) => podCpuCell(podFiguresFor(figures, row.namespace, row.name), mode, format).sortValue,
            cell: (info) => {
                if (mode === "requests") {
                    return null;
                }
                const cell = podCpuCell(podFiguresFor(figures, info.row.original.namespace, info.row.original.name), mode, format);
                if (cell.level === "info") {
                    return <span data-test-id="pod-status-badge-empty">—</span>;
                }
                return <StatusBadge label={cell.statusLabel} level={cell.level} />;
            },
            sortingFn: (a, b) =>
                comparePodCells(
                    podCpuCell(podFiguresFor(figures, a.original.namespace, a.original.name), mode, format),
                    podCpuCell(podFiguresFor(figures, b.original.namespace, b.original.name), mode, format),
                ),
            enableGlobalFilter: false,
        },
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
            cell: (info) => <LabelsCell labels={info.row.original.labels} resourceKind="Pod" resourceName={info.row.original.name} />,
            enableSorting: false,
            // Keeps a row only when its labels satisfy the shared editor's label
            // selection. An empty selection clears this filter, so every row passes.
            filterFn: labelsColumnFilterFn,
        },
        {
            // Hidden column carrying each pod's derived health ("Healthy"/"Error"/
            // "Other") so the health filter can narrow rows. Never rendered (hidden via
            // columnVisibility) and excluded from the fuzzy global filter.
            id: "health",
            accessorFn: (row) => podHealth(row),
            filterFn: valueColumnFilterFn,
            enableSorting: false,
            enableGlobalFilter: false,
            // Excluded from the column-config modal: it is an always-hidden filter helper, never shown.
            enableHiding: false,
        },
    );

    return cols;
}

// Sortable, filterable table of Kubernetes pods for the active context.
// When a namespace is selected it scopes the query; otherwise shows all namespaces.
// The Namespace column is always rendered regardless of the active namespace.
// Wraps the table in a ResourceUtilizationProvider so its View-mode / Value-format toggles
// drive the CPU/Memory bar columns; the inner component consumes that shared state.
export function PodsTable() {
    return (
        <ResourceUtilizationProvider>
            <PodsTableInner />
        </ResourceUtilizationProvider>
    );
}

function PodsTableInner() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();
    const [searchParams] = useSearchParams();
    const { mode, format } = useResourceUtilization();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["pods", current, namespace],
        queryFn: () => fetchPods(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    // Per-pod CPU/memory usage and request figures for the resource bar columns. Sourced
    // from the cluster-wide Performance snapshot (the pods list response carries no usage),
    // which carries each pod's usage and its summed requests so the bar can express usage as
    // a percentage of the pod's own request (usage mode) or show the request itself
    // (requests mode). Keyed by context only. A failed/absent metrics fetch leaves the map
    // empty, so the columns show em-dashes rather than breaking the table.
    const { data: performance } = useQuery({
        queryKey: ["cluster-performance", current],
        queryFn: () => fetchClusterPerformance(current!),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();

    // The figures map and the columns it builds are memoised because the column definitions are
    // what identify a row's cells: rebuilding them on every render would give every row new cells
    // and defeat the row memoisation below, so a keystroke would re-render the whole table again.
    const figuresMap = useMemo(() => buildPodFiguresMap(performance?.pods ?? []), [performance]);
    const columns = useMemo(() => buildColumns(figuresMap, mode, format), [figuresMap, mode, format]);
    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("pods", columns);

    // Health is a filter-only column and is never shown, but the object saying so must keep its
    // identity across renders, or TanStack rebuilds every row's visible-cell list each render.
    const visibility = useMemo(() => ({
        ...columnVisibility,
        health: false,
    }), [columnVisibility]);

    const openPod = useCallback((pod: Pod) => {
        navigate(`/pods/${pod.namespace}/${pod.name}`);
    }, [navigate]);

    // The filterable columns the shared editor offers: the Status (phase) and
    // Health value columns plus one column per label key present on the loaded pods.
    // Memoised on the data: collecting the label columns walks every pod, and doing that on every
    // render would put the whole list back on the keystroke path.
    const allPods = data?.pods ?? [];
    const filterableColumns: FilterableColumn[] = useMemo(() => [
        { columnId: "phase", label: "Status", options: ALL_PHASES, kind: "value" },
        { columnId: "health", label: "Health", options: HEALTH_FILTER_OPTIONS, kind: "value" },
        ...collectLabelColumns(allPods),
    ], [allPods]);
    const filter = useTableFilter(filterableColumns, initialPhaseSelection(searchParams.get("phase")));

    // The stats header sums the whole list too, so it is memoised for the same reason.
    const stats = useMemo(() => computePodStats(allPods), [allPods]);

    const table = useReactTable({
        data: data?.pods ?? [],
        columns,
        state: {
            sorting,
            globalFilter: deferredSearch,
            columnFilters: filter.columnFilters,
            columnOrder,
            columnVisibility: visibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearch,
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
            <ResourceStatsHeader stats={stats} testIdPrefix="pods" />
            <div className="flex flex-row gap-2 items-center">
                <TextField
                    size="small"
                    placeholder="Search pods..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-test-id="pods-search"
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
                    testIdPrefix="pods-filter"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
                <ViewToggles />
            </div>
            <TableContainer component={Paper} data-test-id="pods-table">
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
                        {rows.length === 0 && allPods.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-pods-empty">No pods.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && allPods.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-pods-match">No pods match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        <DataTableRows
                            rows={rows}
                            visibleColumns={table.getVisibleLeafColumns()}
                            testId="pod-row"
                            clickable={true}
                            onOpen={openPod}
                        />
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
