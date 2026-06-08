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
    CircularProgress,
    Alert,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import type { Namespace } from "karse-types";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { LabelsCell } from "../../../components/labels-cell";
import { labelsToPairs } from "../../../components/labels-cell-pairs";

type Props = {
    namespaces: Namespace[];
    active: string | null;
    terminalDefault: string | null;
    isLoading: boolean;
    error: Error | null;
    onUse: (name: string | null) => void;
    onSetDefault?: (name: string | null) => void;
    onOpen?: (name: string) => void;
};

export function NamespaceList({ namespaces, active, terminalDefault, isLoading, error, onUse, onSetDefault, onOpen }: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const columns: ColumnDef<Namespace>[] = [
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
            id: "labels",
            // Joins labels into searchable "key=value" text so the table's fuzzy
            // search matches on both label keys and values.
            accessorFn: (row) => labelsToPairs(row.labels).join(" "),
            header: "Labels",
            cell: (info) => <LabelsCell labels={info.row.original.labels} />,
            enableSorting: false,
        },
        {
            id: "action",
            header: "Actions",
            enableSorting: false,
            cell: (info) => {
                const name = info.row.original.name;
                // Stop propagation so clicking an action button does not also trigger
                // the row's navigate-to-detail handler.
                return (
                    <span style={{ display: "inline-flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onUse(name === active ? null : name)}
                        >
                            {name === active ? "Clear active" : "Set as active"}
                        </Button>
                        {onSetDefault !== undefined && (
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => onSetDefault(name === terminalDefault ? null : name)}
                            >
                                {name === terminalDefault ? "Clear default" : "Set as default"}
                            </Button>
                        )}
                    </span>
                );
            },
        },
    ];

    const table = useReactTable({
        data: namespaces,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    if (isLoading) {
        return <CircularProgress size={24} />;
    }

    if (error) {
        return <Alert severity="error">{error.message}</Alert>;
    }

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
                placeholder="Search namespaces..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-test-id="namespaces-filter"
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="namespaces-list">
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
                        {rows.length === 0 && namespaces.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-namespaces-found">
                                        No namespaces found.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && namespaces.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-namespaces-match">
                                        No namespaces match the search.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="namespace-row"
                                onClick={onOpen ? () => onOpen(row.original.name) : undefined}
                                sx={tableRowSx(onOpen !== undefined)}
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
