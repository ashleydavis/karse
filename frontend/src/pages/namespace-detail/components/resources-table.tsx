import { useCallback, useState } from "react";
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
import type { NamespaceResource } from "karse-types";
import { DataTableRows } from "../../../components/data-table-row";
import { useSearchFilter } from "../../../lib/use-search-filter";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { SearchBox } from "../../../components/search-box";

// Searchable, sortable table of the resources contained in a namespace. Rows that
// carry a detailPath navigate to that resource's own detail page on click.
// A resource is clickable only when it has a detail page. A module-level function so the row
// list keeps the same predicate on every render.
function hasDetailPage(resource: NamespaceResource): boolean {
    return resource.detailPath !== null;
}

export function ResourcesTable({
    resources,
    onOpen,
}: {
    resources: NamespaceResource[];
    onOpen: (path: string) => void;
}) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const { search, setSearch, deferredSearch } = useSearchFilter();

    const columns: ColumnDef<NamespaceResource>[] = [
        { accessorKey: "kind", header: "Kind" },
        { accessorKey: "name", header: "Name" },
        { accessorKey: "status", header: "Status" },
    ];

    const openResource = useCallback((resource: NamespaceResource) => {
        if (resource.detailPath !== null)
        {
            onOpen(resource.detailPath);
        }
    }, [onOpen]);

    const table = useReactTable({
        data: resources,
        columns,
        state: { sorting, globalFilter: deferredSearch },
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

    function SortIcon({ columnId }: { columnId: string }) {
        const sorted = table.getColumn(columnId)?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={faSortUp} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={faSortDown} />;
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <SearchBox
                placeholder="Search resources..."
                value={search}
                onChange={setSearch}
                testId="namespace-resources-filter"
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
                        <DataTableRows
                            rows={rows}
                            visibleColumns={table.getVisibleLeafColumns()}
                            testId="namespace-resource-row"
                            isClickable={hasDetailPage}
                            onOpen={openResource}
                        />
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
