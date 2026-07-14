import type { ReactNode } from "react";
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
import { faCircleInfo, faTriangleExclamation, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { ClusterEvent } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchEvents } from "../../lib/api-client";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { ResourceRef } from "../../components/resource-ref";
import { Timestamp } from "../../components/timestamp";
import { formatAge, formatLocalTime, UNKNOWN_TIMESTAMP } from "../../lib/timestamps";

// Formats a Kubernetes timestamp as an absolute local date-time, with the age in
// parentheses. The First/Last seen fields exist to report the absolute time, so
// they always show it and are not switched by the app-wide timestamp toggle; the
// Age field above them is what the toggle governs. Returns "-" for an empty or
// unparseable timestamp.
function formatSeenAt(timestamp: string): string {
    const localTime = formatLocalTime(timestamp);
    if (localTime === UNKNOWN_TIMESTAMP)
    {
        return UNKNOWN_TIMESTAMP;
    }
    return `${localTime} (${formatAge(timestamp)})`;
}

// Renders a colored MUI Chip for an event type value (Warning or Normal).
function TypeChip({ type }: { type: ClusterEvent["type"] }) {
    if (type === "Warning")
    {
        return (
            <Chip
                icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
                label="Warning"
                color="warning"
                size="small"
            />
        );
    }
    return (
        <Chip
            icon={<FontAwesomeIcon icon={faCircleInfo} />}
            label="Normal"
            color="default"
            size="small"
        />
    );
}

// Renders a single labelled field in the details grid.
function Field({ label, value, testId }: { label: string; value: ReactNode; testId: string }) {
    return (
        <Box data-test-id={testId}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-word" }}>{value}</Typography>
        </Box>
    );
}

// Detail page for a single Kubernetes event, reached by clicking an event row on
// the Events page (`/events/:uid`). Shows every field from the events table plus
// the full untruncated message, the first/last seen timestamps, and a link to the
// involved object's own detail page when Karse has one.
export function EventDetailPage() {
    const { uid } = useParams<{ uid: string }>();
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();

    // The Events page may be scoped to a namespace, but the detail page is reached
    // by uid and must find the event regardless of the active namespace, so it
    // fetches cluster-wide.
    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["events", current, null],
        queryFn: () => fetchEvents(current!),
        enabled: current !== null,
    });

    if (error)
    {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data)
    {
        return <LoadingIndicator />;
    }

    const event = data.events.find((e) => e.uid === uid);

    if (!event)
    {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Tooltip title="Back to events">
                        <IconButton size="small" onClick={() => navigate("/events")} aria-label="back to events">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Event</Typography>
                </Box>
                <Typography color="text.secondary" data-test-id="event-not-found">
                    This event was not found. It may have aged out of the cluster.
                </Typography>
            </Box>
        );
    }

    const objectLabel = `${event.objectKind}/${event.objectName}`;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="event-detail">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title="Back to events">
                    <IconButton size="small" onClick={() => navigate("/events")} aria-label="back to events">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{event.reason}</Typography>
                <TypeChip type={event.type} />
                <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Details</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1.5 }}>
                    <Field label="Type" value={event.type} testId="event-field-type" />
                    <Field label="Reason" value={event.reason} testId="event-field-reason" />
                    <Box data-test-id="event-field-object">
                        <Typography variant="caption" color="text.secondary">Object</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-word" }}>
                            <ResourceRef
                                kind={event.objectKind}
                                name={event.objectName}
                                namespace={event.namespace}
                                label={objectLabel}
                                testId="event-object-link"
                            />
                        </Typography>
                    </Box>
                    <Field label="Source / Component" value={event.source === "" ? "-" : event.source} testId="event-field-source" />
                    <Field label="Count" value={event.count} testId="event-field-count" />
                    <Field
                        label="Namespace"
                        // The namespace links to its own detail page, like the involved
                        // object above. A cluster-scoped event has none, so it shows "-".
                        value={event.namespace === ""
                            ? "-"
                            : <ResourceRef kind="Namespace" name={event.namespace} testId="event-namespace-link" />}
                        testId="event-field-namespace"
                    />
                    <Field label="Age" value={<Timestamp value={event.lastSeen} />} testId="event-field-age" />
                    <Field label="First seen" value={formatSeenAt(event.firstSeen)} testId="event-field-first-seen" />
                    <Field label="Last seen" value={formatSeenAt(event.lastSeen)} testId="event-field-last-seen" />
                </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Message</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} data-test-id="event-field-message">
                    {event.message}
                </Typography>
            </Paper>
        </Box>
    );
}
