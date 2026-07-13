import { useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingFn,
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
import { tableRowSx } from "../lib/table-row-style";
import { fuzzyGlobalFilter } from "../lib/fuzzy-filter";
import { buildLabelRows, compareLabelRows, type LabelRow } from "../lib/label-rows";

// Adapts the pure compareLabelRows comparator to the shape Tanstack's sorting
// expects, so the order the table renders on a header click is exactly the order
// the unit-tested comparator produces.
const labelSortingFn: SortingFn<LabelRow> = (rowA, rowB, columnId) => {
    return compareLabelRows(rowA.original, rowB.original, columnId);
};

// The one searchable, sortable Key / Value table of a single resource's labels.
// Shared by both label surfaces so they behave identically: the Labels tab on a
// detail page (labels-tab.tsx) and the labels modal opened from a truncated
// Labels cell in any resource table (labels-modal.tsx). It takes a plain labels
// map and knows nothing about which resource or surface opened it.
export function LabelsTable({ labels }: { labels: Record<string, string> | undefined | null }) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const data = buildLabelRows(labels);

    const columns: ColumnDef<LabelRow>[] = [
        {
            accessorKey: "key",
            header: "Key",
            sortingFn: labelSortingFn,
        },
        {
            accessorKey: "value",
            header: "Value",
            sortingFn: labelSortingFn,
        },
    ];

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
        },
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
        if (sorted === "asc")
        {
            return <FontAwesomeIcon icon={faSortUp} />;
        }
        if (sorted === "desc")
        {
            return <FontAwesomeIcon icon={faSortDown} />;
        }
        return <FontAwesomeIcon icon={faSort} />;
    }

    if (data.length === 0)
    {
        return (
            <Typography color="text.secondary" data-test-id="no-labels">
                This resource has no labels.
            </Typography>
        );
    }

    return (
        <div className="flex flex-col gap-2" data-test-id="labels-table-root">
            <TextField
                size="small"
                placeholder="Search labels..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-test-id="labels-filter"
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="labels-table">
                <Table size="small">
                    <TableHead>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        sx={{ cursor: header.column.getCanSort() ? "pointer" : "default", userSelect: "none" }}
                                        data-test-id={`labels-header-${header.id}`}
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
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-labels-match">
                                        No labels match the search.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.id} data-test-id="label-row" sx={tableRowSx(false)}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} sx={{ fontFamily: "monospace", maxWidth: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
