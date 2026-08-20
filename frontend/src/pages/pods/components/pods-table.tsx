import { useCallback, useState } from "react";
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
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCirclePause, faCircleQuestion, faCircleXmark, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
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
import { valueColumnFilterFn, labelsColumnFilterFn, collectLabelColumns, type FilterableColumn } from "../../../lib/table-filter-state";
import { useTableFilter } from "../../../lib/use-table-filter";
import { podOomKilledValue, seedSelection } from "../../../lib/list-filter-seeds";
import { LabelsCell } from "../../../components/labels-cell";
import { CopyNameCell } from "../../../components/copy-button";
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
import { Timestamp } from "../../../components/timestamp";
import { SearchBox } from "../../../components/search-box";

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

// The two values of the OOMKilled filter column: whether the pod records a previous
// container termination with reason OOMKilled. The flag comes from the pods API (Pod
// .oomKilled), computed by the same rule as the cluster OOMKills health counter, so the
// tile's number and the rows this filter leaves are the same pods.
const OOM_KILLED_OPTIONS = ["Yes", "No"];

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
            // The pod name is a resource name, so it carries the two-form copy menu.
            cell: (info) => (
                <CopyNameCell
                    segments={[info.row.original.namespace, info.row.original.name]}
                    label="pod name"
                    testId="pod-row-name-copy"
                />
            ),
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
            // Hidden column carrying whether the pod was previously OOM-killed ("Yes"/
            // "No"), so the OOMKilled filter can narrow rows to exactly the pods the
            // cluster OOMKills tile counted. Never rendered (hidden via columnVisibility)
            // and excluded from the fuzzy global filter.
            id: "oomKilled",
            accessorFn: (row) => podOomKilledValue(row),
            filterFn: valueColumnFilterFn,
            enableSorting: false,
            enableGlobalFilter: false,
            // Excluded from the column-config modal: it is an always-hidden filter helper, never shown.
            enableHiding: false,
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

    const figuresMap = buildPodFiguresMap(performance?.pods ?? []);
    const columns = buildColumns(figuresMap, mode, format);
    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("pods", columns);

    // Health and OOMKilled are filter-only columns and are never shown.
    const visibility = {
        ...columnVisibility,
        health: false,
        oomKilled: false,
    };

    const openPod = useCallback((pod: Pod) => {
        navigate(`/pods/${pod.namespace}/${pod.name}`);
    }, [navigate]);

    // The filterable columns the shared editor offers: the Status (phase), Health and
    // OOMKilled value columns plus one column per label key present on the loaded pods.
    const allPods = data?.pods ?? [];
    const filterableColumns: FilterableColumn[] = [
        { columnId: "phase", label: "Status", options: ALL_PHASES, kind: "value" },
        { columnId: "health", label: "Health", options: HEALTH_FILTER_OPTIONS, kind: "value" },
        { columnId: "oomKilled", label: "OOMKilled", options: OOM_KILLED_OPTIONS, kind: "value" },
        ...collectLabelColumns(allPods),
    ];
    // The initial selection seeded from the URL, so a count on the Cluster Overview opens
    // this list already narrowed to the pods it counted: `?phase=` from the POD STATUS
    // counts, `?oomKilled=` from the OOMKills health tile. Read once at mount; afterwards
    // the selection belongs to the user. Only one param is ever set by a link, but merging
    // them keeps a hand-written URL carrying both working.
    const filter = useTableFilter(filterableColumns, {
        ...seedSelection("phase", searchParams.get("phase"), ALL_PHASES),
        ...seedSelection("oomKilled", searchParams.get("oomKilled"), OOM_KILLED_OPTIONS),
    });

    const stats = computePodStats(allPods);

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
        // No pagination row model is installed (every matching row is rendered, bounded only by
        // DataTableRows' render limit), so the page index is meaningless here. TanStack would
        // otherwise reset it whenever a row model is rebuilt, and since the row-model inputs are
        // rebuilt on every render that reset would write table state, re-render, and loop.
        autoResetPageIndex: false,
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
                <SearchBox
                    placeholder="Search pods..."
                    value={search}
                    onChange={setSearch}
                    testId="pods-search"
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
