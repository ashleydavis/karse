import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
import { useQuery } from "@tanstack/react-query";
import type { PodPhase, KubeEvent } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { useShareableNavigate } from "../lib/nav-state";
import { fetchPodDetail } from "../lib/api-client";
import { YamlButton } from "../components/yaml-dialog";
import { CommandsDialog } from "../components/commands-dialog";
import { PodContainersPanel, PodInitContainersPanel } from "../components/pod-containers-panel";
import { PodLogsPanel } from "../components/pod-logs-panel";

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

// The set of tabs available on the pod detail page.
type PodDetailTab = "detail" | "containers" | "init-containers" | "logs";

// Reads the active tab from the URL, falling back to the Detail tab for any
// missing or unrecognized value so the page always has a valid selection.
function parseTab(value: string | null): PodDetailTab {
    if (value === "containers" || value === "init-containers" || value === "logs") {
        return value;
    }
    return "detail";
}

// Detail page for a single pod, organizing its content into Detail/Status, Containers, and Logs tabs.
export function PodDetailPage() {
    const { namespace, name } = useParams<{ namespace: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseTab(searchParams.get("tab"));
    const [showCommands, setShowCommands] = useState(false);

    // Persists the active tab in the URL so the breadcrumb can show it and the
    // view stays shareable.
    function selectTab(tab: PodDetailTab): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", tab);
            return next;
        }, { replace: true });
    }

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

    const hasInitContainers = data.initContainers.length > 0;
    // The Init Containers tab is hidden when there are none, so fall back to
    // Containers if we were left pointing at a now-absent tab.
    const effectiveTab =
        activeTab === "init-containers" && !hasInitContainers ? "containers" : activeTab;

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
                <YamlButton type="pods" name={data.name} namespace={data.namespace} />
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

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={effectiveTab}
                    onChange={(_, value) => selectTab(value)}
                    data-test-id="pod-detail-tabs"
                >
                    <Tab label="Detail / Status" value="detail" data-test-id="pod-tab-detail" />
                    <Tab label="Containers" value="containers" data-test-id="pod-tab-containers" />
                    {hasInitContainers && (
                        <Tab
                            label="Init Containers"
                            value="init-containers"
                            data-test-id="pod-tab-init-containers"
                        />
                    )}
                    <Tab label="Logs" value="logs" data-test-id="pod-tab-logs" />
                </Tabs>
            </Box>

            {effectiveTab === "detail" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="pod-panel-detail">
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
            )}

            {effectiveTab === "containers" && (
                <Box data-test-id="pod-panel-containers">
                    <PodContainersPanel containers={data.containers} />
                </Box>
            )}

            {effectiveTab === "init-containers" && (
                <Box data-test-id="pod-panel-init-containers">
                    <PodInitContainersPanel initContainers={data.initContainers} />
                </Box>
            )}

            {effectiveTab === "logs" && (
                <Box data-test-id="pod-panel-logs">
                    <PodLogsPanel
                        namespace={data.namespace}
                        podName={data.name}
                        containers={allContainerNames}
                    />
                </Box>
            )}
        </Box>
    );
}
