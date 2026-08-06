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
import type { ClusterSummary } from "karse-types";
import { DataTableRows } from "../../../components/data-table-row";
import { SearchBox } from "../../../components/search-box";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { ResourceBarCell } from "../../../components/resource-utilization/resource-bar-cell";
import { useResourceUtilization } from "../../../lib/resource-utilization-context";
import {
    clusterPercent,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    classifyNodeRow,
} from "../../../lib/resource-utilization";

// Props for the per-cluster table: the summaries streamed in so far and the row
// click-through that makes a cluster's context active.
type Props = {
    clusters: ClusterSummary[];
    onOpen: (summary: ClusterSummary) => void;
};

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
    const totals = summary.totals;
    const used = metric === "cpu"
        ? (mode === "usage" ? totals.usage.cpuMillicores : totals.requests.cpuMillicores)
        : (mode === "usage" ? totals.usage.memoryBytes : totals.requests.memoryBytes);
    const base = metric === "cpu" ? totals.allocatable.cpuMillicores : totals.allocatable.memoryBytes;
    const percent = clusterPercent(used, base);
    const formatAbsolute = metric === "cpu" ? formatAbsoluteCpu : formatAbsoluteMemory;
    const displayText = percent === null
        ? "—"
        : (format === "percent" ? `${percent}%` : formatAbsolute(used, base));
    return (
        <ResourceBarCell
            percent={percent}
            displayText={displayText}
            level={classifyNodeRow(percent).level}
            testId={testId}
        />
    );
}

// The per-cluster table on the multi-cluster overview: one row per configured
// kubeconfig context with its node count and its own CPU and memory utilisation,
// searchable and sortable through the shared table machinery. A context that could not
// be reached renders as an error row naming the reason instead of its figures.
// Clicking a row makes that context active and opens its cluster home page.
export function ClustersTable({ clusters, onOpen }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();

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
                        <DataTableRows
                            rows={rows}
                            visibleColumns={table.getVisibleLeafColumns()}
                            testId="cluster-row"
                            clickable
                            onOpen={onOpen}
                        />
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
