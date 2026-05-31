import { useState } from "react";
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
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Divider,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import type { PodPhase, ContainerState, KubeEvent } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchPodDetail, fetchPodLogs } from "../lib/api-client";
import { CommandsDialog } from "../components/commands-dialog";

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
        return <Chip label="Running" color="success" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-check"]} />} />;
    }
    if (phase === "Pending") {
        return <Chip label="Pending" color="warning" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-pause"]} />} />;
    }
    if (phase === "Succeeded") {
        return <Chip label="Succeeded" color="info" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-check"]} />} />;
    }
    if (phase === "Failed") {
        return <Chip label="Failed" color="error" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-xmark"]} />} />;
    }
    return <Chip label="Unknown" size="small" icon={<FontAwesomeIcon icon={["fas", "circle-question"]} />} />;
}

// Renders a colored chip describing a container's current state.
function ContainerStateChip({ state, reason }: { state: ContainerState; reason: string }) {
    const label = reason ? `${state}: ${reason}` : state;
    if (state === "Running") {
        return <Chip label="Running" color="success" size="small" />;
    }
    if (state === "Waiting") {
        return <Chip label={label} color="warning" size="small" />;
    }
    if (state === "Terminated") {
        return <Chip label={label} color="default" size="small" />;
    }
    return <Chip label="Unknown" size="small" />;
}

// Renders a chip indicating whether a pod event is Normal or Warning.
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

// Fetches and displays logs for a pod, with container and tail-line selectors.
function LogViewer({ namespace, podName, containers }: {
    namespace: string;
    podName: string;
    containers: string[];
}) {
    const { current } = useKubeContext();
    const [selectedContainer, setSelectedContainer] = useState(containers[0] ?? "");
    const [tail, setTail] = useState(100);

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["logs", current, namespace, podName, selectedContainer, tail],
        queryFn: () => fetchPodLogs(current!, namespace, podName, selectedContainer || undefined, tail),
        enabled: containers.length > 0,
    });

    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                {containers.length > 1 && (
                    <div data-test-id="log-container-select">
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Container</InputLabel>
                            <Select
                                value={selectedContainer}
                                label="Container"
                                onChange={(e) => setSelectedContainer(e.target.value)}
                            >
                                {containers.map((c) => (
                                    <MenuItem key={c} value={c} data-test-id="log-container-option">{c}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                )}
                <div data-test-id="log-tail-select">
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Tail lines</InputLabel>
                        <Select
                            value={tail}
                            label="Tail lines"
                            onChange={(e) => setTail(Number(e.target.value))}
                        >
                            {[50, 100, 200, 500].map((n) => (
                                <MenuItem key={n} value={n} data-test-id="log-tail-option">{n}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>
                <Tooltip title="Refresh logs">
                    <IconButton size="small" onClick={() => refetch()} disabled={isLoading} aria-label="refresh logs" data-test-id="log-refresh">
                        <FontAwesomeIcon icon={["fas", "rotate"]} />
                    </IconButton>
                </Tooltip>
            </Box>
            {error && <Alert severity="error">{(error as Error).message}</Alert>}
            <Paper
                variant="outlined"
                sx={{
                    p: 1.5,
                    bgcolor: "grey.900",
                    color: "grey.100",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    overflowY: "auto",
                    maxHeight: 400,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                }}
                data-test-id="log-viewer"
            >
                {isLoading ? "Loading..." : (data?.logs || "(no logs)")}
            </Paper>
        </Box>
    );
}

// Detail page for a single pod showing containers, status, events, and a log viewer.
export function PodDetailPage() {
    const { namespace, name } = useParams<{ namespace: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useNavigate();
    const [showLogs, setShowLogs] = useState(false);
    const [showCommands, setShowCommands] = useState(false);

    const { data, error, isLoading } = useQuery({
        queryKey: ["pod-detail", current, namespace, name],
        queryFn: () => fetchPodDetail(current!, namespace!, name!),
        enabled: current !== null && !!namespace && !!name,
    });

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading || !data) {
        return null;
    }

    const allContainerNames = [
        ...data.containers.map((c) => c.name),
        ...data.initContainers.map((c) => c.name),
    ];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to pods">
                    <IconButton size="small" onClick={() => navigate("/pods")}>
                        <FontAwesomeIcon icon={["fas", "arrow-left"]} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <PhaseChip phase={data.phase} />
                <Box sx={{ flexGrow: 1 }} />
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
                target={{ kind: "pod", name: data.name, namespace: data.namespace }}
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                    {[
                        ["Namespace", data.namespace],
                        ["Node", data.node || "-"],
                        ["Pod IP", data.podIP || "-"],
                        ["Age", formatAge(data.createdAt)],
                    ].map(([label, value]) => (
                        <Box key={label}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
                        </Box>
                    ))}
                </Box>
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

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Containers</Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Image</TableCell>
                                <TableCell>State</TableCell>
                                <TableCell>Ready</TableCell>
                                <TableCell>Restarts</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.containers.map((c) => (
                                <TableRow key={c.name} data-test-id="container-row">
                                    <TableCell sx={{ fontFamily: "monospace" }}>{c.name}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.image}</TableCell>
                                    <TableCell><ContainerStateChip state={c.state} reason={c.stateReason} /></TableCell>
                                    <TableCell>{c.ready ? "Yes" : "No"}</TableCell>
                                    <TableCell>{c.restarts}</TableCell>
                                </TableRow>
                            ))}
                            {data.containers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Typography color="text.secondary">No containers.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {data.initContainers.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Init Containers</Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Image</TableCell>
                                    <TableCell>State</TableCell>
                                    <TableCell>Ready</TableCell>
                                    <TableCell>Restarts</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.initContainers.map((c) => (
                                    <TableRow key={c.name} data-test-id="init-container-row">
                                        <TableCell sx={{ fontFamily: "monospace" }}>{c.name}</TableCell>
                                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.image}</TableCell>
                                        <TableCell><ContainerStateChip state={c.state} reason={c.stateReason} /></TableCell>
                                        <TableCell>{c.ready ? "Yes" : "No"}</TableCell>
                                        <TableCell>{c.restarts}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: showLogs ? 2 : 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
                        <FontAwesomeIcon icon={["fas", "terminal"]} />
                        Logs
                    </Typography>
                    <Button
                        size="small"
                        variant={showLogs ? "outlined" : "contained"}
                        onClick={() => setShowLogs(!showLogs)}
                    >
                        {showLogs ? "Hide" : "Show logs"}
                    </Button>
                </Box>
                {showLogs && (
                    <>
                        <Divider sx={{ mb: 2 }} />
                        <LogViewer
                            namespace={data.namespace}
                            podName={data.name}
                            containers={allContainerNames}
                        />
                    </>
                )}
            </Paper>

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
