import { useState } from "react";
import { useParams } from "react-router-dom";
import {
    Box,
    Typography,
    Chip,
    Alert,
    Paper,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    IconButton,
    Tooltip,
    Button,
    Tabs,
    Tab,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircleXmark, faCircleQuestion, faTriangleExclamation, faArrowLeft, faTerminal, faTag } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { NodeStatus, NodeCondition, KubeEvent } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchNodeDetail } from "../../lib/api-client";
import { YamlButton } from "../../components/yaml-dialog";
import { CommandsDialog } from "../../components/commands-dialog";
import { tableRowSx } from "../../lib/table-row-style";

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

// The set of tabs available on the node detail page.
type NodeDetailTab = "detail" | "pods" | "events";

// Detail page for a single node, organizing its content into Status/Details, Pods, and Events tabs.
export function NodeDetailPage() {
    const { name } = useParams<{ name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [activeTab, setActiveTab] = useState<NodeDetailTab>("detail");
    const [showCommands, setShowCommands] = useState(false);

    const { data, error, isLoading } = useQuery({
        queryKey: ["node-detail", current, name],
        queryFn: () => fetchNodeDetail(current!, name!),
        enabled: current !== null && !!name,
    });

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading || !data) {
        return null;
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
                <YamlButton type="nodes" name={data.name} />
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FontAwesomeIcon icon={faTerminal} />}
                    onClick={() => setShowCommands(true)}
                    data-test-id="commands-button"
                >
                    Commands
                </Button>
            </Box>

            <CommandsDialog
                open={showCommands}
                onClose={() => setShowCommands(false)}
                target={{ kind: "node", name: data.name }}
            />

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="node-detail-tabs"
                >
                    <Tab label="Status / Details" value="detail" data-test-id="node-tab-detail" />
                    <Tab label="Pods" value="pods" data-test-id="node-tab-pods" />
                    <Tab label="Events" value="events" data-test-id="node-tab-events" />
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

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Capacity vs Allocatable</Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Resource</TableCell>
                                        <TableCell>Capacity</TableCell>
                                        <TableCell>Allocatable</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(["cpu", "memory", "pods"] as const).map((r) => (
                                        <TableRow key={r} sx={tableRowSx(false)}>
                                            <TableCell>{r}</TableCell>
                                            <TableCell sx={{ fontFamily: "monospace" }}>{data.capacity[r]}</TableCell>
                                            <TableCell sx={{ fontFamily: "monospace" }}>{data.allocatable[r]}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
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

                    {Object.keys(data.labels).length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Labels</Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {Object.entries(data.labels).map(([k, v]) => (
                                    <Chip
                                        key={k}
                                        label={`${k}=${v}`}
                                        size="small"
                                        variant="outlined"
                                        icon={<FontAwesomeIcon icon={faTag} />}
                                    />
                                ))}
                            </Box>
                        </Paper>
                    )}
                </Box>
            )}

            {activeTab === "pods" && (
                <Box data-test-id="node-panel-pods">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Pods ({data.pods.length})
                        </Typography>
                        {data.pods.length === 0
                            ? (
                                <Typography color="text.secondary">No pods scheduled on this node.</Typography>
                            )
                            : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Namespace</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Ready</TableCell>
                                                <TableCell>Restarts</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.pods.map((pod) => (
                                                <TableRow
                                                    key={pod.namespace + "/" + pod.name}
                                                    data-test-id="node-pod-row"
                                                    onClick={() => navigate(`/pods/${pod.namespace}/${pod.name}`)}
                                                    sx={tableRowSx(true)}
                                                >
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{pod.name}</TableCell>
                                                    <TableCell>{pod.namespace}</TableCell>
                                                    <TableCell>{pod.phase}</TableCell>
                                                    <TableCell>{pod.ready}</TableCell>
                                                    <TableCell>{pod.restarts}</TableCell>
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
        </Box>
    );
}
