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
    Alert,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { useShareableNavigate } from "../lib/nav-state";
import type { DaemonSet } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { fetchDaemonSets } from "../lib/api-client";
import { YamlButton } from "./yaml-dialog";
import { tableRowSx } from "../lib/table-row-style";

// Formats a Kubernetes creationTimestamp into a human-readable age string.
function formatAge(createdAt: string): string {
    const ms = Date.now() - new Date(createdAt).getTime();
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

// Column definitions for the daemon sets table.
const columns: ColumnDef<DaemonSet>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "namespace", header: "Namespace" },
    { accessorKey: "desired", header: "Desired" },
    { accessorKey: "current", header: "Current" },
    { accessorKey: "ready", header: "Ready" },
    { accessorKey: "upToDate", header: "Up-to-date" },
    { accessorKey: "available", header: "Available" },
    {
        id: "age",
        accessorKey: "createdAt",
        header: "Age",
        cell: (info) => formatAge(info.getValue<string>()),
        sortingFn: (a, b) =>
            new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
    },
    {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: (info) => (
            <YamlButton
                type="daemonsets"
                name={info.row.original.name}
                namespace={info.row.original.namespace}
            />
        ),
    },
];

// Sortable, filterable table of Kubernetes daemon sets for the active context.
export function DaemonSetsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading } = useQuery({
        queryKey: ["daemonsets", current, namespace],
        queryFn: () => fetchDaemonSets(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const table = useReactTable({
        data: data?.daemonSets ?? [],
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
        globalFilterFn: "includesString",
    });

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading) {
        return null;
    }

    const rows = table.getRowModel().rows;
    const all = data?.daemonSets ?? [];

    // Renders the appropriate sort direction icon for a column header.
    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") {
            return <FontAwesomeIcon icon={["fas", "sort-up"]} />;
        }
        if (sorted === "desc") {
            return <FontAwesomeIcon icon={["fas", "sort-down"]} />;
        }
        return <FontAwesomeIcon icon={["fas", "sort"]} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <TextField
                size="small"
                placeholder="Search daemon sets..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-test-id="daemonsets-search"
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={["fas", "magnifying-glass"]} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="daemonsets-table">
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
                                    <Typography color="text.secondary" data-test-id="no-daemonsets-empty">No daemon sets.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && all.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-daemonsets-match">No daemon sets match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="daemonset-row"
                                onClick={() => navigate(`/daemonsets/${row.original.namespace}/${row.original.name}`)}
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
