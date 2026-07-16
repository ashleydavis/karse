import { useState, useRef, useEffect, useCallback } from "react";
import type { UIEvent, PointerEvent as ReactPointerEvent } from "react";
import {
    Box,
    Typography,
    Paper,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    IconButton,
    Tooltip,
    Alert,
    AlertTitle,
    Chip,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faStop, faCircleXmark, faAnglesUp, faAnglesDown } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { LogStreamLine } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchNamespaces, fetchPods, openLogStream } from "../lib/api-client";
import { PodFilter } from "./pod-filter";
import { LoadingIndicator } from "./loading-indicator";
import { shouldFollow, bottomScrollTop, thumbMetrics, scrollTopForThumbTop, type ThumbMetrics } from "../lib/log-autoscroll";
import { tokenizeLogLine } from "../lib/log-highlight";
import { colorForPod } from "../lib/log-pod-colors";

// A rendered log line tagged with a stable key for React reconciliation.
type RenderedLine = LogStreamLine & { key: number };

// Maximum number of streaming-pod chips shown before the list is collapsed
// behind a "..." expander, so a large stream does not eat vertical space.
const MAX_VISIBLE_POD_CHIPS = 8;

// Builds the "last updated" caption from the timestamp of the most recent log
// line. Reads "Updated just now" within the first few seconds, then ages into
// "Updated Ns/Nm/Nh ago" so the user can tell how fresh the streamed output is.
function formatLastUpdated(lastLineAt: number | null, now: number): string {
    if (lastLineAt === null) {
        return "No logs yet";
    }
    const seconds = Math.max(0, Math.floor((now - lastLineAt) / 1000));
    if (seconds < 5) {
        return "Updated just now";
    }
    if (seconds < 60) {
        return `Updated ${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `Updated ${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    return `Updated ${hours}h ago`;
}

// Renders one log line's text with "error" highlighted red and "warning"
// yellow. The line is split by `tokenizeLogLine` (whole-word, case-insensitive)
// and each matched keyword is wrapped in a bold, coloured span while plain
// segments render unchanged, so the displayed text matches the stored text.
// Colours use the theme palette's lighter error/warning shades, which stay
// legible on the viewer's dark panel in both the light and dark app themes.
function HighlightedLogLine({ text }: { text: string }) {
    return (
        <>
            {tokenizeLogLine(text).map((segment, index) => {
                if (segment.kind === "plain") {
                    return (
                        <Box component="span" key={index}>
                            {segment.text}
                        </Box>
                    );
                }
                return (
                    <Box
                        component="span"
                        key={index}
                        data-test-id={`log-highlight-${segment.kind}`}
                        sx={{
                            color: segment.kind === "error" ? "error.light" : "warning.light",
                            fontWeight: 700,
                        }}
                    >
                        {segment.text}
                    </Box>
                );
            })}
        </>
    );
}

// Props for the shared log viewer. `testIdPrefix` namespaces every data-test-id
// so the Logs page and the Pod detail Logs tab stay independently addressable.
// `fixedPod` pins the viewer to a single pod (the Pod detail Logs tab): when set,
// the namespace selector and pod picker are hidden and the stream auto-starts for
// that one pod on mount; when absent, the full searchable picker is shown (the
// Logs page) and the user scopes and presses Stream themselves.
export type LogViewerProps = {
    testIdPrefix: string;
    fixedPod?: { namespace: string; podName: string };
};

// The shared logs component used by both the Logs page and the Pod detail Logs
// tab, so the two surfaces expose the same options. It scopes a multi-pod live
// stream (via /api/logs/stream), renders each line prefixed with its pod name,
// and keeps the view pinned to the newest line with a custom always-visible
// scrollbar. There is no "Tail" option and no Refresh button: a fresh stream is
// started by re-scoping (Logs page) or by re-mounting (Pod detail tab).
export function LogViewer({ testIdPrefix, fixedPod }: LogViewerProps) {
    const { current } = useKubeContext();
    const [namespace, setNamespace] = useState<string>(fixedPod?.namespace ?? "");
    // The pod-picker search box. It filters the checkbox list, and when no pod is
    // explicitly checked it doubles as the wildcard/substring filter sent to the
    // backend (reconciling with logs-require-pods-1's "scope before streaming" gate).
    const [search, setSearch] = useState<string>("");
    // Names of the pods the user has checked in the picker. An explicit selection
    // takes precedence over the search filter when streaming.
    const [selectedPods, setSelectedPods] = useState<string[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [lines, setLines] = useState<RenderedLine[]>([]);
    const [matchedPods, setMatchedPods] = useState<string[]>([]);
    const [streamError, setStreamError] = useState<string | null>(null);
    // Whether the full streaming-pod list is expanded past the chip cap.
    const [showAllPods, setShowAllPods] = useState(false);
    // True when the user pressed Stream without scoping to any pod/wildcard, so
    // the page should show guidance on how to pick pods instead of streaming.
    const [needsSelection, setNeedsSelection] = useState(false);
    // Epoch ms of the most recent appended log line, or null before any arrive.
    // Drives the "Updated ..." caption next to the Stream/Stop button.
    const [lastLineAt, setLastLineAt] = useState<number | null>(null);
    // A clock that ticks once a second so the relative "Updated ..." caption
    // ages without a new log line having to arrive.
    const [now, setNow] = useState<number>(() => Date.now());

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

    // The namespace and pod lists back the picker, so they are only fetched in
    // full-picker mode. A fixed pod already knows its scope.
    const pickerEnabled = fixedPod === undefined && current !== null;

    const { data: namespacesData } = useQuery({
        queryKey: ["namespaces", current],
        queryFn: () => fetchNamespaces(current!),
        enabled: pickerEnabled,
    });

    const { data: podsData } = useQuery({
        queryKey: ["pods", current, namespace],
        queryFn: () => fetchPods(current!, namespace || undefined),
        enabled: pickerEnabled,
    });

    const namespaces = namespacesData?.namespaces ?? [];
    const pods = podsData?.pods ?? [];

    // Toggles a pod's membership in the explicit selection set.
    function togglePod(name: string): void {
        setNeedsSelection(false);
        setSelectedPods((prev) =>
            prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
        );
    }

    // Clears the explicit pod selection, returning the picker to search-filter mode.
    function clearSelection(): void {
        setSelectedPods([]);
    }

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

    // Jumps the viewer straight to its first or last line, backing the Logs page's
    // jump-to-top / jump-to-bottom buttons. Auto-follow is re-derived from where the
    // jump lands, the same rule the wheel, keyboard and thumb-drag paths use, so
    // jumping to the top stops following and jumping to the bottom re-engages it: the
    // view then stays locked to the end as new lines arrive, exactly as if the user had
    // scrolled back to the bottom by hand. Reading the landed position (rather than
    // trusting the scroll event) matters because assigning scrollTop only fires a scroll
    // event when the value actually changes, so jumping to the bottom while already
    // there fires none.
    function jumpTo(edge: "top" | "bottom"): void {
        const viewer = viewerRef.current;
        if (viewer === null) {
            return;
        }
        viewer.scrollTop = edge === "top" ? 0 : bottomScrollTop(viewer);
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
        viewer.scrollTop = scrollTopForThumbTop(nextThumbTop, viewer, drag.trackPx, drag.thumbHeightPx);
        // Decide auto-follow from where the drag actually landed, not from the fact that a
        // drag happened. Assigning scrollTop only fires a scroll event when the value
        // *changes*, so handleViewerScroll cannot be relied on to settle the flag here: a
        // drag that ends at the bottom (or a jitter that never moves the viewer off the
        // bottom at all) would leave follow switched off with no scroll event left to
        // switch it back on, and auto-follow would then never resume for the rest of the
        // session. Reading the landed position instead means dragging up stops following
        // and dragging back down to the bottom re-arms it, exactly like a wheel scroll.
        followRef.current = shouldFollow(viewer);
        refreshThumb();
    }

    function handleThumbPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        dragRef.current = null;
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    }

    // Ticks the clock once a second so the relative "Updated ..." caption ages
    // on its own. Only runs once a line has arrived; idle until then.
    useEffect(() => {
        if (lastLineAt === null) {
            return;
        }
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [lastLineAt]);

    // Opens a fresh stream with the given scope, replacing any existing one. The
    // scope is either an explicit pod list (checkbox selection or the fixed pod)
    // or a wildcard/substring filter; with neither, streaming is refused and
    // guidance is shown instead (see logs-require-pods-1).
    const startStream = useCallback((scope: { pods: string[]; filter: string; ns: string | undefined }): void => {
        if (current === null) {
            return;
        }
        if (scope.pods.length === 0 && scope.filter.trim() === "") {
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
        setLastLineAt(null);
        keyRef.current = 0;
        // A fresh stream starts pinned to the bottom (following the newest line).
        followRef.current = true;
        setStreaming(true);
        closeRef.current = openLogStream(current, scope.ns, scope.pods, scope.filter, 100, {
            onStarted: (started) => {
                setMatchedPods(started.pods.map((p) => p.name));
            },
            onLine: (line) => {
                // Record when the latest line landed so the "Updated ..."
                // caption reflects the freshest output.
                setLastLineAt(Date.now());
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
    }, [current]);

    // The Logs page Stream button: an explicit checkbox selection wins, otherwise
    // the search box is the wildcard/substring filter the backend matches against.
    function handleStreamClick(): void {
        const filterText = selectedPods.length > 0 ? "" : search;
        startStream({ pods: selectedPods, filter: filterText, ns: namespace || undefined });
    }

    // Removes one pod from the streamed set, driven by the close button on its
    // chip in the "Streaming N pod(s)" row. The pods left over become the explicit
    // selection and the stream is restarted over just them, so the removed pod's
    // follow is torn down and no further lines arrive from it. That leaves exactly
    // the state the user would reach by unticking the pod in the picker and
    // pressing Stream again, keeping the two routes to removal consistent.
    // Removing the last pod stops the stream and returns the page to its empty
    // state (the "Check pods or type a search, then press Stream." placeholder).
    function removeStreamingPod(name: string): void {
        const remaining = matchedPods.filter((pod) => pod !== name);
        setSelectedPods(remaining);
        setSearch("");
        if (remaining.length === 0) {
            stopStream();
            setLines([]);
            setMatchedPods([]);
            setStreamError(null);
            setLastLineAt(null);
            return;
        }
        startStream({
            pods: remaining,
            filter: "",
            ns: namespace || undefined,
        });
    }

    // Fixed-pod mode (the Pod detail Logs tab) auto-starts the stream for its one
    // pod on mount, mirroring the Logs page's behaviour once a pod is chosen.
    // Re-runs if the context or pinned pod changes.
    useEffect(() => {
        if (fixedPod === undefined || current === null) {
            return;
        }
        startStream({ pods: [fixedPod.podName], filter: "", ns: fixedPod.namespace });
    }, [fixedPod, current, startStream]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%", flex: 1, minWidth: 0 }} data-test-id={`${testIdPrefix}-log-viewer`}>
            {fixedPod === undefined && (
                <Paper variant="outlined" sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                    <div data-test-id={`${testIdPrefix}-namespace-select`}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Namespace</InputLabel>
                            <Select
                                value={namespace}
                                label="Namespace"
                                onChange={(e) => {
                                    setNamespace(e.target.value);
                                    setSelectedPods([]);
                                    setSearch("");
                                }}
                            >
                                <MenuItem value="" data-test-id={`${testIdPrefix}-namespace-option`}>All namespaces</MenuItem>
                                {namespaces.map((ns) => (
                                    <MenuItem key={ns.name} value={ns.name} data-test-id={`${testIdPrefix}-namespace-option`}>{ns.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>

                    {/* The shared, searchable pod picker (the same component the node
                        Provisioning subtab uses). Its label summarises the current scope
                        (count of checked pods, or the active search text), and ticking a
                        pod disables the search box so the full list stays visible. */}
                    <PodFilter
                        pods={pods}
                        search={search}
                        onSearchChange={(value) => {
                            setSearch(value);
                            if (value.trim() !== "") {
                                setNeedsSelection(false);
                            }
                        }}
                        selectedPods={selectedPods}
                        onTogglePod={togglePod}
                        onClear={clearSelection}
                        testIdPrefix={testIdPrefix}
                    />

                    {!streaming ? (
                        <Button
                            variant="contained"
                            onClick={handleStreamClick}
                            disabled={current === null}
                            data-test-id={`${testIdPrefix}-start`}
                            startIcon={<FontAwesomeIcon icon={faPlay} />}
                        >
                            Stream
                        </Button>
                    ) : (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={stopStream}
                            data-test-id={`${testIdPrefix}-stop`}
                            startIcon={<FontAwesomeIcon icon={faStop} />}
                        >
                            Stop
                        </Button>
                    )}

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        data-test-id={`${testIdPrefix}-last-updated`}
                    >
                        {formatLastUpdated(lastLineAt, now)}
                    </Typography>

                    {/* Jump-to-top / jump-to-bottom, pushed to the far right of the
                        toolbar row (ml: auto) so they sit clear of the Stream button.
                        Bottom also re-engages auto-follow (see jumpTo), so it locks the
                        view to the end rather than scrolling there once. */}
                    <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
                        <Tooltip title="Jump to top">
                            <IconButton
                                size="small"
                                onClick={() => jumpTo("top")}
                                data-test-id={`${testIdPrefix}-jump-top`}
                                aria-label="Jump to top"
                            >
                                <FontAwesomeIcon icon={faAnglesUp} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Jump to bottom">
                            <IconButton
                                size="small"
                                onClick={() => jumpTo("bottom")}
                                data-test-id={`${testIdPrefix}-jump-bottom`}
                                aria-label="Jump to bottom"
                            >
                                <FontAwesomeIcon icon={faAnglesDown} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Paper>
            )}

            {needsSelection && (
                <Alert severity="info" data-test-id={`${testIdPrefix}-needs-selection`}>
                    <AlertTitle>Pick which pods to stream first</AlertTitle>
                    Streaming every pod at once is not supported. Check one or more pods in the
                    picker, or type a substring (for example <code>nginx</code>) into the
                    &quot;Search pods...&quot; box to stream every matching pod, then press Stream.
                </Alert>
            )}

            {streamError && <Alert severity="error" data-test-id={`${testIdPrefix}-error`}>{streamError}</Alert>}

            {streaming && fixedPod === undefined && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }} data-test-id={`${testIdPrefix}-matched`}>
                    <Typography variant="caption" color="text.secondary">
                        Streaming {matchedPods.length} pod(s):
                    </Typography>
                    {(showAllPods ? matchedPods : matchedPods.slice(0, MAX_VISIBLE_POD_CHIPS)).map((name) => (
                        <Chip
                            key={name}
                            size="small"
                            label={name}
                            data-test-id={`${testIdPrefix}-matched-pod`}
                            onDelete={() => removeStreamingPod(name)}
                            deleteIcon={
                                <Box
                                    component="span"
                                    role="button"
                                    aria-label={`Remove ${name}`}
                                    data-test-id={`${testIdPrefix}-matched-pod-remove`}
                                    sx={{ display: "inline-flex", alignItems: "center" }}
                                >
                                    <FontAwesomeIcon icon={faCircleXmark} />
                                </Box>
                            }
                            sx={{
                                bgcolor: colorForPod(name),
                                color: "#000",
                                "& .MuiChip-deleteIcon": {
                                    color: "rgba(0, 0, 0, 0.55)",
                                    "&:hover": { color: "#000" },
                                },
                            }}
                        />
                    ))}
                    {matchedPods.length > MAX_VISIBLE_POD_CHIPS && !showAllPods && (
                        <Chip
                            size="small"
                            label={`... +${matchedPods.length - MAX_VISIBLE_POD_CHIPS} more`}
                            onClick={() => setShowAllPods(true)}
                            data-test-id={`${testIdPrefix}-matched-expand`}
                            sx={{ fontWeight: 600 }}
                        />
                    )}
                    {matchedPods.length > MAX_VISIBLE_POD_CHIPS && showAllPods && (
                        <Chip
                            size="small"
                            label="Show fewer"
                            onClick={() => setShowAllPods(false)}
                            data-test-id={`${testIdPrefix}-matched-collapse`}
                            sx={{ fontWeight: 600 }}
                        />
                    )}
                </Box>
            )}

            {/* The viewer and its custom scrollbar share a relative-positioned
                wrapper so the bar can be drawn over the viewer's right edge. The
                native scrollbar is hidden (this browser renders it as an invisible
                auto-hiding overlay), and an always-visible bar is drawn instead so
                the streamed history is plainly reachable.

                minHeight is 0 (not a fixed floor) so this flex child can shrink to
                the height its parents actually leave it, keeping the Paper below the
                sole scroll container. A non-zero floor taller than the space left by
                the surrounding chrome (worst on the Logs page, which stacks the pod
                picker and the "Streaming N pod(s)" bar above the viewer) would push
                the whole surface past the page and make <main> scroll instead. Then
                auto-follow still pins the viewer to its own bottom, but that bottom
                sits below the page fold, so the newest line is offscreen and the view
                only *looks* like it stopped following. Letting the viewer shrink keeps
                it the only thing that scrolls, so the followed newest line stays in
                view exactly as it does on the Pod detail Logs tab. */}
            <Box sx={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
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
                    data-test-id={`${testIdPrefix}-viewer`}
                >
                    {lines.length === 0 ? (
                        streaming ? (
                            <LoadingIndicator />
                        ) : (
                            <Typography component="span" sx={{ color: "grey.500", fontFamily: "monospace", fontSize: "0.75rem" }}>
                                {fixedPod === undefined
                                    ? "Check pods or type a search, then press Stream."
                                    : "(no logs)"}
                            </Typography>
                        )
                    ) : (
                        lines.map((entry) => (
                            <Box key={entry.key} component="div" data-test-id={`${testIdPrefix}-line`}>
                                {/* The pod-name prefix is coloured from the pod palette, which
                                    deliberately excludes red and yellow: those two colours mean
                                    "error" and "warning" in the highlighted log text, so a pod
                                    name in either would make an ordinary line read as a problem. */}
                                <Box
                                    component="span"
                                    data-test-id={`${testIdPrefix}-line-pod`}
                                    sx={{
                                        color: colorForPod(entry.pod),
                                        fontWeight: 600,
                                    }}
                                >
                                    {entry.namespace}/{entry.pod}
                                </Box>
                                {" "}
                                <HighlightedLogLine text={entry.line} />
                            </Box>
                        ))
                    )}
                </Paper>

                {/* Always-visible custom scrollbar track. Drawn only when the
                    content overflows; the thumb is draggable to scroll. */}
                {thumb.visible && (
                    <Box
                        data-test-id={`${testIdPrefix}-scrollbar-track`}
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
                            data-test-id={`${testIdPrefix}-scrollbar-thumb`}
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
