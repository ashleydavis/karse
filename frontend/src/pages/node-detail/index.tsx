import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
    Box,
    Typography,
    Chip,
    Paper,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    IconButton,
    Tooltip,
    Tabs,
    Tab,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircleXmark, faCircleQuestion, faTriangleExclamation, faArrowLeft, faSort, faSortUp, faSortDown } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import type { NodeStatus, NodeCondition, KubeEvent, Pod } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchNodeDetail, fetchNodePerformance } from "../../lib/api-client";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { CommandsTab } from "../../components/commands-tab";
import { LabelsTab } from "../../components/labels-tab";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { ResourceRef } from "../../components/resource-ref";
import { NodePerformanceTab } from "../../components/performance/node-performance-tab";
import { NodeResourceIndicator } from "../../components/performance/node-resource-indicator";
import { tableRowSx } from "../../lib/table-row-style";
import { buildNodePodResourceMap, podResourceFor, type PodResourceMap } from "../../lib/node-pod-usage";
import { compareUsageValue } from "../../lib/pod-resource-sort";
import { nodeMetricFigure, type NodeFigure, type ValueFormat } from "../../lib/resource-utilization";
import {
    ResourceUtilizationProvider,
    useResourceUtilization,
} from "../../lib/resource-utilization-context";
import { ViewToggles } from "../../components/resource-utilization/view-toggles";
import { ResourceBarCell } from "../../components/resource-utilization/resource-bar-cell";

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

// Renders a colored MUI Chip for a node's Ready / NotReady / Unknown status.
function StatusChip({ status }: { status: NodeStatus }) {
    if (status === "Ready") {
        return <Chip label="Ready" color="success" size="small" icon={<FontAwesomeIcon icon={faCircleCheck} />} />;
    }
    if (status === "NotReady") {
        return <Chip label="NotReady" color="error" size="small" icon={<FontAwesomeIcon icon={faCircleXmark} />} />;
    }
    return <Chip label="Unknown" size="small" icon={<FontAwesomeIcon icon={faCircleQuestion} />} />;
}

// Renders a chip indicating whether a node condition is in a healthy state.
function ConditionStatusChip({ condition }: { condition: NodeCondition }) {
    const isPositive = condition.type === "Ready"
        ? condition.status === "True"
        : condition.status === "False";
    const color = isPositive ? "success" : condition.status === "Unknown" ? "default" : "warning";
    return <Chip label={condition.status} color={color} size="small" />;
}

// Renders a chip indicating whether a node event is Normal or Warning.
function EventTypeChip({ type }: { type: KubeEvent["type"] }) {
    if (type === "Warning") {
        return (
            <Chip
                label="Warning"
                color="warning"
                size="small"
                icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            />
        );
    }
    return <Chip label="Normal" color="default" size="small" />;
}

// A node pod row: the node detail Pod joined with its CPU and Memory display figures
// against the node (from the Performance snapshot), already resolved for the active
// View-mode / Value-format toggle state. Each figure carries the bar percentage, the
// display text (% or used/total), and the threshold level. The figures live on the row so
// the table's accessors and sort comparators are pure functions of the row data —
// recomputed whenever the joined rows or the toggle state change, not captured in a stale
// column closure.
type NodePodRow = Pod & { cpu: NodeFigure; memory: NodeFigure };

// Column definitions for the per-node Pods table, parameterised by the active value-format
// so the CPU/Memory column headers read "CPU %"/"CPU" etc. The CPU and Memory columns
// render a ResourceBarCell from the row's resolved figure and sort by the figure's bar
// percentage (a null reading sorts below every real value via compareUsageValue); the
// others are display-only.
function nodePodColumns(format: ValueFormat): ColumnDef<NodePodRow>[] {
    const suffix = format === "percent" ? " %" : "";
    return [
        {
            accessorKey: "name",
            header: "Name",
            enableSorting: false,
            cell: (info) => (
                <span style={{ fontFamily: "monospace" }}>{info.getValue<string>()}</span>
            ),
        },
        {
            accessorKey: "namespace",
            header: "Namespace",
            enableSorting: false,
            cell: (info) => (
                <span onClick={(e) => e.stopPropagation()}>
                    <ResourceRef kind="Namespace" name={info.getValue<string>()} testId="node-pod-namespace-link" />
                </span>
            ),
        },
        {
            accessorKey: "phase",
            header: "Status",
            enableSorting: false,
        },
        {
            accessorKey: "ready",
            header: "Ready",
            enableSorting: false,
        },
        {
            accessorKey: "restarts",
            header: "Restarts",
            enableSorting: false,
        },
        {
            // Pod CPU consumption as a share of this node's allocatable, in the active
            // mode/format. Renders a bar (or an em-dash when the figure is null) and sorts
            // by the bar percentage.
            id: "cpu",
            header: `CPU${suffix}`,
            // Sort by the resolved bar percentage. The accessor returns the percent so
            // TanStack's sort state machine (asc → desc → off) behaves like a numeric
            // column; the custom sortingFn keeps null readings ordered below real values.
            accessorFn: (row) => row.cpu.percent,
            // Ascending on the first click (TanStack defaults numeric columns to
            // descending-first; force a consistent low→high → high→low cycle instead).
            sortDescFirst: false,
            cell: ({ row }) => (
                <ResourceBarCell
                    percent={row.original.cpu.percent}
                    displayText={row.original.cpu.valueText}
                    level={row.original.cpu.level}
                    testId="node-pod-cpu"
                />
            ),
            sortingFn: (a, b) => compareUsageValue(a.original.cpu.percent, b.original.cpu.percent),
        },
        {
            // Pod memory consumption as a share of this node's allocatable, in the active
            // mode/format.
            id: "memory",
            header: `Memory${suffix}`,
            accessorFn: (row) => row.memory.percent,
            sortDescFirst: false,
            cell: ({ row }) => (
                <ResourceBarCell
                    percent={row.original.memory.percent}
                    displayText={row.original.memory.valueText}
                    level={row.original.memory.level}
                    testId="node-pod-memory"
                />
            ),
            sortingFn: (a, b) => compareUsageValue(a.original.memory.percent, b.original.memory.percent),
        },
    ];
}

// The per-node Pods table: lists the pods scheduled on the node with sortable CPU and
// memory bar columns, each showing the pod's share of the node (pod usage-or-requests ÷
// the node's allocatable) for the shared View-mode / Value-format toggles. Per-pod usage
// and requests come from the node Performance snapshot (GET /api/nodes/:name/performance),
// fetched lazily — only when the Pods tab is active. A failed/absent metrics fetch leaves
// the usage-mode bars showing em-dashes rather than breaking the table. Clicking a row
// opens that pod's detail page.
function NodePodsTable({ nodeName, pods, active }: { nodeName: string; pods: Pod[]; active: boolean }) {
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const { mode, format } = useResourceUtilization();
    const [sorting, setSorting] = useState<SortingState>([]);

    const { data: performance } = useQuery({
        queryKey: ["node-performance", current, nodeName],
        queryFn: () => fetchNodePerformance(current!, nodeName),
        enabled: active && current !== null,
    });

    // Join each pod with its resolved CPU/Memory figures for the active mode/format.
    // Memoised on the pods, the Performance snapshot, and the toggle state so the array's
    // identity changes only when those change — which is what makes the table re-derive the
    // resource cells once the lazy Performance fetch resolves or a toggle flips (TanStack
    // caches the row model by data identity).
    const rows: NodePodRow[] = useMemo(() => {
        const resources: PodResourceMap = buildNodePodResourceMap(performance?.pods ?? []);
        const allocatable = performance?.node.allocatable ?? { cpuMillicores: null, memoryBytes: null };
        return pods.map((pod) => {
            const r = podResourceFor(resources, pod.namespace, pod.name);
            return {
                ...pod,
                cpu: nodeMetricFigure(r.usage, r.requests, allocatable, "cpu", mode, format),
                memory: nodeMetricFigure(r.usage, r.requests, allocatable, "memory", mode, format),
            };
        });
    }, [pods, performance, mode, format]);

    const columns = useMemo(() => nodePodColumns(format), [format]);

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    function SortIcon({ columnId }: { columnId: string }) {
        const sorted = table.getColumn(columnId)?.getIsSorted();
        if (sorted === "asc") {
            return <FontAwesomeIcon icon={faSortUp} />;
        }
        if (sorted === "desc") {
            return <FontAwesomeIcon icon={faSortDown} />;
        }
        return <FontAwesomeIcon icon={faSort} />;
    }

    return (
        <TableContainer>
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
                    {table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            data-test-id="node-pod-row"
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
    );
}

// The set of tabs available on the node detail page.
type NodeDetailTab = "detail" | "pods" | "events" | "labels" | "performance" | "commands" | "yaml";

// Reads the active tab from the URL, falling back to the Detail tab for any missing
// or unrecognized value so the page always has a valid selection. The tab lives in
// the URL (matching the pod detail page) so returning to this page from a drill-down
// can reopen the originating tab, e.g. the Performance tab after a treemap back-nav.
function parseTab(value: string | null): NodeDetailTab {
    if (value === "pods" || value === "events" || value === "labels" || value === "performance" || value === "commands" || value === "yaml") {
        return value;
    }
    return "detail";
}

// Detail page for a single node, organizing its content into Status, Pods, and Events tabs.
export function NodeDetailPage() {
    const { name } = useParams<{ name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseTab(searchParams.get("tab"));

    // Persists the active tab in the URL so a drill-down can return to it and the
    // view stays shareable.
    function setActiveTab(tab: NodeDetailTab): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", tab);
            return next;
        }, { replace: true });
    }

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["node-detail", current, name],
        queryFn: () => fetchNodeDetail(current!, name!),
        enabled: current !== null && !!name,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to nodes">
                    <IconButton size="small" onClick={() => navigate("/nodes")}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <StatusChip status={data.status} />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="node-detail-tabs"
                >
                    <Tab label="Status" value="detail" data-test-id="node-tab-detail" />
                    <Tab label="Pods" value="pods" data-test-id="node-tab-pods" />
                    <Tab label="Events" value="events" data-test-id="node-tab-events" />
                    <Tab label="Labels" value="labels" data-test-id="node-tab-labels" />
                    <Tab label="Resource utilization" value="performance" data-test-id="node-tab-performance" />
                    <Tab label="Commands" value="commands" data-test-id="node-tab-commands" />
                    <Tab label="YAML" value="yaml" data-test-id="node-tab-yaml" />
                </Tabs>
            </Box>

            {activeTab === "detail" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="node-panel-detail">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                            {[
                                ["Roles", data.roles.length > 0 ? data.roles.join(", ") : "<none>"],
                                ["Version", data.version],
                                ["Age", formatAge(data.createdAt)],
                            ].map(([label, value]) => (
                                <Box key={label}>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    {data.addresses.length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Addresses</Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                {data.addresses.map((addr) => (
                                    <Box key={addr.type + addr.address}>
                                        <Typography variant="caption" color="text.secondary">{addr.type}</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{addr.address}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    )}

                    <Paper variant="outlined" sx={{ p: 2 }} data-test-id="node-resource-usage">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Resource usage (consumed vs free)</Typography>
                        <NodeResourceIndicator
                            nodeName={data.name}
                            podCount={data.pods.length}
                            podsAllocatable={data.allocatable.pods}
                        />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Conditions</Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Message</TableCell>
                                        <TableCell>Last Transition</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.conditions.map((cond) => (
                                        <TableRow key={cond.type} data-test-id="condition-row" sx={tableRowSx(false)}>
                                            <TableCell>{cond.type}</TableCell>
                                            <TableCell><ConditionStatusChip condition={cond} /></TableCell>
                                            <TableCell sx={{ maxWidth: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cond.message}</TableCell>
                                            <TableCell>{cond.lastTransition ? formatAge(cond.lastTransition) : "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                </Box>
            )}

            {activeTab === "labels" && (
                <Box data-test-id="node-panel-labels">
                    <LabelsTab labels={data.labels} />
                </Box>
            )}

            {activeTab === "pods" && (
                <ResourceUtilizationProvider>
                    <Box data-test-id="node-panel-pods">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Pods ({data.pods.length})
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            {data.pods.length > 0 && <ViewToggles />}
                        </Box>
                        {data.pods.length === 0
                            ? (
                                <Typography color="text.secondary">No pods scheduled on this node.</Typography>
                            )
                            : (
                                <NodePodsTable
                                    nodeName={data.name}
                                    pods={data.pods}
                                    active={activeTab === "pods"}
                                />
                            )
                        }
                    </Paper>
                    </Box>
                </ResourceUtilizationProvider>
            )}

            {activeTab === "events" && (
                <Box data-test-id="node-panel-events">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Events ({data.events.length})
                        </Typography>
                        {data.events.length === 0
                            ? (
                                <Typography color="text.secondary">No events for this node.</Typography>
                            )
                            : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Type</TableCell>
                                                <TableCell>Reason</TableCell>
                                                <TableCell>Message</TableCell>
                                                <TableCell>Count</TableCell>
                                                <TableCell>Last Seen</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.events.map((ev, i) => (
                                                <TableRow key={i} data-test-id="node-event-row">
                                                    <TableCell><EventTypeChip type={ev.type} /></TableCell>
                                                    <TableCell>{ev.reason}</TableCell>
                                                    <TableCell sx={{ maxWidth: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.message}</TableCell>
                                                    <TableCell>{ev.count}</TableCell>
                                                    <TableCell>{ev.lastSeen ? formatAge(ev.lastSeen) : "-"}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )
                        }
                    </Paper>
                </Box>
            )}

            {activeTab === "performance" && (
                <Box data-test-id="node-panel-performance">
                    <NodePerformanceTab nodeName={data.name} active={activeTab === "performance"} />
                </Box>
            )}

            {activeTab === "commands" && (
                <Box data-test-id="node-panel-commands">
                    <CommandsTab target={{ kind: "node", name: data.name }} />
                </Box>
            )}

            {activeTab === "yaml" && (
                <Box data-test-id="node-panel-yaml">
                    <YamlTabPanel
                        target={{ type: "nodes", name: data.name }}
                        active={activeTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
