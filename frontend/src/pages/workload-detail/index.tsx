import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
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
import { faTriangleExclamation, faArrowLeft, faTag } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { WorkloadKind, KubeEvent } from "karse-types";
import type { GuidedResourceKind } from "../../lib/guided-commands";
import { useKubeContext } from "../../lib/kube-context";
import { useOriginTag, useShareableNavigate } from "../../lib/nav-state";
import { fetchWorkloadDetail } from "../../lib/api-client";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { CommandsTab } from "../../components/commands-tab";
import { LabelsTab } from "../../components/labels-tab";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { ResourceRef } from "../../components/resource-ref";
import { ResourceStatsHeader } from "../../components/resource-stats-header";
import { computePodStats } from "../../lib/resource-stats";
import { tableRowSx } from "../../lib/table-row-style";
import { Timestamp } from "../../components/timestamp";

// Renders a chip indicating whether a workload event is Normal or Warning.
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

// Human-readable singular label for each workload kind, shown in the header and back button.
const KIND_LABEL: Record<WorkloadKind, string> = {
    deployments: "Deployment",
    statefulsets: "StatefulSet",
    daemonsets: "DaemonSet",
};

// The set of tabs available on the workload detail page.
type WorkloadDetailTab = "detail" | "pods" | "labels" | "commands" | "yaml";

// Maps the plural URL/UI workload token to the singular kind the Commands tab expects.
const COMMAND_KIND: Record<WorkloadKind, GuidedResourceKind> = {
    deployments: "deployment",
    statefulsets: "statefulset",
    daemonsets: "daemonset",
};

// Detail page for a single deployment, stateful set, or daemon set. Shows the
// workload's status counters, labels, selector, and events on the Status tab, the
// owned pods on the Pods tab, the guided commands on the Commands tab, and the raw
// YAML on the YAML tab. The kind is fixed per route so the three workload types
// share one page implementation.
export function WorkloadDetailPage({ kind }: { kind: WorkloadKind }) {
    const { namespace, name } = useParams<{ namespace: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    // Tags each pod link with this workload's page, so the pod detail page's breadcrumb
    // shows "Deployments > <workload> > <pod>" and links back to the workload.
    const from = useOriginTag();
    const [activeTab, setActiveTab] = useState<WorkloadDetailTab>("detail");

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["workload-detail", kind, current, namespace, name],
        queryFn: () => fetchWorkloadDetail(current!, kind, namespace!, name!),
        enabled: current !== null && !!namespace && !!name,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    // The Details grid's label/value pairs: Age, then the workload's own stats. The
    // values are ReactNodes because Age is a <Timestamp>, which renders as an age or
    // a local time per the app-wide mode.
    const detailFields: [string, ReactNode][] = [
        ["Age", <Timestamp value={data.createdAt} />],
        ...data.stats.map((stat): [string, ReactNode] => [stat.label, stat.value]),
    ];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="workload-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title={`Back to ${kind}`}>
                    <IconButton size="small" onClick={() => navigate(`/${kind}`)}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <Chip label={KIND_LABEL[kind]} size="small" variant="outlined" />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="workload-detail-tabs"
                >
                    <Tab label="Status" value="detail" data-test-id="workload-tab-detail" />
                    <Tab label="Pods" value="pods" data-test-id="workload-tab-pods" />
                    <Tab label="Labels" value="labels" data-test-id="workload-tab-labels" />
                    <Tab label="Commands" value="commands" data-test-id="workload-tab-commands" />
                    <Tab label="YAML" value="yaml" data-test-id="workload-tab-yaml" />
                </Tabs>
            </Box>

            {activeTab === "detail" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="workload-panel-detail">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                            <Box data-test-id="workload-stat">
                                <Typography variant="caption" color="text.secondary">Namespace</Typography>
                                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                    <ResourceRef kind="Namespace" name={data.namespace} testId="workload-detail-namespace-link" />
                                </Typography>
                            </Box>
                            {detailFields.map(([label, value]) => (
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
                                        icon={<FontAwesomeIcon icon={faTag} />}
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
                                                <TableCell><Timestamp value={ev.lastSeen} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </Box>
            )}

            {activeTab === "labels" && (
                <Box data-test-id="workload-panel-labels">
                    <LabelsTab labels={data.labels} />
                </Box>
            )}

            {activeTab === "pods" && (
                <Box data-test-id="workload-panel-pods">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ mb: 2 }}>
                            <ResourceStatsHeader stats={computePodStats(data.pods)} testIdPrefix="workload-pods" />
                        </Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Pods ({data.pods.length})
                        </Typography>
                        {data.pods.length === 0
                            ? (
                                <Typography color="text.secondary" data-test-id="no-workload-pods">
                                    No pods belong to this workload.
                                </Typography>
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
                                                    onClick={() => navigate(`/pods/${pod.namespace}/${pod.name}`, { from })}
                                                    sx={tableRowSx(true)}
                                                >
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{pod.name}</TableCell>
                                                    <TableCell>{pod.phase}</TableCell>
                                                    <TableCell>{pod.ready}</TableCell>
                                                    <TableCell>{pod.restarts}</TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        {pod.node
                                                            ? <ResourceRef kind="Node" name={pod.node} testId="workload-pod-node-link" />
                                                            : "-"}
                                                    </TableCell>
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

            {activeTab === "commands" && (
                <Box data-test-id="workload-panel-commands">
                    <CommandsTab target={{ kind: COMMAND_KIND[kind], name: data.name, namespace: data.namespace }} />
                </Box>
            )}

            {activeTab === "yaml" && (
                <Box data-test-id="workload-panel-yaml">
                    <YamlTabPanel
                        target={{ type: kind, name: data.name, namespace: data.namespace }}
                        active={activeTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
