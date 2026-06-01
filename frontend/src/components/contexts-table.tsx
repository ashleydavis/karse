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
    Button,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import type { Context } from "karse-types";
import { tableRowSx } from "../lib/table-row-style";
import { fuzzyGlobalFilter } from "../lib/fuzzy-filter";

type Props = {
    contexts: Context[];
    active: string | null;
    terminalDefault: string | null;
    onUse: (name: string) => void;
    onSetDefault: (name: string) => void;
};

export function ContextsTable({ contexts, active, terminalDefault, onUse, onSetDefault }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

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
            id: "action",
            header: "Actions",
            enableSorting: false,
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

    const table = useReactTable({
        data: contexts,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    const rows = table.getRowModel().rows;

    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={faSortUp} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={faSortDown} />;
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <TextField
                size="small"
                placeholder="Search contexts..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-test-id="contexts-search"
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="contexts-table">
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
                        {rows.length === 0 && contexts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-contexts-empty">
                                        No contexts found.
                                    </Typography>
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
                        {rows.map((row) => (
                            <TableRow key={row.id} data-test-id="context-row" sx={tableRowSx(false)}>
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
