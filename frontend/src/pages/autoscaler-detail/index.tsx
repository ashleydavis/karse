import { useState, type ReactNode } from "react";
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
    Alert,
    AlertTitle,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { resolveOrigin } from "../../lib/breadcrumb-trail";
import { fetchHorizontalPodAutoscalerDetail } from "../../lib/api-client";
import {
    splitHpaReference, metricPercent, metricLevel, formatHpaMetrics,
    replicaPercent, replicaLevel, formatReplicas,
} from "../../lib/autoscalers";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { LabelsTab } from "../../components/labels-tab";
import { CommandsTab } from "../../components/commands-tab";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { ResourceRef } from "../../components/resource-ref";
import { CopyNameButton } from "../../components/copy-button";
import { Timestamp } from "../../components/timestamp";
import { ResourceBarCell } from "../../components/resource-utilization/resource-bar-cell";
import { tableRowSx } from "../../lib/table-row-style";

// The set of tabs available on the HPA detail page, matching the sub tabs the other
// detail pages carry.
type AutoscalerDetailTab = "detail" | "labels" | "commands" | "yaml";

// The list page the back button returns to when the page was not reached from anywhere
// in particular (a shared or typed URL).
const BACK_TO = "/autoscalers";

// Detail page for a single horizontal pod autoscaler (/autoscalers/:namespace/:name). It
// shows what the Autoscalers table shows for the HPA (scale target, replica bounds,
// current and desired replicas, metrics against their targets) plus what only a detail
// page has room for: the HPA's conditions with their reasons, and its annotations. The
// metric and replica bars are the same shared bar component the table renders, and the
// scale target is a shared ResourceRef, so it links through to the workload's own detail
// page where the kind resolves and reads as plain text where it does not.
export function AutoscalerDetailPage() {
    const { namespace, name } = useParams<{ namespace: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<AutoscalerDetailTab>("detail");

    // The back button returns to the page this one was reached from, taken from the same
    // "from" tag the breadcrumb origin reads, so the two can never point at different
    // views. With no tag it returns to the Autoscalers list.
    const origin = resolveOrigin(searchParams.get("from"), "HorizontalPodAutoscaler");
    const backLabel = origin !== null ? origin.label : "autoscalers";

    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["autoscaler-detail", current, namespace, name],
        queryFn: () => fetchHorizontalPodAutoscalerDetail(current!, namespace!, name!),
        enabled: current !== null && !!namespace && !!name,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    // The query is still in flight, or has not started because no context is selected yet.
    if (isPending || data === undefined) {
        return <LoadingIndicator />;
    }

    // No such HPA in that namespace. Retrying cannot change that, so this is a plain
    // message with no retry prompt.
    if (data === null) {
        return (
            <Alert severity="warning" data-test-id="autoscaler-detail-not-found">
                <AlertTitle>Not found</AlertTitle>
                No HorizontalPodAutoscaler named "{name}" exists in namespace "{namespace}".
            </Alert>
        );
    }

    const reference = splitHpaReference(data.reference);
    const metricsPercent = metricPercent(data.metrics[0]);

    // The Details grid's plain label/value pairs. Namespace and the scale target are
    // rendered separately because both are links.
    const detailFields: [string, ReactNode][] = [
        ["Min replicas", String(data.minReplicas)],
        ["Max replicas", String(data.maxReplicas)],
        ["Current replicas", String(data.currentReplicas)],
        ["Desired replicas", String(data.desiredReplicas)],
        ["Age", <Timestamp value={data.createdAt} />],
    ];

    const annotations = Object.entries(data.annotations);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="autoscaler-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title={`Back to ${backLabel}`}>
                    <IconButton size="small" onClick={() => navigate(origin !== null ? origin.to : BACK_TO)}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <CopyNameButton
                    segments={[data.namespace, data.name]}
                    label="autoscaler name"
                    testId="autoscaler-detail-name-copy"
                />
                <Chip label="HorizontalPodAutoscaler" size="small" variant="outlined" data-test-id="autoscaler-detail-kind-chip" />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="autoscaler-detail-tabs"
                >
                    <Tab label="Details" value="detail" data-test-id="autoscaler-tab-detail" />
                    <Tab label="Labels" value="labels" data-test-id="autoscaler-tab-labels" />
                    <Tab label="Commands" value="commands" data-test-id="autoscaler-tab-commands" />
                    <Tab label="YAML" value="yaml" data-test-id="autoscaler-tab-yaml" />
                </Tabs>
            </Box>

            {activeTab === "detail" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="autoscaler-panel-detail">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                            <Box data-test-id="autoscaler-stat" data-stat="namespace">
                                <Typography variant="caption" color="text.secondary">Namespace</Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 30 }}>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                        <ResourceRef
                                            kind="Namespace"
                                            name={data.namespace}
                                            testId="autoscaler-detail-namespace-link"
                                            copyTestId="autoscaler-detail-namespace-copy"
                                            copyLabel="namespace"
                                        />
                                    </Typography>
                                </Box>
                            </Box>
                            <Box data-test-id="autoscaler-stat" data-stat="scale target">
                                <Typography variant="caption" color="text.secondary">Scale target</Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 30 }}>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                        <ResourceRef
                                            kind={reference.kind}
                                            name={reference.name}
                                            namespace={data.namespace}
                                            label={data.reference}
                                            testId="autoscaler-detail-reference"
                                        />
                                    </Typography>
                                </Box>
                            </Box>
                            {detailFields.map(([label, value]) => (
                                <Box key={label} data-test-id="autoscaler-stat" data-stat={label.toLowerCase()}>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }} data-test-id="autoscaler-scale">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Scale</Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Replicas</Typography>
                                <ResourceBarCell
                                    percent={replicaPercent(data)}
                                    displayText={formatReplicas(data)}
                                    level={replicaLevel(data)}
                                    testId="autoscaler-detail-replicas"
                                />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Targets</Typography>
                                <ResourceBarCell
                                    percent={metricsPercent}
                                    displayText={formatHpaMetrics(data.metrics)}
                                    level={metricLevel(metricsPercent)}
                                    testId="autoscaler-detail-targets"
                                />
                            </Box>
                        </Box>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }} data-test-id="autoscaler-metrics">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Metrics</Typography>
                        {data.metrics.length === 0
                            ? (
                                <Typography color="text.secondary" data-test-id="no-autoscaler-metrics">
                                    This autoscaler has no metric status yet.
                                </Typography>
                            )
                            : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Metric</TableCell>
                                                <TableCell>Current vs target</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.metrics.map((metric) => {
                                                const percent = metricPercent(metric);
                                                return (
                                                    <TableRow key={metric.name} data-test-id="autoscaler-metric-row" sx={tableRowSx(false)}>
                                                        <TableCell sx={{ fontFamily: "monospace" }}>{metric.name}</TableCell>
                                                        <TableCell>
                                                            <ResourceBarCell
                                                                percent={percent}
                                                                displayText={formatHpaMetrics([metric])}
                                                                level={metricLevel(percent)}
                                                                testId="autoscaler-metric"
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )
                        }
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }} data-test-id="autoscaler-conditions">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Conditions</Typography>
                        {data.conditions.length === 0
                            ? (
                                <Typography color="text.secondary" data-test-id="no-autoscaler-conditions">
                                    This autoscaler reports no conditions.
                                </Typography>
                            )
                            : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Type</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Reason</TableCell>
                                                <TableCell>Message</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.conditions.map((condition) => (
                                                <TableRow key={condition.type} data-test-id="autoscaler-condition-row" sx={tableRowSx(false)}>
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{condition.type}</TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{condition.status}</TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{condition.reason}</TableCell>
                                                    <TableCell>{condition.message}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )
                        }
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }} data-test-id="autoscaler-annotations">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Annotations</Typography>
                        {annotations.length === 0
                            ? (
                                <Typography color="text.secondary" data-test-id="no-autoscaler-annotations">
                                    This autoscaler has no annotations.
                                </Typography>
                            )
                            : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Key</TableCell>
                                                <TableCell>Value</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {annotations.map(([key, value]) => (
                                                <TableRow key={key} data-test-id="autoscaler-annotation-row" sx={tableRowSx(false)}>
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{key}</TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace", maxWidth: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</TableCell>
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

            {activeTab === "labels" && (
                <Box data-test-id="autoscaler-panel-labels">
                    <LabelsTab labels={data.labels} />
                </Box>
            )}

            {activeTab === "commands" && (
                <Box data-test-id="autoscaler-panel-commands">
                    <CommandsTab
                        target={{
                            kind: "horizontalpodautoscaler",
                            name: data.name,
                            namespace: data.namespace,
                        }}
                    />
                </Box>
            )}

            {activeTab === "yaml" && (
                <Box data-test-id="autoscaler-panel-yaml">
                    <YamlTabPanel
                        target={{
                            type: "horizontalpodautoscalers",
                            name: data.name,
                            namespace: data.namespace,
                        }}
                        active={activeTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
