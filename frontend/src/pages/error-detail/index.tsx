import { useParams } from "react-router-dom";
import {
    Box,
    Typography,
    Chip,
    Paper,
    IconButton,
    Tooltip,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCircleExclamation, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { ClusterError } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useKubeNamespace } from "../../lib/kube-namespace";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchErrors } from "../../lib/api-client";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { ResourceRef } from "../../components/resource-ref";

// Formats a Kubernetes timestamp into a human-readable age string, falling back
// to "-" when the timestamp is empty/unknown.
function formatAge(timestamp: string): string {
    if (timestamp === "") {
        return "-";
    }
    const ms = Date.now() - new Date(timestamp).getTime();
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

// Formats a Kubernetes timestamp into an absolute, human-readable date-time with
// the computed age in parentheses, or "-" when unknown.
function formatTimestamp(timestamp: string): string {
    if (timestamp === "") {
        return "-";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }
    return `${date.toLocaleString()} (${formatAge(timestamp)} ago)`;
}

// Renders a colored MUI Chip indicating where an error originated.
function SourceChip({ source }: { source: ClusterError["source"] }) {
    if (source === "Pod") {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faCircleExclamation} />}
                label="Pod"
                color="error"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            label="Event"
            color="warning"
            size="small"
        />
    );
}

// Detail page for a single error condition. The Errors list has no stable
// per-error identifier, so a row links here by its index into the same
// newest-first list returned by GET /api/errors; this page re-fetches that list
// and selects the matching row. Shows every table field, the full untruncated
// message, the first- and last-seen times, and a link to the related object's
// detail page.
export function ErrorDetailPage() {
    const { index } = useParams<{ index: string }>();
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["errors", current, namespace],
        queryFn: () => fetchErrors(current!, namespace ?? undefined),
        enabled: current !== null,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    const errors = data.errors;
    const position = Number(index);
    const item = Number.isInteger(position) && position >= 0 ? errors[position] : undefined;

    if (item === undefined) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Tooltip title="Back to errors">
                        <IconButton size="small" onClick={() => navigate("/errors")} data-test-id="error-detail-back">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Error not found
                    </Typography>
                </Box>
                <Typography color="text.secondary" data-test-id="error-detail-missing">
                    This error is no longer in the current list. Go back to the Errors page.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="error-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to errors">
                    <IconButton size="small" onClick={() => navigate("/errors")} data-test-id="error-detail-back">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }} data-test-id="error-detail-reason">
                    {item.reason}
                </Typography>
                <SourceChip source={item.source} />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1.5 }}>
                    <Box data-test-id="error-detail-source">
                        <Typography variant="caption" color="text.secondary">Source</Typography>
                        <Typography variant="body2">{item.source}</Typography>
                    </Box>
                    <Box data-test-id="error-detail-object">
                        <Typography variant="caption" color="text.secondary">Object</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            <ResourceRef
                                kind={item.objectKind}
                                name={item.objectName}
                                namespace={item.namespace}
                                label={`${item.objectKind}/${item.objectName}`}
                                testId="error-detail-object-link"
                            />
                        </Typography>
                    </Box>
                    <Box data-test-id="error-detail-reason-field">
                        <Typography variant="caption" color="text.secondary">Reason</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{item.reason}</Typography>
                    </Box>
                    <Box data-test-id="error-detail-namespace">
                        <Typography variant="caption" color="text.secondary">Namespace</Typography>
                        {/* The namespace links to its own detail page, like the related
                            object above. A cluster-scoped error has none, so it shows "-". */}
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {item.namespace === ""
                                ? "-"
                                : <ResourceRef kind="Namespace" name={item.namespace} testId="error-detail-namespace-link" />}
                        </Typography>
                    </Box>
                    <Box data-test-id="error-detail-count">
                        <Typography variant="caption" color="text.secondary">Count</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{item.count}</Typography>
                    </Box>
                    <Box data-test-id="error-detail-age">
                        <Typography variant="caption" color="text.secondary">Age</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{formatAge(item.lastSeen)}</Typography>
                    </Box>
                    <Box data-test-id="error-detail-first-seen">
                        <Typography variant="caption" color="text.secondary">First seen</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{formatTimestamp(item.firstSeen)}</Typography>
                    </Box>
                    <Box data-test-id="error-detail-last-seen">
                        <Typography variant="caption" color="text.secondary">Last seen</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{formatTimestamp(item.lastSeen)}</Typography>
                    </Box>
                </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Message</Typography>
                <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    data-test-id="error-detail-message"
                >
                    {item.message}
                </Typography>
            </Paper>
        </Box>
    );
}
