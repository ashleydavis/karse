import { useState } from "react";
import { useShareableNavigate } from "../../../lib/nav-state";
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
import { faCircleCheck, faCircleQuestion, faCircleXmark, faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { Node, NodeStatus } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { fetchNodes, fetchClusterPerformance } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { TableFilter } from "../../../components/table-filter";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { valueColumnFilterFn, labelsColumnFilterFn, collectLabelColumns, type FilterableColumn } from "../../../lib/table-filter-state";
import { useTableFilter } from "../../../lib/use-table-filter";
import { LabelsCell } from "../../../components/labels-cell";
import { labelsToPairs } from "../../../components/labels-cell-pairs";
import { ResourceStatsHeader } from "../../../components/resource-stats-header";
import { computeNodeStats, nodeHealth, HEALTH_FILTER_OPTIONS } from "../../../lib/resource-stats";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";
import { formatPercent, compareUsageValue } from "../../../lib/node-usage-sort";
import {
    buildNodeUtilizationMap,
    nodeUtilizationFor,
    cpuFigureFor,
    memoryFigureFor,
    compareNodeCpuMode,
    compareNodeMemoryMode,
    type NodeUtilizationMap,
    type UtilizationFigure,
} from "../../../lib/node-utilization";
import {
    classifyNodeRow,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    type ValueFormat,
} from "../../../lib/resource-utilization";
import {
    ResourceUtilizationProvider,
    useResourceUtilization,
} from "../../../lib/resource-utilization-context";
import { ResourceBarCell } from "../../../components/resource-utilization/resource-bar-cell";
import { ViewToggles } from "../../../components/resource-utilization/view-toggles";
import { StatusBadge } from "../../../components/resource-utilization/status-badge";
import type { ViewMode } from "../../../lib/resource-utilization";

function formatAge(createdAt: string): string {
    const ms = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

function StatusChip({ status }: { status: NodeStatus }) {
    if (status === "Ready") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label="Ready"
                color="success"
                size="small"
            />
        );
    }
    if (status === "NotReady") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleXmark} />}
                label="NotReady"
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

const STATUS_ORDER: Record<NodeStatus, number> = { Ready: 0, NotReady: 1, Unknown: 2 };

// All selectable node statuses, in display order, for the status filter dropdown.
const ALL_STATUSES: NodeStatus[] = ["Ready", "NotReady", "Unknown"];

// The display text for a CPU bar cell: a percent of allocatable in percent format, or a
// "used / total vCPU" pair in absolute format. The bar always fills to the percent.
function cpuDisplayText(figure: UtilizationFigure, format: ValueFormat): string {
    return format === "absolute"
        ? formatAbsoluteCpu(figure.used, figure.total)
        : formatPercent(figure.percent);
}

// The display text for a memory bar cell: a percent of allocatable, or a "used / total GB"
// pair in absolute format.
function memoryDisplayText(figure: UtilizationFigure, format: ValueFormat): string {
    return format === "absolute"
        ? formatAbsoluteMemory(figure.used, figure.total)
        : formatPercent(figure.percent);
}

// Builds the column definitions for the nodes table. `util` maps each node (by name) to its
// CPU/memory utilisation in both View modes; `mode` and `format` come from the shared
// resource-utilization toggle and pick which base (usage vs requests) and which display
// (percent vs absolute) the CPU/Memory bar columns and the Status badge use.
function buildColumns(util: NodeUtilizationMap, mode: ViewMode, format: ValueFormat): ColumnDef<Node>[] {
    return [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: (info) => <StatusChip status={info.getValue<NodeStatus>()} />,
        sortingFn: (a, b) =>
            STATUS_ORDER[a.original.status] - STATUS_ORDER[b.original.status],
        // Keeps a row only when its status is among the values ticked in the shared
        // filter editor. An empty selection clears this filter, so every row shows.
        filterFn: valueColumnFilterFn,
    },
    {
        accessorKey: "roles",
        header: "Roles",
        cell: (info) => {
            const roles = info.getValue<string[]>();
            return roles.length > 0 ? roles.join(", ") : "<none>";
        },
        sortingFn: (a, b) => {
            const ra = a.original.roles.join(", ") || "<none>";
            const rb = b.original.roles.join(", ") || "<none>";
            return ra.localeCompare(rb);
        },
    },
    {
        accessorKey: "version",
        header: "Version",
    },
    {
        // Node-level status badge: classifies the node by its active-mode CPU figure (usage
        // ÷ allocatable, or requests ÷ allocatable) via the shared classifier, so the badge
        // tracks the same base as the bars. Sorts by that percent; an em-dash node sorts low.
        id: "node-status-badge",
        header: "Utilization",
        accessorFn: (row) => cpuFigureFor(nodeUtilizationFor(util, row.name), mode).percent,
        // Re-derive from the live util map in the cell (rather than info.getValue(), whose
        // accessor result TanStack memoises per row) so the badge updates when the Performance
        // snapshot arrives or the View mode changes, matching the bar cells below.
        cell: (info) => {
            const percent = cpuFigureFor(nodeUtilizationFor(util, info.row.original.name), mode).percent;
            const result = classifyNodeRow(percent);
            return <StatusBadge label={result.label} level={result.level} />;
        },
        sortingFn: (a, b) =>
            compareUsageValue(
                cpuFigureFor(nodeUtilizationFor(util, a.original.name), mode).percent,
                cpuFigureFor(nodeUtilizationFor(util, b.original.name), mode).percent,
            ),
        enableGlobalFilter: false,
    },
    {
        // Node CPU as a bar of its own allocatable, in the active View mode (usage or
        // requests) and Value format (percent or absolute "used / total vCPU"). The bar fills
        // to the percent; an em-dash node renders an empty bar. Sorts by the mode's percent.
        id: "cpu",
        header: "CPU",
        accessorFn: (row) => cpuFigureFor(nodeUtilizationFor(util, row.name), mode).percent,
        cell: (info) => {
            const figure = cpuFigureFor(nodeUtilizationFor(util, info.row.original.name), mode);
            return (
                <ResourceBarCell
                    percent={figure.percent}
                    displayText={cpuDisplayText(figure, format)}
                    level={classifyNodeRow(figure.percent).level}
                    testId="node-cpu"
                />
            );
        },
        sortingFn: (a, b) =>
            compareNodeCpuMode(
                nodeUtilizationFor(util, a.original.name),
                nodeUtilizationFor(util, b.original.name),
                mode,
            ),
        enableGlobalFilter: false,
    },
    {
        // Node memory as a bar of its own allocatable, in the active View mode and Value
        // format ("used / total GB" when absolute). Sorts by the mode's memory percent.
        id: "memory",
        header: "Memory",
        accessorFn: (row) => memoryFigureFor(nodeUtilizationFor(util, row.name), mode).percent,
        cell: (info) => {
            const figure = memoryFigureFor(nodeUtilizationFor(util, info.row.original.name), mode);
            return (
                <ResourceBarCell
                    percent={figure.percent}
                    displayText={memoryDisplayText(figure, format)}
                    level={classifyNodeRow(figure.percent).level}
                    testId="node-memory"
                />
            );
        },
        sortingFn: (a, b) =>
            compareNodeMemoryMode(
                nodeUtilizationFor(util, a.original.name),
                nodeUtilizationFor(util, b.original.name),
                mode,
            ),
        enableGlobalFilter: false,
    },
    {
        // The node's cloud instance type (from a node label), as a monospace caption. Nodes
        // without the label (e.g. kwok, docker-desktop) carry null, shown as an em-dash.
        id: "instanceType",
        header: "Instance Type",
        accessorFn: (row) => row.instanceType,
        cell: (info) => {
            const value = info.getValue<string | null>();
            return (
                <Typography
                    variant="caption"
                    data-test-id="node-instance-type"
                    sx={{ fontFamily: "monospace" }}
                >
                    {value ?? "—"}
                </Typography>
            );
        },
        sortingFn: (a, b) =>
            (a.original.instanceType ?? "").localeCompare(b.original.instanceType ?? ""),
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
        cell: (info) => <LabelsCell labels={info.row.original.labels} />,
        enableSorting: false,
        // Keeps a row only when its labels satisfy the shared editor's label
        // selection. An empty selection clears this filter, so every row passes.
        filterFn: labelsColumnFilterFn,
    },
    {
        // Hidden column carrying each node's derived health ("Healthy"/"Error"/
        // "Other") so the health filter can narrow rows. Never rendered (hidden via
        // columnVisibility) and excluded from the fuzzy global filter.
        id: "health",
        accessorFn: (row) => nodeHealth(row),
        filterFn: valueColumnFilterFn,
        enableSorting: false,
        enableGlobalFilter: false,
        // Excluded from the column-config modal: it is an always-hidden filter helper, never shown.
        enableHiding: false,
    },
    ];
}

// The nodes table body. Reads the shared View-mode / Value-format toggle from
// resource-utilization-context (so it must render inside a ResourceUtilizationProvider — the
// exported NodesTable below provides one), and drives the summary strip, bar columns, and
// status badge off the cluster Performance snapshot.
function NodesTableInner() {
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const { mode, format } = useResourceUtilization();
    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["cluster", "nodes", current],
        queryFn: () => fetchNodes(current!),
        enabled: current !== null,
    });

    // Per-node CPU/memory consumption for the resource columns. Sourced from the
    // cluster-wide Performance snapshot (the nodes list response carries no usage),
    // which carries each node's usage and its allocatable so usage can be expressed as
    // a percentage of the node. Keyed by context. A failed/absent metrics fetch leaves
    // the map empty, so the columns show em-dashes rather than breaking the table.
    const { data: performance } = useQuery({
        queryKey: ["cluster-performance", current],
        queryFn: () => fetchClusterPerformance(current!),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const utilizationMap = buildNodeUtilizationMap(performance?.nodes ?? []);
    const columns = buildColumns(utilizationMap, mode, format);

    // The filterable columns the shared editor offers: the Status and Health value
    // columns plus one column per label key present on the loaded nodes.
    const filterableColumns: FilterableColumn[] = [
        { columnId: "status", label: "Status", options: ALL_STATUSES, kind: "value" },
        { columnId: "health", label: "Health", options: HEALTH_FILTER_OPTIONS, kind: "value" },
        ...collectLabelColumns(data?.nodes ?? []),
    ];
    const filter = useTableFilter(filterableColumns);

    // The Roles column is hidden by default: on real single-distribution clusters
    // (e.g. docker-desktop) nodes carry no role labels, so it reads "<none>" and adds
    // little. The user can reveal it from the column config (drag it back to Visible).
    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("nodes", columns, ["roles"]);

    const table = useReactTable({
        // Pass a fresh array (not the stable React Query array) so TanStack rebuilds its row
        // model when usage arrives. TanStack memoises the row model and its per-cell value
        // cache on the data reference alone, not on columns; the CPU/Memory accessors close
        // over `usageMap`, so reusing the same data array after the cluster Performance
        // snapshot lands keeps showing the em-dash computed before it arrived.
        data: [...(data?.nodes ?? [])],
        columns,
        state: { sorting, globalFilter, columnFilters: filter.columnFilters, columnOrder, columnVisibility: { ...columnVisibility, health: false } },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
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
    const allNodes = data?.nodes ?? [];
    const stats = computeNodeStats(allNodes);

    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={faSortUp} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={faSortDown} />;
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <ResourceStatsHeader stats={stats} testIdPrefix="nodes" />
            <div className="flex flex-row gap-2 items-center">
                <ViewToggles />
                <TextField
                    size="small"
                    placeholder="Search nodes..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="nodes-search"
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
                    testIdPrefix="nodes-filter"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
            </div>
            <TableContainer component={Paper} data-test-id="nodes-table">
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
                        {rows.length === 0 && allNodes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-nodes-empty">No nodes.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && allNodes.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                                    <Typography color="text.secondary" data-test-id="no-nodes-match">No nodes match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="node-row"
                                onClick={() => navigate(`/nodes/${row.original.name}`)}
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

// The nodes table. Wraps the body in a ResourceUtilizationProvider so the View-mode /
// Value-format toggles, the bar columns, and the status badge all read one shared choice.
export function NodesTable() {
    return (
        <ResourceUtilizationProvider>
            <NodesTableInner />
        </ResourceUtilizationProvider>
    );
}
