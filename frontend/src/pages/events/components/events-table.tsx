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
import { ResourceRef } from "../../../components/resource-ref";
import { RowFilterMenu } from "../../../components/row-filter-menu";
import { ActiveRowFilters } from "../../../components/active-row-filters";
import { type EventFilter, applyEventFilters } from "../../../lib/event-filter";
import { useEventFilters } from "../../../lib/use-event-filters";
import { DataTableRows } from "../../../components/data-table-row";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { TimeRangeFilter } from "../../../components/time-range-filter";
import { DEFAULT_TIME_RANGE, timeRangeColumnFilters, timeRangeFilterFn, type TimeRange } from "../../../lib/time-range";
import { Timestamp } from "../../../components/timestamp";

// Every selectable event type, in display order. Drives the type column in the
// shared filter editor.
const ALL_EVENT_TYPES: ClusterEvent["type"][] = ["Warning", "Normal"];

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
        cell: (info) => <Timestamp value={info.getValue<string>()} />,
        sortingFn: (a, b) =>
            new Date(a.original.lastSeen).getTime() - new Date(b.original.lastSeen).getTime(),
        // Keeps a row only when its last-seen time falls inside the range chosen in
        // the shared time-range control. "All time" installs no filter at all, so
        // this never runs in that case.
        filterFn: timeRangeFilterFn,
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
        // The involved object links through to that resource's own detail page. The
        // row itself navigates to the event detail page, so the link stops its click
        // from bubbling up to the row. An involved object that cannot be resolved to
        // a detail page (a kind Karse has no page for) degrades to plain text.
        cell: ({ row, getValue }) => (
            <span onClick={(e) => e.stopPropagation()}>
                <ResourceRef
                    kind={row.original.objectKind}
                    name={row.original.objectName}
                    namespace={row.original.namespace}
                    label={getValue<string>()}
                    testId="event-row-object-link"
                />
            </span>
        ),
    },
    { accessorKey: "message", header: "Message" },
    { accessorKey: "count", header: "Count" },
    {
        accessorKey: "namespace",
        header: "Namespace",
        // The event's namespace links to its own detail page. The row navigates to the
        // event detail page, so the link stops its click from bubbling up to the row.
        cell: (info) => (
            <span onClick={(e) => e.stopPropagation()}>
                <ResourceRef kind="Namespace" name={info.getValue<string>()} testId="event-row-namespace-link" />
            </span>
        ),
    },
];

// The trailing "..." column: a per-row menu that activates a hide or show-only filter for
// events like that row's. It is not sortable and not hideable, so it always stays at the
// end of the row and out of the column-configuration modal. It is handed every loaded
// event (`all`, before any filtering) so each action can say how many events it covers.
function actionsColumn(addFilter: (filter: EventFilter) => void, all: ClusterEvent[]): ColumnDef<ClusterEvent> {
    return {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
            <RowFilterMenu
                item={row.original}
                items={all}
                noun="events"
                onAddFilter={addFilter}
                testIdPrefix="events"
            />
        ),
    };
}

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
    const { search, setSearch, deferredSearch } = useSearchFilter();
    // The time range the table is scoped to. Starts on the shared default (last 7
    // days), which for events is effectively everything the cluster still holds:
    // Kubernetes garbage-collects events at its `--event-ttl` (1 hour by default).
    const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

    // The filterable columns the shared editor offers: the Type value column. An
    // empty selection means "show all" (the default); the filter activates on the
    // first tick.
    const filterableColumns: FilterableColumn[] = [
        { columnId: "type", label: "Type", options: ALL_EVENT_TYPES, kind: "value" },
    ];
    const filter = useTableFilter(filterableColumns);

    // The row filters activated from the "..." menu (hide / show-only, by details hash,
    // extended hash, or service). They are applied to the events before the table sees
    // them, so a hidden event is out of the rows and out of the count alike.
    const rowFilters = useEventFilters();
    const all = data?.events ?? [];
    const visible = useMemo(
        () => applyEventFilters(all, rowFilters.filters),
        [all, rowFilters.filters],
    );
    const hiddenCount = all.length - visible.length;

    // The time range is just another column filter (on `lastSeen`), so it composes
    // with the type filter, the search box and the row filters above, and the table's
    // existing "no rows match" empty state covers a range that excludes everything.
    const columnFilters = useMemo(
        () => [...filter.columnFilters, ...timeRangeColumnFilters("lastSeen", timeRange)],
        [filter.columnFilters, timeRange],
    );

    // The table's columns are the display columns plus the trailing "..." actions column.
    // `addFilter` is stable and the loaded events only change on a refetch, so the table is
    // not rebuilt on every render.
    const tableColumns = useMemo(
        () => [...columns, actionsColumn(rowFilters.addFilter, all)],
        [rowFilters.addFilter, all],
    );

    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("events", tableColumns);

    const openEvent = useCallback((event: ClusterEvent) => {
        navigate(`/events/${encodeURIComponent(event.uid)}`);
    }, [navigate]);

    const table = useReactTable({
        data: visible,
        columns: tableColumns,
        state: {
            sorting,
            globalFilter: deferredSearch,
            columnFilters,
            columnOrder,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearch,
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
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                <TimeRangeFilter
                    range={timeRange}
                    onChange={setTimeRange}
                    testIdPrefix="events-range"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
                <Typography variant="body2" color="text.secondary" data-test-id="events-count">
                    {rows.length} of {all.length} events
                </Typography>
            </div>
            <ActiveRowFilters
                filters={rowFilters.filters}
                hiddenCount={hiddenCount}
                noun="events"
                onRemove={rowFilters.removeFilter}
                onReset={rowFilters.reset}
                testIdPrefix="events"
            />
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
                                <TableCell colSpan={tableColumns.length}>
                                    <Typography color="text.secondary" data-test-id="no-events-empty">No events.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={tableColumns.length}>
                                    <Typography color="text.secondary" data-test-id="no-events-match">
                                        {rowFilters.filters.length > 0 ? "No events match the current filters." : "No events match the search."}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        <DataTableRows
                            rows={rows}
                            visibleColumns={table.getVisibleLeafColumns()}
                            testId="event-row"
                            clickable={true}
                            onOpen={openEvent}
                        />
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
