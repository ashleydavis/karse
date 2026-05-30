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
    Alert,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import type { Node, NodeStatus } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchNodes } from "../lib/api-client";

function formatAge(createdAt: string): string {
    const ms = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

function StatusChip({ status }: { status: NodeStatus }) {
    if (status === "Ready") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={["fas", "circle-check"]} />}
                label="Ready"
                color="success"
                size="small"
            />
        );
    }
    if (status === "NotReady") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={["fas", "circle-xmark"]} />}
                label="NotReady"
                color="error"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={["fas", "circle-question"]} />}
            label="Unknown"
            size="small"
        />
    );
}

const STATUS_ORDER: Record<NodeStatus, number> = { Ready: 0, NotReady: 1, Unknown: 2 };

const columns: ColumnDef<Node>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: (info) => <StatusChip status={info.getValue<NodeStatus>()} />,
        sortingFn: (a, b) =>
            STATUS_ORDER[a.original.status] - STATUS_ORDER[b.original.status],
    },
    {
        accessorKey: "roles",
        header: "Roles",
        cell: (info) => {
            const roles = info.getValue<string[]>();
            return roles.length > 0 ? roles.join(", ") : "<none>";
        },
        sortingFn: (a, b) => {
            const ra = a.original.roles.join(", ") || "<none>";
            const rb = b.original.roles.join(", ") || "<none>";
            return ra.localeCompare(rb);
        },
    },
    {
        accessorKey: "version",
        header: "Version",
    },
    {
        id: "age",
        accessorKey: "createdAt",
        header: "Age",
        cell: (info) => formatAge(info.getValue<string>()),
        sortingFn: (a, b) =>
            new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
    },
];

export function NodesTable() {
    const { current } = useKubeContext();
    const { data, error, isLoading } = useQuery({
        queryKey: ["cluster", "nodes", current],
        queryFn: () => fetchNodes(current!),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    const table = useReactTable({
        data: data?.nodes ?? [],
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: "includesString",
    });

    if (current === null) return null;

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading) return null;

    const rows = table.getRowModel().rows;
    const allNodes = data?.nodes ?? [];

    function SortIcon({ columnId }: { columnId: string }) {
        const col = table.getColumn(columnId);
        const sorted = col?.getIsSorted();
        if (sorted === "asc") return <FontAwesomeIcon icon={["fas", "sort-up"]} />;
        if (sorted === "desc") return <FontAwesomeIcon icon={["fas", "sort-down"]} />;
        return <FontAwesomeIcon icon={["fas", "sort"]} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <TextField
                size="small"
                placeholder="Search nodes..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-test-id="nodes-search"
                slotProps={{
                    input: {
                        startAdornment: (
                            <FontAwesomeIcon icon={["fas", "magnifying-glass"]} style={{ marginRight: 8 }} />
                        ),
                    },
                }}
            />
            <TableContainer component={Paper} data-test-id="nodes-table">
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
                        {rows.length === 0 && allNodes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-nodes-empty">No nodes.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && allNodes.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-nodes-match">No nodes match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.id} data-test-id="node-row">
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
