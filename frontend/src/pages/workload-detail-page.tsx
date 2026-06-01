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
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import type { WorkloadKind, KubeEvent } from "karse-types";
import type { GuidedResourceKind } from "../lib/guided-commands";
import { useKubeContext } from "../lib/kube-context";
import { useShareableNavigate } from "../lib/nav-state";
import { fetchWorkloadDetail } from "../lib/api-client";
import { YamlButton } from "../components/yaml-dialog";
import { CommandsDialog } from "../components/commands-dialog";
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

// Renders a chip indicating whether a workload event is Normal or Warning.
function EventTypeChip({ type }: { type: KubeEvent["type"] }) {
    if (type === "Warning") {
        return (
            <Chip
                label="Warning"
                color="warning"
                size="small"
                icon={<FontAwesomeIcon icon={["fas", "triangle-exclamation"]} />}
            />
        );
    }
    return <Chip label="Normal" color="default" size="small" />;
}

// Human-readable singular label for each workload kind, shown in the header and back button.
const KIND_LABEL: Record<WorkloadKind, string> = {
    deployments: "Deployment",
    statefulsets: "StatefulSet",
    daemonsets: "DaemonSet",
};

// Maps the plural URL/UI workload token to the singular kind the CommandsDialog expects.
const COMMAND_KIND: Record<WorkloadKind, GuidedResourceKind> = {
    deployments: "deployment",
    statefulsets: "statefulset",
    daemonsets: "daemonset",
};

// Detail page for a single deployment, stateful set, or daemon set. Shows the
// workload's status counters, labels, selector, selected pods, and events. The kind
// is fixed per route so the three workload types share one page implementation.
export function WorkloadDetailPage({ kind }: { kind: WorkloadKind }) {
    const { namespace, name } = useParams<{ namespace: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [showCommands, setShowCommands] = useState(false);

    const { data, error, isLoading } = useQuery({
        queryKey: ["workload-detail", kind, current, namespace, name],
        queryFn: () => fetchWorkloadDetail(current!, kind, namespace!, name!),
        enabled: current !== null && !!namespace && !!name,
    });

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading || !data) {
        return null;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="workload-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title={`Back to ${kind}`}>
                    <IconButton size="small" onClick={() => navigate(`/${kind}`)}>
                        <FontAwesomeIcon icon={["fas", "arrow-left"]} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <Chip label={KIND_LABEL[kind]} size="small" variant="outlined" />
                <Box sx={{ flexGrow: 1 }} />
                <YamlButton type={kind} name={data.name} namespace={data.namespace} />
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FontAwesomeIcon icon={["fas", "terminal"]} />}
                    onClick={() => setShowCommands(true)}
                    data-test-id="commands-button"
                >
                    Commands
                </Button>
            </Box>

            <CommandsDialog
                open={showCommands}
                onClose={() => setShowCommands(false)}
                target={{ kind: COMMAND_KIND[kind], name: data.name, namespace: data.namespace }}
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                    {[
                        ["Namespace", data.namespace],
                        ["Age", formatAge(data.createdAt)],
                        ...data.stats.map((stat): [string, string] => [stat.label, stat.value]),
                    ].map(([label, value]) => (
                        <Box key={label} data-test-id="workload-stat">
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
                        </Box>
                    ))}
                </Box>
            </Paper>

            {Object.keys(data.selector).length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Selector</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {Object.entries(data.selector).map(([k, v]) => (
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

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Pods ({data.pods.length})
                </Typography>
                {data.pods.length === 0
                    ? (
                        <Typography color="text.secondary">No pods selected by this workload.</Typography>
                    )
                    : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Ready</TableCell>
                                        <TableCell>Restarts</TableCell>
                                        <TableCell>Node</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.pods.map((pod) => (
                                        <TableRow
                                            key={pod.namespace + "/" + pod.name}
                                            data-test-id="workload-pod-row"
                                            onClick={() => navigate(`/pods/${pod.namespace}/${pod.name}`)}
                                            sx={tableRowSx(true)}
                                        >
                                            <TableCell sx={{ fontFamily: "monospace" }}>{pod.name}</TableCell>
                                            <TableCell>{pod.phase}</TableCell>
                                            <TableCell>{pod.ready}</TableCell>
                                            <TableCell>{pod.restarts}</TableCell>
                                            <TableCell>{pod.node || "-"}</TableCell>
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

            {data.events.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Events</Typography>
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
                                    <TableRow key={i} data-test-id="event-row">
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
                </Paper>
            )}
        </Box>
    );
}
