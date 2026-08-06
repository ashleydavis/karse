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
    Alert,
    AlertTitle,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchResourceDetail } from "../../lib/api-client";
import { resolveResourceKind } from "../../lib/resource-link";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { LabelsTab } from "../../components/labels-tab";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { ResourceRef } from "../../components/resource-ref";
import { CopyNameButton } from "../../components/copy-button";
import { Timestamp } from "../../components/timestamp";
import { tableRowSx } from "../../lib/table-row-style";

// The set of tabs available on the generic detail page. There is no Status detail
// beyond the common metadata, so the first tab is simply Details.
type ResourceDetailTab = "detail" | "labels" | "yaml";

// The page the generic detail page returns to. Its resource is not on any per-kind list
// page (that is why it has no page of its own), so All resources is the list it came from.
const BACK_TO = "/all-resources";

// Detail page for a resource of any kind that has no purpose-built detail page in Karse
// (a ReplicaSet, a Job, a Service, a HorizontalPodAutoscaler, and so on). It shows the
// metadata every Kubernetes object carries: kind, name, namespace where namespaced, age,
// annotations, plus the resource's labels and raw YAML on their own sub tabs.
//
// The kind is taken from the URL, not fixed per route, so one page serves every kind. Two
// routes reach it: /resources/:type/:name for a cluster-scoped kind and
// /resources/:type/:namespace/:name for a namespaced one, matching how the rest of the app
// routes cluster-scoped and namespaced resources.
export function ResourceDetailPage() {
    const { type, namespace, name } = useParams<{ type: string; namespace?: string; name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [activeTab, setActiveTab] = useState<ResourceDetailTab>("detail");

    const resolved = resolveResourceKind(type ?? "");

    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["resource-detail", current, resolved?.token, namespace ?? "", name],
        queryFn: () => fetchResourceDetail(current!, resolved!.token, name!, namespace),
        enabled: current !== null && resolved !== null && !!name,
    });

    // A kind Karse will not read at all (a hand-typed or stale URL). Say so rather than
    // firing a request the backend would reject with the same answer.
    if (resolved === null) {
        return (
            <Alert severity="error" data-test-id="resource-detail-unsupported">
                <AlertTitle>Unsupported resource type</AlertTitle>
                Karse cannot show resources of type "{type}".
            </Alert>
        );
    }

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    // The query is still in flight, or has not started because no context is selected yet.
    // Either way the answer is unknown, so show the shared spinner rather than a wrong one.
    if (isPending || data === undefined) {
        return <LoadingIndicator />;
    }

    // The resource does not exist, or the cluster does not serve that kind at all.
    // Retrying cannot change either, so this is a plain message with no retry.
    if (data === null) {
        return (
            <Alert severity="warning" data-test-id="resource-detail-not-found">
                <AlertTitle>Not found</AlertTitle>
                No {resolved.info.kind} named "{name}"
                {resolved.info.namespaced ? ` in namespace "${namespace}"` : ""} exists in this cluster.
            </Alert>
        );
    }

    // The Details grid's label/value pairs: the kind, then the age. The values are
    // ReactNodes because Age is a <Timestamp>, which renders as an age or a local time
    // per the app-wide mode. The namespace is rendered separately, as a link.
    const detailFields: [string, ReactNode][] = [
        ["Kind", data.kind],
        ["Age", <Timestamp value={data.createdAt} />],
    ];

    const annotations = Object.entries(data.annotations);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="resource-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to all resources">
                    <IconButton size="small" onClick={() => navigate(BACK_TO)}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {data.name}
                </Typography>
                <CopyNameButton
                    segments={data.namespace === "" ? [data.name] : [data.namespace, data.name]}
                    label="resource name"
                    testId="resource-detail-name-copy"
                />
                <Chip label={data.kind} size="small" variant="outlined" data-test-id="resource-detail-kind-chip" />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="resource-detail-tabs"
                >
                    <Tab label="Details" value="detail" data-test-id="resource-tab-detail" />
                    <Tab label="Labels" value="labels" data-test-id="resource-tab-labels" />
                    <Tab label="YAML" value="yaml" data-test-id="resource-tab-yaml" />
                </Tabs>
            </Box>

            {activeTab === "detail" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="resource-panel-detail">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                            {data.namespace !== "" && (
                                <Box data-test-id="resource-stat" data-stat="namespace">
                                    <Typography variant="caption" color="text.secondary">Namespace</Typography>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 30 }}>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                            <ResourceRef
                                                kind="Namespace"
                                                name={data.namespace}
                                                testId="resource-detail-namespace-link"
                                                copyTestId="resource-detail-namespace-copy"
                                                copyLabel="namespace"
                                            />
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            {detailFields.map(([label, value]) => (
                                <Box key={label} data-test-id="resource-stat" data-stat={label.toLowerCase()}>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }} data-test-id="resource-annotations">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Annotations</Typography>
                        {annotations.length === 0
                            ? (
                                <Typography color="text.secondary" data-test-id="no-resource-annotations">
                                    This resource has no annotations.
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
                                                <TableRow key={key} data-test-id="resource-annotation-row" sx={tableRowSx(false)}>
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
                <Box data-test-id="resource-panel-labels">
                    <LabelsTab labels={data.labels} />
                </Box>
            )}

            {activeTab === "yaml" && (
                <Box data-test-id="resource-panel-yaml">
                    <YamlTabPanel
                        target={{
                            type: resolved.token,
                            name: data.name,
                            namespace: data.namespace === "" ? undefined : data.namespace,
                        }}
                        active={activeTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
