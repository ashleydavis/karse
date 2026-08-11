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
    Chip,
    Typography,
    Button,
    Select,
    MenuItem,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import type { Context } from "karse-types";
import { DataTableRows } from "../../../components/data-table-row";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { ACTIONS_COLUMN_ID, stickyActionsHeaderSx } from "../../../lib/sticky-actions";
import { NoContextsGuidance } from "../../../components/no-contexts-guidance";
import { SearchBox } from "../../../components/search-box";
import { EnvironmentChip } from "../../../components/environment-chip";
import { useColumnConfig } from "../../../lib/column-config";
import { ColumnConfigButton } from "../../../components/column-config-modal";
import { useConfig } from "../../../lib/config";
import {
    contextLabel,
    environmentFromSelection,
    groupByEnvironment,
    resolveEnvironment,
    AUTO_ENVIRONMENT_VALUE,
} from "../../../lib/cluster-environments";

type Props = {
    contexts: Context[];
    active: string | null;
    terminalDefault: string | null;
    onUse: (name: string) => void;
    onSetDefault: (name: string) => void;
};

export function ContextsTable({ contexts, active, terminalDefault, onUse, onSetDefault }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();
    const { config: { contextEnvironments, environments }, compiledEnvironments, setContextEnvironment } = useConfig();

    const columns: ColumnDef<Context>[] = [
        {
            accessorKey: "name",
            header: "Name",
            cell: (info) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {info.getValue<string>()}
                    {info.row.original.name === active && (
                        <Chip label="active" size="small" color="primary" />
                    )}
                    {info.row.original.name === terminalDefault && (
                        <Chip label="default" size="small" />
                    )}
                </span>
            ),
        },
        {
            // The environment the context resolves to, shown as a chip. It has a column of its
            // own rather than sharing one with the selector below, so the chip's width (which
            // varies with the environment's name) cannot push each row's selector to a different
            // x position, and so the user can hide the chip from the column configuration like
            // any other optional column.
            // The accessor returns the environment's heading so the column sorts and the
            // page search matches on the environment the row actually shows.
            id: "environment",
            header: "Environment",
            accessorFn: (context) => resolveEnvironment(context.name, compiledEnvironments, contextEnvironments).environment.name,
            cell: (info) => {
                const name = info.row.original.name;
                const resolved = resolveEnvironment(name, compiledEnvironments, contextEnvironments);
                return (
                    <EnvironmentChip
                        environment={resolved.environment}
                        source={resolved.source}
                        testId="context-environment-chip"
                    />
                );
            },
        },
        {
            // The control that labels a context by hand, or hands the decision back to the name.
            // A display column: it carries no value of its own, so it neither sorts nor feeds the
            // page search (the Environment column beside it already does both on the same value).
            id: "environment-label",
            header: "Set environment",
            enableSorting: false,
            enableGlobalFilter: false,
            cell: (info) => {
                const name = info.row.original.name;
                const label = contextLabel(name, compiledEnvironments, contextEnvironments);
                return (
                    <Select
                        size="small"
                        value={label ?? AUTO_ENVIRONMENT_VALUE}
                        onChange={(event) => setContextEnvironment(name, environmentFromSelection(event.target.value, compiledEnvironments))}
                        data-test-id="context-environment-select"
                        data-context={name}
                        inputProps={{ "aria-label": `environment for ${name}` }}
                        sx={{ minWidth: 150 }}
                    >
                        <MenuItem value={AUTO_ENVIRONMENT_VALUE}>Auto (from name)</MenuItem>
                        {environments.map((environment) => (
                            <MenuItem key={environment.id} value={environment.id}>
                                {environment.name}
                            </MenuItem>
                        ))}
                    </Select>
                );
            },
        },
        {
            accessorKey: "cluster",
            header: "Cluster",
        },
        {
            accessorKey: "user",
            header: "User",
        },
        {
            accessorKey: "namespace",
            header: "Default Namespace",
            cell: (info) => {
                const ns = info.getValue<string | null>();
                return ns ?? <Typography component="span" color="text.secondary" variant="body2">—</Typography>;
            },
        },
        {
            id: ACTIONS_COLUMN_ID,
            header: "Actions",
            enableSorting: false,
            // Excluded from the column-config modal: the actions cell is pinned to the right-hand
            // edge of the row by the sticky-actions styling, which assumes it is the last column,
            // so it is neither reorderable nor hideable.
            enableHiding: false,
            cell: (info) => {
                const name = info.row.original.name;
                return (
                    <span style={{ display: "inline-flex", gap: 8 }}>
                        <Button size="small" variant="outlined" disabled={name === active} onClick={() => onUse(name)}>
                            Set as active
                        </Button>
                        <Button size="small" variant="outlined" disabled={name === terminalDefault} onClick={() => onSetDefault(name)}>
                            Set as default
                        </Button>
                    </span>
                );
            },
        },
    ];

    // The user's saved column configuration for this table: which columns are shown and the
    // order to show them in, persisted under its own storage key. Every column ships visible.
    const { columnOrder, columnVisibility, configurable, config, setConfig } = useColumnConfig("contexts", columns);

    const table = useReactTable({
        data: contexts,
        columns,
        state: { sorting, globalFilter: deferredSearch, columnOrder, columnVisibility },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearch,
        // No pagination row model is installed (every matching row is rendered, bounded only by
        // DataTableRows' render limit), so the page index is meaningless here. TanStack would
        // otherwise reset it whenever a row model is rebuilt, and since the row-model inputs are
        // rebuilt on every render that reset would write table state, re-render, and loop.
        autoResetPageIndex: false,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    const rows = table.getRowModel().rows;

    // The rows the table would render, partitioned into environment groups in the user's own
    // list order (with Unassigned last) rather than whatever order the kubeconfig or the
    // current sort produced. Sorting and searching still run over the whole table first, so a
    // group holds only the rows that survived them, in the sorted order.
    const groups = groupByEnvironment(
        rows.map((row) => ({
            name: row.original.name,
            row,
        })),
        compiledEnvironments,
        contextEnvironments,
    );

    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={faSortUp} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={faSortDown} />;
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2 items-center">
                <SearchBox
                    placeholder="Search contexts..."
                    value={search}
                    onChange={setSearch}
                    testId="contexts-search"
                />
                <ColumnConfigButton configurable={configurable} config={config} onChange={setConfig} />
            </div>
            <TableContainer component={Paper} data-test-id="contexts-table">
                <Table size="small">
                    <TableHead>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        sx={[
                                            { cursor: header.column.getCanSort() ? "pointer" : "default", userSelect: "none" },
                                            stickyActionsHeaderSx(header.column.id === ACTIONS_COLUMN_ID),
                                        ]}
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
                        {rows.length === 0 && contexts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <NoContextsGuidance />
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && contexts.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-contexts-match">
                                        No contexts match the search.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {groups.map((group) => (
                            <Fragment key={group.environment.id}>
                                <TableRow
                                    data-test-id="context-environment-group"
                                    data-environment={group.environment.id}
                                >
                                    <TableCell
                                        colSpan={table.getVisibleLeafColumns().length}
                                        sx={{ bgcolor: "action.hover" }}
                                    >
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                            <Typography
                                                component="span"
                                                variant="subtitle2"
                                                data-test-id="context-environment-group-label"
                                            >
                                                {group.environment.name}
                                            </Typography>
                                            <Typography
                                                component="span"
                                                variant="body2"
                                                color="text.secondary"
                                                data-test-id="context-environment-group-count"
                                            >
                                                {group.items.length}
                                            </Typography>
                                        </span>
                                    </TableCell>
                                </TableRow>
                                <DataTableRows
                                    rows={group.items.map((item) => item.row)}
                                    visibleColumns={table.getVisibleLeafColumns()}
                                    testId="context-row"
                                />
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
