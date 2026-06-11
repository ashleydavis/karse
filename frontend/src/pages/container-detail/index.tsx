import { useParams, useSearchParams } from "react-router-dom";
import {
    Box,
    Typography,
    Chip,
    Alert,
    Paper,
    IconButton,
    Tooltip,
    Tabs,
    Tab,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { ContainerInfo, ContainerState } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchPodDetail } from "../../lib/api-client";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { CommandsTab } from "../../components/commands-tab";
import { LoadingIndicator } from "../../components/loading-indicator";
import { ResourceRef } from "../../components/resource-ref";
import { PodLogsPanel } from "../pod-detail/components/pod-logs-panel";

// Renders a colored chip describing a container's current lifecycle state,
// matching the chip used in the pod's Containers tab.
function ContainerStateChip({ state, reason }: { state: ContainerState; reason: string }) {
    const label = reason ? `${state}: ${reason}` : state;
    if (state === "Running")
    {
        return <Chip label="Running" color="success" size="small" />;
    }
    if (state === "Waiting")
    {
        return <Chip label={label} color="warning" size="small" />;
    }
    if (state === "Terminated")
    {
        return <Chip label={label} color="default" size="small" />;
    }
    return <Chip label="Unknown" size="small" />;
}

// The set of tabs available on the container detail page.
type ContainerDetailTab = "detail" | "logs" | "commands" | "yaml";

// Reads the active tab from the URL, falling back to the Status tab for any
// missing or unrecognized value so the page always has a valid selection.
function parseTab(value: string | null): ContainerDetailTab {
    if (value === "logs" || value === "commands" || value === "yaml")
    {
        return value;
    }
    return "detail";
}

// Detail page for a single container within a pod, reached by clicking a row in
// the pod's Containers (or Init Containers) tab. The container's data is sourced
// from the parent pod detail; the page organizes it into Status, Logs, Commands,
// and YAML tabs, mirroring the pod detail page's tab pattern.
export function ContainerDetailPage() {
    const { namespace, name, container } = useParams<{ namespace: string; name: string; container: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseTab(searchParams.get("tab"));

    // Persists the active tab in the URL so the breadcrumb can show it and the
    // view stays shareable.
    function selectTab(tab: ContainerDetailTab): void {
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

    if (error)
    {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading || !data)
    {
        return <LoadingIndicator />;
    }

    // The container may be a regular container or an init container; search both.
    const found: ContainerInfo | undefined =
        data.containers.find((c) => c.name === container)
        ?? data.initContainers.find((c) => c.name === container);

    if (!found)
    {
        return (
            <Alert severity="error" data-test-id="container-not-found">
                Container "{container}" was not found in pod {name}.
            </Alert>
        );
    }

    const isInit = data.initContainers.some((c) => c.name === found.name);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to pod">
                    <IconButton size="small" onClick={() => navigate(`/pods/${data.namespace}/${data.name}`)}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {found.name}
                </Typography>
                <ContainerStateChip state={found.state} reason={found.stateReason} />
                {isInit && <Chip label="Init Container" size="small" variant="outlined" />}
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => selectTab(value)}
                    data-test-id="container-detail-tabs"
                >
                    <Tab label="Status" value="detail" data-test-id="container-tab-detail" />
                    <Tab label="Logs" value="logs" data-test-id="container-tab-logs" />
                    <Tab label="Commands" value="commands" data-test-id="container-tab-commands" />
                    <Tab label="YAML" value="yaml" data-test-id="container-tab-yaml" />
                </Tabs>
            </Box>

            {activeTab === "detail" && (
                <Box data-test-id="container-panel-detail">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Pod</Typography>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                                    <ResourceRef kind="Pod" name={data.name} namespace={data.namespace} testId="container-detail-pod-link" />
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Namespace</Typography>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                                    <ResourceRef kind="Namespace" name={data.namespace} testId="container-detail-namespace-link" />
                                </Typography>
                            </Box>
                            {[
                                ["Image", found.image],
                                ["State", found.stateReason ? `${found.state}: ${found.stateReason}` : found.state],
                                ["Ready", found.ready ? "Yes" : "No"],
                                ["Restarts", String(found.restarts)],
                                ["Type", isInit ? "Init container" : "Container"],
                            ].map(([label, value]) => (
                                <Box key={label}>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>{value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </Box>
            )}

            {activeTab === "logs" && (
                <Box data-test-id="container-panel-logs">
                    <PodLogsPanel
                        namespace={data.namespace}
                        podName={data.name}
                        containers={[found.name]}
                    />
                </Box>
            )}

            {activeTab === "commands" && (
                <Box data-test-id="container-panel-commands">
                    <CommandsTab target={{ kind: "container", name: data.name, namespace: data.namespace, container: found.name }} />
                </Box>
            )}

            {activeTab === "yaml" && (
                <Box data-test-id="container-panel-yaml">
                    <YamlTabPanel
                        target={{ type: "pods", name: data.name, namespace: data.namespace }}
                        active={activeTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
