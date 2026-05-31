import { useParams, useNavigate } from "react-router-dom";
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
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import type { NodeStatus, NodeCondition } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchNodeDetail } from "../lib/api-client";

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
        return <Chip label="Ready" color="success" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-check"]} />} />;
    }
    if (status === "NotReady") {
        return <Chip label="NotReady" color="error" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-xmark"]} />} />;
    }
    return <Chip label="Unknown" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-question"]} />} />;
}

// Renders a chip indicating whether a node condition is in a healthy state.
function ConditionStatusChip({ condition }: { condition: NodeCondition }) {
    const isPositive = condition.type === "Ready"
        ? condition.status === "True"
        : condition.status === "False";
    const color = isPositive ? "success" : condition.status === "Unknown" ? "default" : "warning";
    return <Chip label={condition.status} color={color} size="small" />;
}

// Detail page for a single node showing conditions, capacity, allocatable resources, and scheduled pods.
export function NodeDetailPage() {
    const { name } = useParams<{ name: string }>();
    const { current } = useKubeContext();
    const navigate = useNavigate();

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
                        <FontAwesomeIcon icon={["fas", "arrow-left"]} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <StatusChip status={data.status} />
            </Box>

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
                                <TableRow key={r}>
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
                                <TableRow key={cond.type} data-test-id="condition-row">
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
                                            sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
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
                                icon={<FontAwesomeIcon icon={["fas", "tag"]} />}
                            />
                        ))}
                    </Box>
                </Paper>
            )}
        </Box>
    );
}
