import { useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
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
import { faCircleCheck, faCirclePause, faCircleQuestion, faCircleXmark, faMagnifyingGlass, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { Pod, PodPhase } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { useKubeNamespace } from "../../../lib/kube-namespace";
import { useShareableNavigate } from "../../../lib/nav-state";
import { fetchPods } from "../../../lib/api-client";
import { StatusFilter } from "../../../components/status-filter";
import { tableRowSx } from "../../../lib/table-row-style";
import { fuzzyGlobalFilter } from "../../../lib/fuzzy-filter";
import { statusColumnFilterFn, makeStatusFilterController } from "../../../lib/status-filter-state";

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

// Renders a colored MUI Chip for a pod phase value.
function PhaseChip({ phase }: { phase: PodPhase }) {
    if (phase === "Running") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label="Running"
                color="success"
                size="small"
            />
        );
    }
    if (phase === "Pending") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCirclePause} />}
                label="Pending"
                color="warning"
                size="small"
            />
        );
    }
    if (phase === "Succeeded") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label="Succeeded"
                color="info"
                size="small"
            />
        );
    }
    if (phase === "Failed") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleXmark} />}
                label="Failed"
                color="error"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={faCircleQuestion} />}
            label="Unknown"
            size="small"
        />
    );
}

// Sort order for pod phases: Running first, Unknown last.
const PHASE_ORDER: Record<PodPhase, number> = {
    Running: 0,
    Pending: 1,
    Succeeded: 2,
    Failed: 3,
    Unknown: 4,
};

// All selectable pod phases, in display order, for the phase filter dropdown.
const ALL_PHASES: PodPhase[] = ["Running", "Pending", "Succeeded", "Failed", "Unknown"];

// Builds the column definitions for the pods table.
function buildColumns(): ColumnDef<Pod>[] {
    const cols: ColumnDef<Pod>[] = [];

    cols.push(
        {
            accessorKey: "name",
            header: "Name",
        },
        {
            accessorKey: "namespace",
            header: "Namespace",
        },
    );

    cols.push(
        {
            accessorKey: "phase",
            header: "Status",
            cell: (info) => <PhaseChip phase={info.getValue<PodPhase>()} />,
            sortingFn: (a, b) =>
                PHASE_ORDER[a.original.phase] - PHASE_ORDER[b.original.phase],
            // Keeps a row only when its phase is in the selected set. "All phases" is
            // represented by the absence of this filter (cleared by the shared status
            // filter controller), so an empty selection here correctly matches no rows.
            filterFn: statusColumnFilterFn,
        },
        {
            accessorKey: "ready",
            header: "Ready",
        },
        {
            accessorKey: "containerCount",
            header: "Containers",
            cell: (info) => (
                <span data-test-id="pod-container-count">{info.getValue<number>()}</span>
            ),
        },
        {
            accessorKey: "restarts",
            header: "Restarts",
        },
        {
            accessorKey: "node",
            header: "Node",
        },
        {
            id: "age",
            accessorKey: "createdAt",
            header: "Age",
            cell: (info) => formatAge(info.getValue<string>()),
            sortingFn: (a, b) =>
                new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
        },
    );

    return cols;
}

// Sortable, filterable table of Kubernetes pods for the active context.
// When a namespace is selected it scopes the query; otherwise shows all namespaces.
// The Namespace column is always rendered regardless of the active namespace.
export function PodsTable() {
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading } = useQuery({
        queryKey: ["pods", current, namespace],
        queryFn: () => fetchPods(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const columns = buildColumns();

    // The selected phases live in the table's "phase" column filter; an absent filter means "all".
    const phaseFilterController = makeStatusFilterController("phase", ALL_PHASES, columnFilters, setColumnFilters);

    const table = useReactTable({
        data: data?.pods ?? [],
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: fuzzyGlobalFilter,
    });

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading) {
        return null;
    }

    const rows = table.getRowModel().rows;
    const allPods = data?.pods ?? [];

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
                    placeholder="Search pods..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    data-test-id="pods-search"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />
                <StatusFilter
                    all={ALL_PHASES}
                    selected={phaseFilterController.selected}
                    onChange={phaseFilterController.setSelected}
                    label="Phase"
                    testIdPrefix="pods-phase-filter"
                />
            </div>
            <TableContainer component={Paper} data-test-id="pods-table">
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
                        {rows.length === 0 && allPods.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-pods-empty">No pods.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length === 0 && allPods.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Typography color="text.secondary" data-test-id="no-pods-match">No pods match the search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-test-id="pod-row"
                                onClick={() => navigate(`/pods/${row.original.namespace}/${row.original.name}`)}
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
