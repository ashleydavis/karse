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
    Chip,
    TextField,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faTriangleExclamation, faSortUp, faSortDown, faSort, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { ClusterError } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { fetchErrors } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { TypeFilter } from "../../../components/type-filter";
import { typeColumnFilterFn, makeTypeFilterController } from "../../../lib/type-filter-state";
import { LoadError } from "../../../components/load-error";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";

// The distinct error types (reasons) present in the data, in display order
// (alphabetical). These are the checkboxes offered by the type filter.
function distinctReasons(errors: ClusterError[]): string[] {
    const seen = new Set<string>();
    for (const e of errors) {
        seen.add(e.reason);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
}

// Formats a Kubernetes timestamp into a human-readable age string.
function formatAge(lastSeen: string): string {
    if (lastSeen === "") {
        return "-";
    }
    const ms = Date.now() - new Date(lastSeen).getTime();
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

// Renders a colored MUI Chip indicating where an error originated.
function SourceChip({ source }: { source: ClusterError["source"] }) {
    if (source === "Pod") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleExclamation} />}
                label="Pod"
                color="error"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            label="Event"
            color="warning"
            size="small"
        />
    );
}

// Column definitions for the errors table.
const columns: ColumnDef<ClusterError>[] = [
    {
        id: "lastSeen",
        accessorKey: "lastSeen",
        header: "Age",
        cell: (info) => formatAge(info.getValue<string>()),
        sortingFn: (a, b) =>
            new Date(a.original.lastSeen).getTime() - new Date(b.original.lastSeen).getTime(),
    },
    {
        accessorKey: "source",
        header: "Source",
        cell: (info) => <SourceChip source={info.getValue<ClusterError["source"]>()} />,
    },
    {
        id: "object",
        header: "Object",
        accessorFn: (row) => `${row.objectKind}/${row.objectName}`,
        cell: (info) => info.getValue<string>(),
    },
    { accessorKey: "reason", header: "Reason", filterFn: typeColumnFilterFn },
    { accessorKey: "message", header: "Message" },
    { accessorKey: "count", header: "Count" },
    { accessorKey: "namespace", header: "Namespace" },
];

// Sortable, filterable table of error conditions occurring in the cluster for the
// active context. Combines Warning events and problem pods returned by GET /api/errors.
// When a namespace is selected it scopes the query; otherwise shows errors across
// all namespaces. Rows are returned newest-first by the backend.
export function ErrorsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["errors", current, namespace],
        queryFn: () => fetchErrors(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    // The checked error types live in the table's "reason" column filter; an
    // empty selection means "show all" (the default).
    const typeFilterController = makeTypeFilterController("reason", columnFilters, setColumnFilters);

    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("errors", columns);

    const table = useReactTable({
        data: data?.errors ?? [],
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters,
            columnOrder,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: "includesString",
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading) {
        return <LoadingIndicator />;
    }

    const rows = table.getRowModel().rows;
    const all = data?.errors ?? [];
    const allReasons = distinctReasons(all);

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
            <div className="flex flex-row gap-2 items-center">
                <TextField
                    size="small"
                    placeholder="Search errors..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="errors-search"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />
                <TypeFilter
                    all={allReasons}
                    selected={typeFilterController.selected}
                    onChange={typeFilterController.setSelected}
                    label="Type"
                    testIdPrefix="errors-type-filter"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
            </div>
            <TableContainer component={Paper} data-test-id="errors-table">
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
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-errors-empty">No errors.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-errors-match">No errors match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.id} data-test-id="error-row">
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
