import { useState, useEffect, useRef } from "react";
import {
    Box,
    Alert,
    Paper,
    IconButton,
    Tooltip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    FormControlLabel,
    Switch,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { fetchPodLogs, streamPodLogs } from "../lib/api-client";

// Fetches and displays logs for a pod, with container and tail-line selectors plus
// a Live toggle that follows the log via `kubectl logs -f` streamed over SSE.
export function PodLogsPanel({ namespace, podName, containers }: {
    namespace: string;
    podName: string;
    containers: string[];
}) {
    const { current } = useKubeContext();
    const [selectedContainer, setSelectedContainer] = useState(containers[0] ?? "");
    const [tail, setTail] = useState(100);
    const [live, setLive] = useState(false);
    const [liveLines, setLiveLines] = useState<string[]>([]);
    const [liveError, setLiveError] = useState<string | null>(null);
    const viewerRef = useRef<HTMLDivElement | null>(null);

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["logs", current, namespace, podName, selectedContainer, tail],
        queryFn: () => fetchPodLogs(current!, namespace, podName, selectedContainer || undefined, tail),
        // While live streaming is active the snapshot query is paused so the two
        // sources do not fight over the viewer contents.
        enabled: containers.length > 0 && !live,
    });

    // Opens a live log stream while `live` is on and tears it down when toggled off
    // or when the container/tail selection changes. Appends each incoming line and
    // surfaces stream errors.
    useEffect(() => {
        if (!live || current === null || containers.length === 0) {
            return;
        }
        setLiveLines([]);
        setLiveError(null);
        const handle = streamPodLogs(
            current,
            namespace,
            podName,
            selectedContainer || undefined,
            tail,
            {
                onLine: (line) => {
                    setLiveLines((prev) => [...prev, line]);
                },
                onError: (message) => {
                    setLiveError(message);
                },
            },
        );
        return () => {
            handle.close();
        };
    }, [live, current, namespace, podName, selectedContainer, tail, containers.length]);

    // When live is turned off, force a fresh snapshot fetch so the viewer shows
    // current logs rather than whatever react-query cached before streaming began.
    const wasLiveRef = useRef(false);
    useEffect(() => {
        if (wasLiveRef.current && !live) {
            refetch();
        }
        wasLiveRef.current = live;
    }, [live, refetch]);

    // Auto-scrolls the viewer to the bottom as new live lines arrive.
    useEffect(() => {
        if (!live) {
            return;
        }
        const el = viewerRef.current;
        if (el !== null) {
            el.scrollTop = el.scrollHeight;
        }
    }, [liveLines, live]);

    // Streamed lines arrive newline-stripped, so they are rejoined with newlines.
    const liveContent = liveLines.length > 0 ? liveLines.join("\n") : "(waiting for logs...)";
    const displayError = live ? liveError : (error ? (error as Error).message : null);
    const displayContent = live ? liveContent : (isLoading ? "Loading..." : (data?.logs || "(no logs)"));

    return (
        <Box data-test-id="pod-logs-panel">
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
                    <IconButton size="small" onClick={() => refetch()} disabled={isLoading || live} aria-label="refresh logs" data-test-id="log-refresh">
                        <FontAwesomeIcon icon={faRotate} />
                    </IconButton>
                </Tooltip>
                <FormControlLabel
                    control={
                        <Switch
                            checked={live}
                            onChange={(e) => setLive(e.target.checked)}
                            size="small"
                            slotProps={{ input: { "aria-label": "live logs" } }}
                        />
                    }
                    label="Live"
                    data-test-id="log-live-toggle"
                />
            </Box>
            {displayError && <Alert severity="error">{displayError}</Alert>}
            <Paper
                ref={viewerRef}
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
                {displayContent}
            </Paper>
        </Box>
    );
}
