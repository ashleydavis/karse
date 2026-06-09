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
    Tabs,
    Tab,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faTag } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchNamespaceDetail } from "../../lib/api-client";
import { YamlTabPanel } from "../../components/yaml-tab-panel";
import { CommandsTab } from "../../components/commands-tab";
import { tableRowSx } from "../../lib/table-row-style";
import { ResourcesTable } from "./components/resources-table";
import { namespaceResourceCount } from "../../lib/namespace-resource-count";

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

// Renders a colored chip for a namespace's lifecycle phase.
function PhaseChip({ phase }: { phase: string }) {
    const color = phase === "Active" ? "success" : phase === "Terminating" ? "warning" : "default";
    return <Chip label={phase} color={color} size="small" data-test-id="namespace-phase-chip" />;
}

// The set of tabs available on the namespace detail page.
type NamespaceDetailTab = "detail" | "resources" | "commands" | "yaml";

// Detail page for a single namespace. The Details tab shows the namespace's phase,
// age, labels, annotations, and any resource quotas / limit ranges. The Resources
// tab lists the resources contained in the namespace with search and sort. The
// Commands and YAML tabs reuse the app-wide tab components.
export function NamespaceDetailPage() {
    const { name } = useParams<{ name: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [activeTab, setActiveTab] = useState<NamespaceDetailTab>("detail");

    const { data, error, isLoading } = useQuery({
        queryKey: ["namespace-detail", current, name],
        queryFn: () => fetchNamespaceDetail(current!, name!),
        enabled: current !== null && !!name,
    });

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading || !data) {
        return null;
    }

    // "Resources" means pods, matching the namespaces list column. The Resources
    // tab still lists every kind (pods, deployments, stateful sets, daemon sets),
    // but the headline Resources stat counts pods only so the same namespace shows
    // the same number on the list and the detail page.
    const podCount = namespaceResourceCount(data.resources);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="namespace-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to namespaces">
                    <IconButton size="small" onClick={() => navigate("/namespaces")}>
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
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="namespace-detail-tabs"
                >
                    <Tab label="Status" value="detail" data-test-id="namespace-tab-detail" />
                    <Tab label="Resources" value="resources" data-test-id="namespace-tab-resources" />
                    <Tab label="Commands" value="commands" data-test-id="namespace-tab-commands" />
                    <Tab label="YAML" value="yaml" data-test-id="namespace-tab-yaml" />
                </Tabs>
            </Box>

            {activeTab === "detail" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="namespace-panel-detail">
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
                            {[
                                ["Name", data.name],
                                ["Phase", data.phase],
                                ["Age", formatAge(data.createdAt)],
                                ["Resources", `${podCount}`],
                            ].map(([label, value]) => (
                                <Box
                                    key={label}
                                    data-test-id="namespace-stat"
                                    data-stat={label.toLowerCase()}
                                >
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    {Object.keys(data.labels).length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2 }} data-test-id="namespace-labels">
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Labels</Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {Object.entries(data.labels).map(([k, v]) => (
                                    <Chip
                                        key={k}
                                        label={v === "" ? k : `${k}=${v}`}
                                        size="small"
                                        variant="outlined"
                                        icon={<FontAwesomeIcon icon={faTag} />}
                                    />
                                ))}
                            </Box>
                        </Paper>
                    )}

                    {Object.keys(data.annotations).length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2 }} data-test-id="namespace-annotations">
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Annotations</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Key</TableCell>
                                            <TableCell>Value</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(data.annotations).map(([k, v]) => (
                                            <TableRow key={k} sx={tableRowSx(false)}>
                                                <TableCell sx={{ fontFamily: "monospace" }}>{k}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace", maxWidth: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {data.quotas.length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2 }} data-test-id="namespace-quotas">
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Resource Quotas</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Quota</TableCell>
                                            <TableCell>Resource</TableCell>
                                            <TableCell>Hard limit</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.quotas.flatMap((q) =>
                                            Object.entries(q.hard).map(([resource, value]) => (
                                                <TableRow key={q.name + "/" + resource} data-test-id="namespace-quota-row" sx={tableRowSx(false)}>
                                                    <TableCell>{q.name}</TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{resource}</TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace" }}>{value}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {data.limits.length > 0 && (
                        <Paper variant="outlined" sx={{ p: 2 }} data-test-id="namespace-limits">
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Limit Ranges</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Resource</TableCell>
                                            <TableCell>Min</TableCell>
                                            <TableCell>Max</TableCell>
                                            <TableCell>Default request</TableCell>
                                            <TableCell>Default limit</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.limits.map((l, i) => (
                                            <TableRow key={i} data-test-id="namespace-limit-row" sx={tableRowSx(false)}>
                                                <TableCell>{l.type}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace" }}>{l.resource}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace" }}>{l.min}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace" }}>{l.max}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace" }}>{l.defaultRequest}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace" }}>{l.default}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </Box>
            )}

            {activeTab === "resources" && (
                <Box data-test-id="namespace-panel-resources">
                    <ResourcesTable resources={data.resources} onOpen={(path) => navigate(path)} />
                </Box>
            )}

            {activeTab === "commands" && (
                <Box data-test-id="namespace-panel-commands">
                    <CommandsTab target={{ kind: "namespace", name: data.name }} />
                </Box>
            )}

            {activeTab === "yaml" && (
                <Box data-test-id="namespace-panel-yaml">
                    <YamlTabPanel
                        target={{ type: "namespaces", name: data.name }}
                        active={activeTab === "yaml"}
                    />
                </Box>
            )}
        </Box>
    );
}
