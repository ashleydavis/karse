import { useState, useRef, useEffect, useMemo } from "react";
import type { UIEvent, PointerEvent as ReactPointerEvent } from "react";
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
    AlertTitle,
    Chip,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlay, faStop, faStream } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { LogStreamLine } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNamespaces, fetchPods, openLogStream } from "../../lib/api-client";
import { LoadingIndicator } from "../../components/loading-indicator";
import { shouldFollow, bottomScrollTop, thumbMetrics, scrollTopForThumbTop, type ThumbMetrics } from "../../lib/log-autoscroll";

// A rendered log line tagged with a stable key for React reconciliation.
type RenderedLine = LogStreamLine & { key: number };

// Palette used to color pod-name prefixes, cycling like stern does.
const PREFIX_COLORS = ["#4fc3f7", "#81c784", "#ffb74d", "#ba68c8", "#e57373", "#4db6ac", "#f06292", "#9575cd"];

// Maximum number of streaming-pod chips shown before the list is collapsed
// behind a "..." expander, so a large stream does not eat vertical space.
const MAX_VISIBLE_POD_CHIPS = 8;

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
    // Whether the full streaming-pod list is expanded past the chip cap.
    const [showAllPods, setShowAllPods] = useState(false);
    // True when the user pressed Stream without scoping to any pod/wildcard, so
    // the page should show guidance on how to pick pods instead of streaming.
    const [needsSelection, setNeedsSelection] = useState(false);

    // Holds the active stream's close function so it survives re-renders.
    const closeRef = useRef<(() => void) | null>(null);
    const keyRef = useRef(0);
    // The scrollable log viewer element, so the append effect can read its scroll
    // metrics and pin it to the bottom when auto-following.
    const viewerRef = useRef<HTMLDivElement | null>(null);
    // Whether the view is currently auto-following the newest line. Starts true
    // (a fresh stream follows) and flips to false once the user scrolls up, back
    // to true once they scroll to the bottom again. A ref (not state) because the
    // append effect reads it synchronously and it must not trigger re-renders.
    const followRef = useRef(true);
    // Geometry of the custom scrollbar thumb. The browser renders native
    // scrollbars as invisible auto-hiding overlays, so the viewer draws its own
    // always-visible bar; this state positions its thumb from the scroll metrics.
    const [thumb, setThumb] = useState<ThumbMetrics>({ visible: false, heightPx: 0, topPx: 0 });
    // Active thumb-drag gesture, captured on pointer-down so pointer-move maps the
    // pointer's travel into a scrollTop. Null when not dragging.
    const dragRef = useRef<{ startY: number; startTop: number; trackPx: number; thumbHeightPx: number } | null>(null);

    // Re-reads the viewer's scroll metrics and repositions the custom scrollbar
    // thumb. Called after lines append and on every user scroll.
    function refreshThumb(): void {
        const viewer = viewerRef.current;
        if (viewer === null) {
            return;
        }
        setThumb(thumbMetrics(
            { scrollTop: viewer.scrollTop, scrollHeight: viewer.scrollHeight, clientHeight: viewer.clientHeight },
            viewer.clientHeight,
        ));
    }

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

    // Keeps the view pinned to the newest line as logs arrive, but only while
    // auto-following. The follow flag is decided from the scroll position *before*
    // these new lines grew the content: see the viewer's onScroll handler. If the
    // user has scrolled up, the scroll position is left untouched.
    useEffect(() => {
        const viewer = viewerRef.current;
        if (viewer === null) {
            return;
        }
        if (followRef.current) {
            viewer.scrollTop = bottomScrollTop(viewer);
        }
        refreshThumb();
    }, [lines]);

    // Repositions the thumb after a layout-affecting resize (the track height is
    // the viewer's client height) and on the first paint with content.
    useEffect(() => {
        refreshThumb();
        const viewer = viewerRef.current;
        if (viewer === null || typeof ResizeObserver === "undefined") {
            return;
        }
        const observer = new ResizeObserver(() => refreshThumb());
        observer.observe(viewer);
        return () => observer.disconnect();
    }, []);

    // Recomputes the follow flag whenever the user scrolls the viewer: following
    // resumes when they return to the bottom and stops when they scroll up. Driven
    // by the user's own scrolling, so it reflects intent rather than the auto-pin.
    function handleViewerScroll(event: UIEvent<HTMLDivElement>): void {
        const viewer = event.currentTarget;
        followRef.current = shouldFollow(viewer);
        refreshThumb();
    }

    // Starts dragging the custom scrollbar thumb. Subsequent pointer-moves map the
    // pointer's vertical travel onto the viewer's scrollTop until pointer-up.
    function handleThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
        const viewer = viewerRef.current;
        if (viewer === null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        dragRef.current = {
            startY: event.clientY,
            startTop: thumb.topPx,
            trackPx: viewer.clientHeight,
            thumbHeightPx: thumb.heightPx,
        };
    }

    function handleThumbPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
        const drag = dragRef.current;
        const viewer = viewerRef.current;
        if (drag === null || viewer === null) {
            return;
        }
        const nextThumbTop = drag.startTop + (event.clientY - drag.startY);
        // A drag means the user is taking manual control, so stop auto-following.
        followRef.current = false;
        viewer.scrollTop = scrollTopForThumbTop(nextThumbTop, viewer, drag.trackPx, drag.thumbHeightPx);
        refreshThumb();
    }

    function handleThumbPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        dragRef.current = null;
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    }

    // Opens a fresh stream with the current scope, replacing any existing one.
    function startStream(): void {
        if (current === null) {
            return;
        }
        // Streaming every pod at once is not feasible, so the user must scope the
        // stream first. If neither a pod nor a wildcard/substring filter is given,
        // refuse to stream and show guidance instead of opening an "all pods" stream.
        if (effectiveFilter.trim() === "") {
            stopStream();
            setLines([]);
            setMatchedPods([]);
            setStreamError(null);
            setNeedsSelection(true);
            return;
        }
        stopStream();
        setLines([]);
        setMatchedPods([]);
        setShowAllPods(false);
        setStreamError(null);
        setNeedsSelection(false);
        keyRef.current = 0;
        // A fresh stream starts pinned to the bottom (following the newest line).
        followRef.current = true;
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
                <FontAwesomeIcon icon={faStream} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Logs
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
                            onChange={(e) => {
                                setSelectedPod(e.target.value);
                                if (e.target.value !== "") {
                                    setNeedsSelection(false);
                                }
                            }}
                        >
                            <MenuItem value="" data-test-id="live-logs-pod-option">Pick a pod (or use filter)</MenuItem>
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
                    onChange={(e) => {
                        setFilter(e.target.value);
                        if (e.target.value.trim() !== "") {
                            setNeedsSelection(false);
                        }
                    }}
                    disabled={selectedPod !== ""}
                    data-test-id="live-logs-filter"
                    sx={{ minWidth: 260 }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
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
                        startIcon={<FontAwesomeIcon icon={faPlay} />}
                    >
                        Stream
                    </Button>
                ) : (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={stopStream}
                        data-test-id="live-logs-stop"
                        startIcon={<FontAwesomeIcon icon={faStop} />}
                    >
                        Stop
                    </Button>
                )}
            </Paper>

            {needsSelection && (
                <Alert severity="info" data-test-id="live-logs-needs-selection">
                    <AlertTitle>Pick which pods to stream first</AlertTitle>
                    Streaming every pod at once is not supported. Choose a single pod from the
                    &quot;Pod&quot; dropdown, or type a wildcard/substring (for example{" "}
                    <code>nginx-*</code>) into the &quot;Pod filter&quot; field, then press Stream.
                </Alert>
            )}

            {streamError && <Alert severity="error" data-test-id="live-logs-error">{streamError}</Alert>}

            {streaming && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }} data-test-id="live-logs-matched">
                    <Typography variant="caption" color="text.secondary">
                        Streaming {matchedPods.length} pod(s):
                    </Typography>
                    {(showAllPods ? matchedPods : matchedPods.slice(0, MAX_VISIBLE_POD_CHIPS)).map((name) => (
                        <Chip
                            key={name}
                            size="small"
                            label={name}
                            data-test-id="live-logs-matched-pod"
                            sx={{ bgcolor: colorForPod(name), color: "#000" }}
                        />
                    ))}
                    {matchedPods.length > MAX_VISIBLE_POD_CHIPS && !showAllPods && (
                        <Chip
                            size="small"
                            label={`... +${matchedPods.length - MAX_VISIBLE_POD_CHIPS} more`}
                            onClick={() => setShowAllPods(true)}
                            data-test-id="live-logs-matched-expand"
                            sx={{ fontWeight: 600 }}
                        />
                    )}
                    {matchedPods.length > MAX_VISIBLE_POD_CHIPS && showAllPods && (
                        <Chip
                            size="small"
                            label="Show fewer"
                            onClick={() => setShowAllPods(false)}
                            data-test-id="live-logs-matched-collapse"
                            sx={{ fontWeight: 600 }}
                        />
                    )}
                </Box>
            )}

            {/* The viewer and its custom scrollbar share a relative-positioned
                wrapper so the bar can be drawn over the viewer's right edge. The
                native scrollbar is hidden (this browser renders it as an invisible
                auto-hiding overlay), and an always-visible bar is drawn instead so
                the streamed history is plainly reachable. */}
            <Box sx={{ position: "relative", flex: 1, minHeight: 300, display: "flex" }}>
                <Paper
                    ref={viewerRef}
                    onScroll={handleViewerScroll}
                    variant="outlined"
                    sx={{
                        p: 1.5,
                        // Leave room on the right so log text does not run under the
                        // custom scrollbar that is overlaid there.
                        pr: 3,
                        flex: 1,
                        bgcolor: "grey.900",
                        color: "grey.100",
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        overflowY: "scroll",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        // Hide the native scrollbar: it renders as an invisible
                        // auto-hiding overlay against the dark panel here, so the
                        // custom bar below is the visible, usable one.
                        scrollbarWidth: "none",
                        "&::-webkit-scrollbar": { display: "none" },
                    }}
                    data-test-id="live-logs-viewer"
                >
                    {lines.length === 0 ? (
                        streaming ? (
                            <LoadingIndicator />
                        ) : (
                            <Typography component="span" sx={{ color: "grey.500", fontFamily: "monospace", fontSize: "0.75rem" }}>
                                Pick a pod or wildcard, then press Stream.
                            </Typography>
                        )
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
                </Paper>

                {/* Always-visible custom scrollbar track. Drawn only when the
                    content overflows; the thumb is draggable to scroll. */}
                {thumb.visible && (
                    <Box
                        data-test-id="live-logs-scrollbar-track"
                        sx={{
                            position: "absolute",
                            top: 4,
                            bottom: 4,
                            right: 4,
                            width: "12px",
                            borderRadius: "6px",
                            backgroundColor: "#3a3f4b",
                            border: "1px solid #4b5563",
                        }}
                    >
                        <Box
                            data-test-id="live-logs-scrollbar-thumb"
                            onPointerDown={handleThumbPointerDown}
                            onPointerMove={handleThumbPointerMove}
                            onPointerUp={handleThumbPointerUp}
                            sx={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: `${thumb.topPx}px`,
                                height: `${thumb.heightPx}px`,
                                borderRadius: "6px",
                                backgroundColor: "#cbd5e1",
                                cursor: "grab",
                                "&:hover": { backgroundColor: "#e2e8f0" },
                                "&:active": { cursor: "grabbing" },
                            }}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
}
