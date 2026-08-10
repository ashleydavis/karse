import { Fragment, useState } from "react";
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
import type { ClusterSummary, ClusterResourceTotals, MultiClusterTotals } from "karse-types";
import { DataTableRows } from "../../../components/data-table-row";
import { SearchBox } from "../../../components/search-box";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { ResourceBarCell } from "../../../components/resource-utilization/resource-bar-cell";
import { useResourceUtilization } from "../../../lib/resource-utilization-context";
import { useConfig } from "../../../lib/config";
import { groupClustersByEnvironment } from "../../../lib/cluster-environment-groups";
import {
    clusterPercent,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    classifyNodeRow,
    type ViewMode,
    type ValueFormat,
} from "../../../lib/resource-utilization";

// Props for the per-cluster table: the summaries streamed in so far and the row
// click-through that makes a cluster's context active.
type Props = {
    clusters: ClusterSummary[];
    onOpen: (summary: ClusterSummary) => void;
};

// One CPU or memory reading as the table displays it: the percentage derived from the
// summed absolutes, plus the text the current Usage/Requests and %/Absolute toggles ask
// for. A null percentage (no usage reading, or a cluster that could not be read) reads as
// an em-dash rather than a fabricated zero.
//
// Both a single cluster's row and an environment's group heading go through this, so a
// section's figures are formatted exactly like the rows underneath it.
function utilizationDisplay(
    totals: ClusterResourceTotals,
    metric: "cpu" | "memory",
    mode: ViewMode,
    format: ValueFormat,
): {
    percent: number | null;
    text: string;
} {
    const used = metric === "cpu"
        ? (mode === "usage" ? totals.usage.cpuMillicores : totals.requests.cpuMillicores)
        : (mode === "usage" ? totals.usage.memoryBytes : totals.requests.memoryBytes);
    const base = metric === "cpu" ? totals.allocatable.cpuMillicores : totals.allocatable.memoryBytes;
    const percent = clusterPercent(used, base);
    const formatAbsolute = metric === "cpu" ? formatAbsoluteCpu : formatAbsoluteMemory;
    return {
        percent,
        text: percent === null
            ? "—"
            : (format === "percent" ? `${percent}%` : formatAbsolute(used, base)),
    };
}

// Renders one cluster's CPU or memory utilisation as the same bar cell the nodes and
// pods tables use, driven by the shared Usage/Requests and %/Absolute toggles. An
// errored cluster, or a cluster with no usage reading, shows an empty bar and an
// em-dash rather than a fabricated zero.
function UtilizationCell({
    summary,
    metric,
    testId,
}: {
    summary: ClusterSummary;
    metric: "cpu" | "memory";
    testId: string;
}) {
    const { mode, format } = useResourceUtilization();
    const { percent, text } = utilizationDisplay(summary.totals, metric, mode, format);
    return (
        <ResourceBarCell
            percent={percent}
            displayText={text}
            level={classifyNodeRow(percent).level}
            testId={testId}
        />
    );
}

// The heading row that opens one environment's section of the table: the environment's
// name, how many clusters it holds, their summed node count, and their aggregate CPU and
// memory. Every figure comes from the group's MultiClusterTotals, which aggregateClusters
// produced from absolute sums, so a section reads exactly like the page's grand total.
//
// When some of the environment's clusters could not be read, the heading says how many of
// them the numbers cover, because the unreadable ones contribute nothing to the totals and
// a section over 1 of 2 clusters must not be readable as covering both.
function EnvironmentGroupHeading({
    environment,
    label,
    totals,
    colSpan,
}: {
    environment: string;
    label: string;
    totals: MultiClusterTotals;
    colSpan: number;
}) {
    const { mode, format } = useResourceUtilization();
    const cpu = utilizationDisplay(totals.totals, "cpu", mode, format);
    const memory = utilizationDisplay(totals.totals, "memory", mode, format);
    return (
        <TableRow data-test-id="cluster-environment-group" data-environment={environment}>
            <TableCell colSpan={colSpan} sx={{ bgcolor: "action.hover" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Typography component="span" variant="subtitle2" data-test-id="cluster-environment-group-label">
                        {label}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary" data-test-id="cluster-environment-group-clusters">
                        {totals.contextCount === 1 ? "1 cluster" : `${totals.contextCount} clusters`}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary" data-test-id="cluster-environment-group-nodes">
                        {totals.nodeCount === 1 ? "1 node" : `${totals.nodeCount} nodes`}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary" data-test-id="cluster-environment-group-cpu">
                        {`CPU ${cpu.text}`}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary" data-test-id="cluster-environment-group-memory">
                        {`Memory ${memory.text}`}
                    </Typography>
                    {totals.failedCount > 0 && (
                        <Typography component="span" variant="body2" color="error" data-test-id="cluster-environment-group-coverage">
                            {`Covers ${totals.coveredCount} of ${totals.contextCount} clusters`}
                        </Typography>
                    )}
                </span>
            </TableCell>
        </TableRow>
    );
}

// The per-cluster table on the multi-cluster overview: one row per configured
// kubeconfig context with its node count and its own CPU and memory utilisation,
// searchable and sortable through the shared table machinery. A context that could not
// be reached renders as an error row naming the reason instead of its figures.
// Clicking a row makes that context active and opens its cluster home page.
//
// The rows are broken into environment sections, each headed by that environment's own
// cluster count, node count and utilisation. Relabelling a context on the contexts page
// rewrites the labels this reads from the shared config, so a cluster and its numbers move
// to the new environment's section on the next render, with no restart.
export function ClustersTable({ clusters, onOpen }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();
    const { config: { contextEnvironments } } = useConfig();

    const columns: ColumnDef<ClusterSummary>[] = [
        {
            accessorKey: "context",
            header: "Context",
        },
        {
            accessorKey: "cluster",
            header: "Cluster",
        },
        {
            accessorKey: "nodeCount",
            header: "Nodes",
            cell: (info) => {
                const count = info.getValue<number | null>();
                if (count === null) {
                    return <Typography component="span" color="text.secondary" variant="body2">—</Typography>;
                }
                return <span data-test-id="cluster-row-nodes">{count}</span>;
            },
        },
        {
            id: "cpu",
            header: "CPU",
            enableSorting: false,
            cell: (info) => {
                const summary = info.row.original;
                if (summary.error !== null) {
                    return <Typography component="span" color="text.secondary" variant="body2">—</Typography>;
                }
                return <UtilizationCell summary={summary} metric="cpu" testId="cluster-row-cpu" />;
            },
        },
        {
            id: "memory",
            header: "Memory",
            enableSorting: false,
            cell: (info) => {
                const summary = info.row.original;
                if (summary.error !== null) {
                    return <Typography component="span" color="text.secondary" variant="body2">—</Typography>;
                }
                return <UtilizationCell summary={summary} metric="memory" testId="cluster-row-memory" />;
            },
        },
        {
            accessorKey: "error",
            header: "Status",
            cell: (info) => {
                const error = info.getValue<string | null>();
                if (error === null) {
                    return <Typography component="span" color="text.secondary" variant="body2">Reachable</Typography>;
                }
                return (
                    <Typography component="span" color="error" variant="body2" data-test-id="cluster-row-error">
                        {error}
                    </Typography>
                );
            },
        },
    ];

    const table = useReactTable({
        data: clusters,
        columns,
        state: {
            sorting,
            globalFilter: deferredSearch,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearch,
        // No pagination row model is installed (every matching row is rendered, bounded only
        // by DataTableRows' render limit), so the page index is meaningless here, and letting
        // TanStack reset it on every rebuilt row model would write state and loop.
        autoResetPageIndex: false,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    const rows = table.getRowModel().rows;

    // The rows the table would render, split into environment sections in the fixed
    // ENVIRONMENT_ORDER (production first, unassigned last) with each section's aggregate
    // figures. Sorting and searching run over the whole table first, so a section holds the
    // rows that survived them, in the sorted order, and its figures describe exactly the
    // clusters shown under it. With no search active that is every cluster, so the sections
    // add up to the "Across all clusters" totals above the table.
    const groups = groupClustersByEnvironment(rows, (row) => row.original, contextEnvironments);

    // The sort affordance in a column header: which way the column is currently sorted,
    // or the neutral icon when it is not.
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
            <SearchBox
                placeholder="Search clusters..."
                value={search}
                onChange={setSearch}
                testId="clusters-search"
            />
            <TableContainer component={Paper} data-test-id="clusters-table">
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
                        {rows.length === 0 && clusters.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-clusters-match">
                                        No clusters match the search.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {groups.map((group) => (
                            <Fragment key={group.environment}>
                                <EnvironmentGroupHeading
                                    environment={group.environment}
                                    label={group.label}
                                    totals={group.totals}
                                    colSpan={table.getVisibleLeafColumns().length}
                                />
                                <DataTableRows
                                    rows={group.items}
                                    visibleColumns={table.getVisibleLeafColumns()}
                                    testId="cluster-row"
                                    clickable
                                    onOpen={onOpen}
                                />
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
