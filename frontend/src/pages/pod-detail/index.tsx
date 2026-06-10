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
import { faArrowLeft, faCircleCheck, faCirclePause, faCircleQuestion, faCircleXmark, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { PodPhase, KubeEvent } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchPodDetail } from "../../lib/api-client";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { CommandsTab } from "../../components/commands-tab";
import { LabelsTab } from "../../components/labels-tab";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { PodContainersPanel, PodInitContainersPanel } from "./components/pod-containers-panel";
import { PodLogsPanel } from "./components/pod-logs-panel";

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
        return <Chip label="Running" color="success" size="small" icon={<FontAwesomeIcon icon={faCircleCheck} />} />;
    }
    if (phase === "Pending") {
        return <Chip label="Pending" color="warning" size="small" icon={<FontAwesomeIcon icon={faCirclePause} />} />;
    }
    if (phase === "Succeeded") {
        return <Chip label="Succeeded" color="info" size="small" icon={<FontAwesomeIcon icon={faCircleCheck} />} />;
    }
    if (phase === "Failed") {
        return <Chip label="Failed" color="error" size="small" icon={<FontAwesomeIcon icon={faCircleXmark} />} />;
    }
    return <Chip label="Unknown" size="small" icon={<FontAwesomeIcon icon={faCircleQuestion} />} />;
}

// Renders a chip indicating whether a pod event is Normal or Warning.
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

// The set of tabs available on the pod detail page.
type PodDetailTab = "detail" | "containers" | "init-containers" | "labels" | "logs" | "commands" | "yaml";

// Reads the active tab from the URL, falling back to the Detail tab for any
// missing or unrecognized value so the page always has a valid selection.
function parseTab(value: string | null): PodDetailTab {
    if (value === "containers" || value === "init-containers" || value === "labels" || value === "logs" || value === "commands" || value === "yaml") {
        return value;
    }
    return "detail";
}

// Detail page for a single pod, organizing its content into Status, Containers, and Logs tabs.
export function PodDetailPage() {
    const { namespace, name } = useParams<{ namespace: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseTab(searchParams.get("tab"));

    // Persists the active tab in the URL so the breadcrumb can show it and the
    // view stays shareable.
    function selectTab(tab: PodDetailTab): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", tab);
            return next;
        }, { replace: true });
    }

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["pod-detail", current, namespace, name],
        queryFn: () => fetchPodDetail(current!, namespace!, name!),
        enabled: current !== null && !!namespace && !!name,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
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
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <PhaseChip phase={data.phase} />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={effectiveTab}
                    onChange={(_, value) => selectTab(value)}
                    data-test-id="pod-detail-tabs"
                >
                    <Tab label="Status" value="detail" data-test-id="pod-tab-detail" />
                    <Tab label="Containers" value="containers" data-test-id="pod-tab-containers" />
                    {hasInitContainers && (
                        <Tab
                            label="Init Containers"
                            value="init-containers"
                            data-test-id="pod-tab-init-containers"
                        />
                    )}
                    <Tab label="Labels" value="labels" data-test-id="pod-tab-labels" />
                    <Tab label="Logs" value="logs" data-test-id="pod-tab-logs" />
                    <Tab label="Commands" value="commands" data-test-id="pod-tab-commands" />
                    <Tab label="YAML" value="yaml" data-test-id="pod-tab-yaml" />
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
                    <PodContainersPanel containers={data.containers} namespace={data.namespace} podName={data.name} />
                </Box>
            )}

            {effectiveTab === "init-containers" && (
                <Box data-test-id="pod-panel-init-containers">
                    <PodInitContainersPanel initContainers={data.initContainers} namespace={data.namespace} podName={data.name} />
                </Box>
            )}

            {effectiveTab === "labels" && (
                <Box data-test-id="pod-panel-labels">
                    <LabelsTab labels={data.labels} />
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

            {effectiveTab === "commands" && (
                <Box data-test-id="pod-panel-commands">
                    <CommandsTab target={{ kind: "pod", name: data.name, namespace: data.namespace }} />
                </Box>
            )}

            {effectiveTab === "yaml" && (
                <Box data-test-id="pod-panel-yaml">
                    <YamlTabPanel
                        target={{ type: "pods", name: data.name, namespace: data.namespace }}
                        active={effectiveTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
