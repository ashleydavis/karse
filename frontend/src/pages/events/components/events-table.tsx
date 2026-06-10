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
    Chip,
    TextField,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo, faMagnifyingGlass, faSort, faSortDown, faSortUp, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { ClusterEvent } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { fetchEvents } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { TableFilter } from "../../../components/table-filter";
import { valueColumnFilterFn, type FilterableColumn } from "../../../lib/table-filter-state";
import { useTableFilter } from "../../../lib/use-table-filter";
import { LoadError } from "../../../components/load-error";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";
import { useShareableNavigate } from "../../../lib/nav-state";
import { tableRowSx } from "../../../lib/table-row-style";

// Every selectable event type, in display order. Drives the type column in the
// shared filter editor.
const ALL_EVENT_TYPES: ClusterEvent["type"][] = ["Warning", "Normal"];

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

// Renders a colored MUI Chip for an event type value.
function TypeChip({ type }: { type: ClusterEvent["type"] }) {
    if (type === "Warning") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
                label="Warning"
                color="warning"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={faCircleInfo} />}
            label="Normal"
            color="default"
            size="small"
        />
    );
}

// Sort order for event types: Warning first so problems surface at the top.
const TYPE_ORDER: Record<ClusterEvent["type"], number> = {
    Warning: 0,
    Normal: 1,
};

// Column definitions for the events table.
const columns: ColumnDef<ClusterEvent>[] = [
    {
        id: "lastSeen",
        accessorKey: "lastSeen",
        header: "Last seen",
        cell: (info) => formatAge(info.getValue<string>()),
        sortingFn: (a, b) =>
            new Date(a.original.lastSeen).getTime() - new Date(b.original.lastSeen).getTime(),
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: (info) => <TypeChip type={info.getValue<ClusterEvent["type"]>()} />,
        sortingFn: (a, b) =>
            TYPE_ORDER[a.original.type] - TYPE_ORDER[b.original.type],
        // Keeps a row only when its type is among the values ticked in the shared
        // filter editor. An empty selection clears this filter, so every row shows.
        filterFn: valueColumnFilterFn,
    },
    { accessorKey: "reason", header: "Reason" },
    {
        id: "object",
        header: "Object",
        accessorFn: (row) => `${row.objectKind}/${row.objectName}`,
        cell: (info) => info.getValue<string>(),
    },
    { accessorKey: "message", header: "Message" },
    { accessorKey: "count", header: "Count" },
    { accessorKey: "namespace", header: "Namespace" },
];

// Sortable, filterable table of Kubernetes events for the active context.
// When a namespace is selected it scopes the query; otherwise shows events across
// all namespaces. Warnings are sorted to the top when sorting by type.
export function EventsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["events", current, namespace],
        queryFn: () => fetchEvents(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    // The filterable columns the shared editor offers: the Type value column. An
    // empty selection means "show all" (the default); the filter activates on the
    // first tick.
    const filterableColumns: FilterableColumn[] = [
        { columnId: "type", label: "Type", options: ALL_EVENT_TYPES, kind: "value" },
    ];
    const filter = useTableFilter(filterableColumns);

    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("events", columns);

    const table = useReactTable({
        data: data?.events ?? [],
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters: filter.columnFilters,
            columnOrder,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
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
    const all = data?.events ?? [];

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
                    placeholder="Search events..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="events-search"
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
                    testIdPrefix="events-filter"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
            </div>
            <TableContainer component={Paper} data-test-id="events-table">
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
                                    <Typography color="text.secondary" data-test-id="no-events-empty">No events.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-events-match">No events match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="event-row"
                                onClick={() => navigate(`/events/${encodeURIComponent(row.original.uid)}`)}
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
