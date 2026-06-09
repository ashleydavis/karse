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
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { useKubeContext } from "../../../lib/kube-context";
import { streamPodLogs } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";

// Fetches and displays logs for a pod, with container and tail-line selectors plus
// a refresh button. Logs load and follow live automatically when the panel mounts:
// the backend stream (`kubectl logs -f --tail=<n>`) delivers the recent backlog and
// then appends new lines as the cluster produces them, with no button to start it.
// The refresh button restarts the stream (re-fetching the backlog) and is disabled
// while the live stream is already running.
export function PodLogsPanel({ namespace, podName, containers }: {
    namespace: string;
    podName: string;
    containers: string[];
}) {
    const { current } = useKubeContext();
    const [selectedContainer, setSelectedContainer] = useState(containers[0] ?? "");
    const [tail, setTail] = useState(100);
    const [lines, setLines] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [streaming, setStreaming] = useState(false);
    // Bumped by the refresh button to restart the stream from scratch.
    const [refreshKey, setRefreshKey] = useState(0);
    const viewerRef = useRef<HTMLDivElement | null>(null);

    // Opens the live log stream on mount and whenever the context, container, tail,
    // or refresh key changes, tearing the previous stream down first. The stream
    // sends the recent backlog and then follows live; an error or the backend ending
    // the stream flips `streaming` off so the refresh button re-enables.
    useEffect(() => {
        if (current === null || containers.length === 0) {
            return;
        }
        setLines([]);
        setError(null);
        setStreaming(true);
        const handle = streamPodLogs(
            current,
            namespace,
            podName,
            selectedContainer || undefined,
            tail,
            {
                onLine: (line) => {
                    setLines((prev) => [...prev, line]);
                },
                onError: (message) => {
                    setError(message);
                    setStreaming(false);
                },
                onEnd: () => {
                    setStreaming(false);
                },
            },
        );
        return () => {
            handle.close();
        };
    }, [current, namespace, podName, selectedContainer, tail, containers.length, refreshKey]);

    // Auto-scrolls the viewer to the bottom as new lines arrive.
    useEffect(() => {
        const el = viewerRef.current;
        if (el !== null) {
            el.scrollTop = el.scrollHeight;
        }
    }, [lines]);

    // Streamed lines arrive newline-stripped, so they are rejoined with newlines.
    // While streaming with no lines yet, a progress indicator is shown instead of
    // text; once lines arrive they are rendered, and an idle stream shows "(no logs)".
    const hasLines = lines.length > 0;
    const content = hasLines
        ? lines.join("\n")
        : (streaming ? <LoadingIndicator /> : "(no logs)");

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
                    <span>
                        <IconButton
                            size="small"
                            onClick={() => setRefreshKey((k) => k + 1)}
                            disabled={streaming || containers.length === 0}
                            aria-label="refresh logs"
                            data-test-id="log-refresh"
                        >
                            <FontAwesomeIcon icon={faRotate} />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
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
                {content}
            </Paper>
        </Box>
    );
}
