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
    Checkbox,
    FormControlLabel,
    Popover,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlay, faStop, faStream, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { LogStreamLine } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNamespaces, fetchPods, openLogStream } from "../../lib/api-client";
import { filterPods } from "../../lib/filter-pods";
import { LoadingIndicator } from "../../components/loading-indicator";
import { shouldFollow, bottomScrollTop, thumbMetrics, scrollTopForThumbTop, type ThumbMetrics } from "../../lib/log-autoscroll";

// A rendered log line tagged with a stable key for React reconciliation.
type RenderedLine = LogStreamLine & { key: number };

// Palette used to color pod-name prefixes, cycling like stern does.
const PREFIX_COLORS = ["#4fc3f7", "#81c784", "#ffb74d", "#ba68c8", "#e57373", "#4db6ac", "#f06292", "#9575cd"];

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

// Deterministically maps a pod name to one of the prefix colors.
function colorForPod(pod: string): string {
    let hash = 0;
    for (let i = 0; i < pod.length; i++) {
        hash = (hash * 31 + pod.charCodeAt(i)) >>> 0;
    }
    return PREFIX_COLORS[hash % PREFIX_COLORS.length]!;
}

// Stern-style multi-pod live log streaming page. The user scopes the stream with
// a searchable pod picker: a "Search pods..." box filters a checkbox list, and the
// user checks one or more pods to stream (or, with nothing checked, the search box
// acts as a substring filter over pod names). Logs then stream live from every
// chosen pod at once, each line prefixed with its pod name.
export function LiveLogsPage() {
    const { current } = useKubeContext();
    const [namespace, setNamespace] = useState<string>("");
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
    // The picker dropdown's anchor element. Non-null while the dropdown is open,
    // so the search box and checkbox list drop down below the trigger as an
    // overlay rather than sitting inline on the page.
    const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
    const pickerOpen = pickerAnchor !== null;

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

    // The picker's checkbox list, narrowed to pods matching the search box. When
    // pods are explicitly checked the search box is disabled, so the full list shows.
    const visiblePods = useMemo(
        () => (selectedPods.length > 0 ? pods : filterPods(pods, search)),
        [pods, search, selectedPods],
    );

    // True when the stream is scoped: either a pod is checked, or the search box
    // holds a wildcard/substring to match pods against. With neither, streaming
    // every pod at once is refused (see logs-require-pods-1).
    const hasScope = useMemo(
        () => selectedPods.length > 0 || search.trim() !== "",
        [selectedPods, search],
    );

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

    // Opens a fresh stream with the current scope, replacing any existing one.
    function startStream(): void {
        if (current === null) {
            return;
        }
        // Streaming every pod at once is not feasible, so the user must scope the
        // stream first. If no pod is checked and the search box is empty, refuse to
        // stream and show guidance instead of opening an "all pods" stream.
        if (!hasScope) {
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
        // An explicit checkbox selection wins; otherwise the search box is the
        // wildcard/substring filter the backend matches pod names against.
        const filterText = selectedPods.length > 0 ? "" : search;
        closeRef.current = openLogStream(current, namespace || undefined, selectedPods, filterText, 100, {
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
                                setSelectedPods([]);
                                setSearch("");
                            }}
                        >
                            <MenuItem value="" data-test-id="live-logs-namespace-option">All namespaces</MenuItem>
                            {namespaces.map((ns) => (
                                <MenuItem key={ns.name} value={ns.name} data-test-id="live-logs-namespace-option">{ns.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>

                <Box data-test-id="live-logs-pod-picker">
                    {/* The picker trigger. Clicking it drops the search box and
                        filterable checkbox list DOWN below it as an overlay, so the
                        pod list is not always expanded inline on the page. The label
                        summarises the current scope (count of checked pods, or the
                        active search text). */}
                    <Button
                        variant="outlined"
                        onClick={(e) => setPickerAnchor(e.currentTarget)}
                        data-test-id="live-logs-picker-trigger"
                        startIcon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                        endIcon={<FontAwesomeIcon icon={faChevronDown} />}
                        sx={{ minWidth: 220, justifyContent: "space-between", textTransform: "none" }}
                    >
                        {selectedPods.length > 0
                            ? `${selectedPods.length} pod(s) selected`
                            : search.trim() !== ""
                              ? `Search: ${search}`
                              : "Search pods..."}
                    </Button>

                    <Popover
                        open={pickerOpen}
                        anchorEl={pickerAnchor}
                        onClose={() => setPickerAnchor(null)}
                        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                        transformOrigin={{ vertical: "top", horizontal: "left" }}
                        data-test-id="live-logs-pod-dropdown"
                        slotProps={{ paper: { sx: { width: 320, p: 1, display: "flex", flexDirection: "column", gap: 1 } } }}
                    >
                        <TextField
                            size="small"
                            placeholder="Search pods..."
                            value={search}
                            autoFocus
                            onChange={(e) => {
                                setSearch(e.target.value);
                                if (e.target.value.trim() !== "") {
                                    setNeedsSelection(false);
                                }
                            }}
                            disabled={selectedPods.length > 0}
                            data-test-id="live-logs-search"
                            fullWidth
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                                    ),
                                },
                            }}
                        />

                        <Box
                            data-test-id="live-logs-pod-list"
                            sx={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column" }}
                        >
                            {visiblePods.length === 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ p: 0.5 }}>
                                    No pods match.
                                </Typography>
                            ) : (
                                visiblePods.map((pod) => (
                                    <FormControlLabel
                                        key={`${pod.namespace}/${pod.name}`}
                                        data-test-id="live-logs-pod-option"
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={selectedPods.includes(pod.name)}
                                                onChange={() => togglePod(pod.name)}
                                                data-test-id="live-logs-pod-checkbox"
                                            />
                                        }
                                        label={<Typography variant="body2">{pod.name}</Typography>}
                                    />
                                ))
                            )}
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary" data-test-id="live-logs-selected-count">
                                {selectedPods.length} selected
                            </Typography>
                            <Button
                                size="small"
                                onClick={clearSelection}
                                disabled={selectedPods.length === 0}
                                data-test-id="live-logs-clear"
                            >
                                Clear
                            </Button>
                        </Box>
                    </Popover>
                </Box>

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

                <Typography
                    variant="caption"
                    color="text.secondary"
                    data-test-id="live-logs-last-updated"
                >
                    {formatLastUpdated(lastLineAt, now)}
                </Typography>
            </Paper>

            {needsSelection && (
                <Alert severity="info" data-test-id="live-logs-needs-selection">
                    <AlertTitle>Pick which pods to stream first</AlertTitle>
                    Streaming every pod at once is not supported. Check one or more pods in the
                    picker, or type a substring (for example <code>nginx</code>) into the
                    &quot;Search pods...&quot; box to stream every matching pod, then press Stream.
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
                                Check pods or type a search, then press Stream.
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
