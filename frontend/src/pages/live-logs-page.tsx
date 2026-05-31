import { useState, useRef, useEffect, useMemo } from "react";
import {
    Box,
    Typography,
    Paper,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    Alert,
    Chip,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import type { LogStreamLine } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchNamespaces, fetchPods, openLogStream } from "../lib/api-client";

// A rendered log line tagged with a stable key for React reconciliation.
type RenderedLine = LogStreamLine & { key: number };

// Palette used to color pod-name prefixes, cycling like stern does.
const PREFIX_COLORS = ["#4fc3f7", "#81c784", "#ffb74d", "#ba68c8", "#e57373", "#4db6ac", "#f06292", "#9575cd"];

// Deterministically maps a pod name to one of the prefix colors.
function colorForPod(pod: string): string {
    let hash = 0;
    for (let i = 0; i < pod.length; i++) {
        hash = (hash * 31 + pod.charCodeAt(i)) >>> 0;
    }
    return PREFIX_COLORS[hash % PREFIX_COLORS.length]!;
}

// Stern-style multi-pod live log streaming page. The user scopes the stream by
// namespace and an optional wildcard/substring pod filter, then streams live
// logs from every matching pod at once, each line prefixed with its pod name.
export function LiveLogsPage() {
    const { current } = useKubeContext();
    const [namespace, setNamespace] = useState<string>("");
    const [filter, setFilter] = useState<string>("");
    const [selectedPod, setSelectedPod] = useState<string>("");
    const [streaming, setStreaming] = useState(false);
    const [lines, setLines] = useState<RenderedLine[]>([]);
    const [matchedPods, setMatchedPods] = useState<string[]>([]);
    const [streamError, setStreamError] = useState<string | null>(null);

    // Holds the active stream's close function so it survives re-renders.
    const closeRef = useRef<(() => void) | null>(null);
    const keyRef = useRef(0);
    const logEndRef = useRef<HTMLDivElement | null>(null);

    const { data: namespacesData } = useQuery({
        queryKey: ["namespaces", current],
        queryFn: () => fetchNamespaces(current!),
        enabled: current !== null,
    });

    const { data: podsData } = useQuery({
        queryKey: ["pods", current, namespace],
        queryFn: () => fetchPods(current!, namespace || undefined),
        enabled: current !== null,
    });

    const namespaces = namespacesData?.namespaces ?? [];
    const pods = podsData?.pods ?? [];

    // The effective pod filter: an explicit pod selection wins over the text filter.
    const effectiveFilter = useMemo(() => selectedPod || filter, [selectedPod, filter]);

    // Stops any active stream and clears the close handle.
    function stopStream(): void {
        if (closeRef.current) {
            closeRef.current();
            closeRef.current = null;
        }
        setStreaming(false);
    }

    // Tears down the stream when the component unmounts.
    useEffect(() => {
        return () => {
            if (closeRef.current) {
                closeRef.current();
                closeRef.current = null;
            }
        };
    }, []);

    // Auto-scrolls to the newest line as logs arrive.
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ block: "end" });
    }, [lines]);

    // Opens a fresh stream with the current scope, replacing any existing one.
    function startStream(): void {
        if (current === null) {
            return;
        }
        stopStream();
        setLines([]);
        setMatchedPods([]);
        setStreamError(null);
        keyRef.current = 0;
        setStreaming(true);
        closeRef.current = openLogStream(current, namespace || undefined, effectiveFilter, 100, {
            onStarted: (started) => {
                setMatchedPods(started.pods.map((p) => p.name));
            },
            onLine: (line) => {
                setLines((prev) => {
                    const next = [...prev, { ...line, key: keyRef.current++ }];
                    // Cap the buffer so a long-running stream cannot exhaust memory.
                    if (next.length > 5000) {
                        next.splice(0, next.length - 5000);
                    }
                    return next;
                });
            },
            onError: (message) => {
                setStreamError(message);
            },
        });
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FontAwesomeIcon icon={["fas", "stream"]} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Live Logs
                </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                <div data-test-id="live-logs-namespace-select">
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Namespace</InputLabel>
                        <Select
                            value={namespace}
                            label="Namespace"
                            onChange={(e) => {
                                setNamespace(e.target.value);
                                setSelectedPod("");
                            }}
                        >
                            <MenuItem value="" data-test-id="live-logs-namespace-option">All namespaces</MenuItem>
                            {namespaces.map((ns) => (
                                <MenuItem key={ns.name} value={ns.name} data-test-id="live-logs-namespace-option">{ns.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>

                <div data-test-id="live-logs-pod-select">
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Pod</InputLabel>
                        <Select
                            value={selectedPod}
                            label="Pod"
                            onChange={(e) => setSelectedPod(e.target.value)}
                        >
                            <MenuItem value="" data-test-id="live-logs-pod-option">All pods (use filter)</MenuItem>
                            {pods.map((pod) => (
                                <MenuItem key={`${pod.namespace}/${pod.name}`} value={pod.name} data-test-id="live-logs-pod-option">{pod.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>

                <TextField
                    size="small"
                    label="Pod filter (wildcard, e.g. nginx-*)"
                    placeholder="substring or wildcard"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    disabled={selectedPod !== ""}
                    data-test-id="live-logs-filter"
                    sx={{ minWidth: 260 }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={["fas", "magnifying-glass"]} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />

                {!streaming ? (
                    <Button
                        variant="contained"
                        onClick={startStream}
                        disabled={current === null}
                        data-test-id="live-logs-start"
                        startIcon={<FontAwesomeIcon icon={["fas", "play"]} />}
                    >
                        Stream
                    </Button>
                ) : (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={stopStream}
                        data-test-id="live-logs-stop"
                        startIcon={<FontAwesomeIcon icon={["fas", "stop"]} />}
                    >
                        Stop
                    </Button>
                )}
            </Paper>

            {streamError && <Alert severity="error" data-test-id="live-logs-error">{streamError}</Alert>}

            {streaming && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }} data-test-id="live-logs-matched">
                    <Typography variant="caption" color="text.secondary">
                        Streaming {matchedPods.length} pod(s):
                    </Typography>
                    {matchedPods.map((name) => (
                        <Chip
                            key={name}
                            size="small"
                            label={name}
                            data-test-id="live-logs-matched-pod"
                            sx={{ bgcolor: colorForPod(name), color: "#000" }}
                        />
                    ))}
                </Box>
            )}

            <Paper
                variant="outlined"
                sx={{
                    p: 1.5,
                    flex: 1,
                    minHeight: 300,
                    bgcolor: "grey.900",
                    color: "grey.100",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                }}
                data-test-id="live-logs-viewer"
            >
                {lines.length === 0 ? (
                    <Typography component="span" sx={{ color: "grey.500", fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {streaming ? "Waiting for log lines..." : "Pick a scope and press Stream."}
                    </Typography>
                ) : (
                    lines.map((entry) => (
                        <Box key={entry.key} component="div" data-test-id="live-logs-line">
                            <Box component="span" sx={{ color: colorForPod(entry.pod), fontWeight: 600 }}>
                                {entry.namespace}/{entry.pod}
                            </Box>
                            <Box component="span"> {entry.line}</Box>
                        </Box>
                    ))
                )}
                <div ref={logEndRef} />
            </Paper>
        </Box>
    );
}
