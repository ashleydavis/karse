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
    TextField,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import type { NamespaceResource } from "karse-types";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";

// Searchable, sortable table of the resources contained in a namespace. Rows that
// carry a detailPath navigate to that resource's own detail page on click.
export function ResourcesTable({
    resources,
    onOpen,
}: {
    resources: NamespaceResource[];
    onOpen: (path: string) => void;
}) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const columns: ColumnDef<NamespaceResource>[] = [
        { accessorKey: "kind", header: "Kind" },
        { accessorKey: "name", header: "Name" },
        { accessorKey: "status", header: "Status" },
    ];

    const table = useReactTable({
        data: resources,
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
        const sorted = table.getColumn(columnId)?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={faSortUp} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={faSortDown} />;
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <TextField
                size="small"
                placeholder="Search resources..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-test-id="namespace-resources-filter"
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="namespace-resources-table">
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
                        {rows.length === 0 && resources.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-namespace-resources">
                                        No resources in this namespace.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && resources.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-namespace-resources-match">
                                        No resources match the search.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => {
                            const path = row.original.detailPath;
                            return (
                                <TableRow
                                    key={row.id}
                                    data-test-id="namespace-resource-row"
                                    onClick={path ? () => onOpen(path) : undefined}
                                    sx={tableRowSx(path !== null)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
