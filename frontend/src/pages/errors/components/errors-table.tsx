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
import { faCircleExclamation, faTriangleExclamation, faSortUp, faSortDown, faSort, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { ClusterError } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { useShareableNavigate } from "../../../lib/nav-state";
import { fetchErrors } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { TableFilter } from "../../../components/table-filter";
import { valueColumnFilterFn, type FilterableColumn } from "../../../lib/table-filter-state";
import { useTableFilter } from "../../../lib/use-table-filter";
import { LoadError } from "../../../components/load-error";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";
import { ResourceRef } from "../../../components/resource-ref";
import { DataTableRows } from "../../../components/data-table-row";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { formatAge, errorsGlobalFilter } from "../../../lib/errors-search";
import { RowFilterMenu } from "../../../components/row-filter-menu";
import { ActiveRowFilters } from "../../../components/active-row-filters";
import { type EventFilter, applyEventFilters } from "../../../lib/event-filter";
import { useEventFilters } from "../../../lib/use-event-filters";
import { TimeRangeFilter } from "../../../components/time-range-filter";
import { DEFAULT_TIME_RANGE, timeRangeColumnFilters, timeRangeFilterFn, type TimeRange } from "../../../lib/time-range";

// The distinct error types (reasons) present in the data, in display order
// (alphabetical). These are the checkboxes offered by the type filter.
function distinctReasons(errors: ClusterError[]): string[] {
    const seen = new Set<string>();
    for (const e of errors) {
        seen.add(e.reason);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
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
        // Keeps a row only when its last-seen time falls inside the range chosen in
        // the shared time-range control. "All time" installs no filter at all, so
        // this never runs in that case.
        filterFn: timeRangeFilterFn,
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
        // The object reference links through to the referenced resource's own detail
        // page. The row itself navigates to the error detail page, so the link stops
        // its click from bubbling up to the row. A reference that cannot be resolved
        // to a detail page (a kind Karse has no page for) degrades to plain text.
        cell: ({ row, getValue }) => (
            <span onClick={(e) => e.stopPropagation()}>
                <ResourceRef
                    kind={row.original.objectKind}
                    name={row.original.objectName}
                    namespace={row.original.namespace}
                    label={getValue<string>()}
                    testId="error-row-object-link"
                />
            </span>
        ),
    },
    { accessorKey: "reason", header: "Reason", filterFn: valueColumnFilterFn },
    { accessorKey: "message", header: "Message" },
    { accessorKey: "count", header: "Count" },
    {
        accessorKey: "namespace",
        header: "Namespace",
        // The error's namespace links to its own detail page. The row navigates to the
        // error detail page, so the link stops its click from bubbling up to the row.
        cell: (info) => (
            <span onClick={(e) => e.stopPropagation()}>
                <ResourceRef kind="Namespace" name={info.getValue<string>()} testId="error-row-namespace-link" />
            </span>
        ),
    },
];

// The trailing "..." column: a per-row menu that activates a hide or show-only filter for
// errors like that row's. It is not sortable and not hideable, so it always stays at the
// end of the row and out of the column-configuration modal. It is handed every loaded
// error (`all`, before any filtering) so each action can say how many errors it covers.
function actionsColumn(addFilter: (filter: EventFilter) => void, all: ClusterError[]): ColumnDef<ClusterError> {
    return {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
            <RowFilterMenu
                item={row.original}
                items={all}
                noun="errors"
                onAddFilter={addFilter}
                testIdPrefix="errors"
            />
        ),
    };
}

// Sortable, filterable table of error conditions occurring in the cluster for the
// active context. Combines Warning events and problem pods returned by GET /api/errors.
// When a namespace is selected it scopes the query; otherwise shows errors across
// all namespaces. Rows are returned newest-first by the backend.
export function ErrorsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["errors", current, namespace],
        queryFn: () => fetchErrors(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();
    // The time range the table is scoped to. Starts on the shared default (last 7
    // days). Unlike the Events feed, this bites here: an error's `lastSeen` comes
    // from the pod's start time for a problem-pod row, so a pod that has been broken
    // for weeks is older than the default range and is hidden until the range widens.
    const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

    // The filterable columns the shared editor offers: the Reason value column, whose
    // options are the distinct reasons present in the loaded errors. An empty selection
    // means "show all" (the default); the filter activates on the first tick.
    const filterableColumns: FilterableColumn[] = [
        { columnId: "reason", label: "Reason", options: distinctReasons(data?.errors ?? []), kind: "value" },
    ];
    const filter = useTableFilter(filterableColumns);

    // The row filters activated from the "..." menu (hide / show-only, by details hash,
    // extended hash, or service). They are applied to the errors before the table sees
    // them, so a hidden error is out of the rows and out of the count alike.
    const rowFilters = useEventFilters();
    const all = data?.errors ?? [];
    const visible = useMemo(
        () => applyEventFilters(all, rowFilters.filters),
        [all, rowFilters.filters],
    );
    const hiddenCount = all.length - visible.length;

    // The time range is just another column filter (on `lastSeen`), so it composes
    // with the reason filter, the search box and the row filters above, and the table's
    // existing "no rows match" empty state covers a range that excludes everything.
    const columnFilters = useMemo(
        () => [...filter.columnFilters, ...timeRangeColumnFilters("lastSeen", timeRange)],
        [filter.columnFilters, timeRange],
    );

    // The table's columns are the display columns plus the trailing "..." actions column.
    // `addFilter` is stable and the loaded errors only change on a refetch, so the table is
    // not rebuilt on every render.
    const tableColumns = useMemo(
        () => [...columns, actionsColumn(rowFilters.addFilter, all)],
        [rowFilters.addFilter, all],
    );

    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("errors", tableColumns);

    // The detail page selects an error by its index into the unfiltered, newest-first list it
    // re-fetches, so a row opens by its position in that same list, not by its position in the
    // current filtered/sorted view.
    const openError = useCallback((error: ClusterError) => {
        const unfiltered = data?.errors ?? [];
        navigate(`/errors/${unfiltered.indexOf(error)}`);
    }, [data, navigate]);

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
        globalFilterFn: errorsGlobalFilter,
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
                    placeholder="Search errors..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-test-id="errors-search"
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
                    testIdPrefix="errors-filter"
                />
                <TimeRangeFilter
                    range={timeRange}
                    onChange={setTimeRange}
                    testIdPrefix="errors-range"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
                <Typography variant="body2" color="text.secondary" data-test-id="errors-count">
                    {rows.length} of {all.length} errors
                </Typography>
            </div>
            <ActiveRowFilters
                filters={rowFilters.filters}
                hiddenCount={hiddenCount}
                noun="errors"
                onRemove={rowFilters.removeFilter}
                onReset={rowFilters.reset}
                testIdPrefix="errors"
            />
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
                                <TableCell colSpan={tableColumns.length}>
                                    <Typography color="text.secondary" data-test-id="no-errors-empty">No errors.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={tableColumns.length}>
                                    <Typography color="text.secondary" data-test-id="no-errors-match">
                                        {rowFilters.filters.length > 0 ? "No errors match the current filters." : "No errors match the search."}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        <DataTableRows
                            rows={rows}
                            visibleColumns={table.getVisibleLeafColumns()}
                            testId="error-row"
                            clickable={true}
                            onOpen={openError}
                        />
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
