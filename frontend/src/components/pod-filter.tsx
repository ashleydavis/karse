import { useState, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import {
    Box,
    Button,
    Divider,
    TextField,
    Typography,
    Checkbox,
    FormControlLabel,
    Popover,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { filterPods, orderPods } from "../lib/filter-pods";
import { thumbMetrics, scrollTopForThumbTop, type ThumbMetrics } from "../lib/log-autoscroll";
import type { Pod } from "karse-types";

// Props for the shared Pod filter. `pods` are the pods to choose from; `search`
// is the current search-box text and `onSearchChange` updates it (the box filters
// the checkbox list, and a consumer may also use it as a substring filter on its
// own rows); `selectedPods` are the pod names ticked in the list and
// `onTogglePod` flips one in or out; `onClear` empties the selection;
// `testIdPrefix` namespaces the data-test-id attributes so each use site is
// addressable. While a pod is ticked the search box is disabled so the full list
// stays visible, matching the Logs page behaviour this component was lifted from.
type PodFilterProps = {
    pods: Pod[];
    search: string;
    onSearchChange: (value: string) => void;
    selectedPods: string[];
    onTogglePod: (name: string) => void;
    onClear: () => void;
    testIdPrefix: string;
};

// The single, shared, searchable pod picker used everywhere pods can be selected
// (currently the Logs page). Clicking the trigger drops, top to bottom: the search
// box, a header row with the "N selected" count and a Clear button, then a
// scrollable checkbox list of pods, all as an overlay. The count and Clear sit in
// the header above the list (not a footer) so they stay visible however long the
// list grows. Ticking pods narrows whatever the consumer scopes by them, and the
// search box filters the list (and, with nothing ticked, doubles as a free-text
// pod-name filter the consumer can read). The list is ordered selected-first then
// unselected, each group alphanumerical, with a divider between the two groups (drawn
// only when both are non-empty), so the current selection is easy to find at the top.
export function PodFilter({
    pods,
    search,
    onSearchChange,
    selectedPods,
    onTogglePod,
    onClear,
    testIdPrefix,
}: PodFilterProps) {
    // The dropdown's anchor element. Non-null while the dropdown is open, so the
    // search box and checkbox list drop down below the trigger as an overlay.
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const open = anchor !== null;

    // The scrollable pod-list element, plus the geometry of the custom scrollbar
    // thumb drawn over it. This browser renders the native scrollbar as an invisible
    // auto-hiding overlay, so with a long pod list nothing would signal that the list
    // scrolls; an always-visible bar (reusing the Logs viewer's tested thumb maths)
    // makes the overflow plain and the offscreen pods reachable.
    const listRef = useRef<HTMLDivElement | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const [thumb, setThumb] = useState<ThumbMetrics>({ visible: false, heightPx: 0, topPx: 0 });
    // Active thumb-drag gesture, captured on pointer-down so pointer-move maps the
    // pointer's vertical travel onto the list's scrollTop.
    const dragRef = useRef<{ startY: number; startTop: number; trackPx: number; thumbHeightPx: number } | null>(null);

    // Re-reads the list's scroll metrics and repositions the custom scrollbar thumb.
    // Called on scroll, on resize, and when the list first mounts.
    const refreshThumb = useCallback((): void => {
        const list = listRef.current;
        if (list === null) {
            return;
        }
        setThumb(thumbMetrics(
            { scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight },
            list.clientHeight,
        ));
    }, []);

    // Callback ref for the pod list: the list mounts and unmounts with the Popover,
    // so the ResizeObserver that keeps the thumb sized (the track height is the
    // list's client height, and search/selection change the content height) is
    // attached here rather than in a mount effect. Refreshes the thumb on attach.
    const setListRef = useCallback((node: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        listRef.current = node;
        if (node !== null && typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => refreshThumb());
            observer.observe(node);
            observerRef.current = observer;
        }
        refreshThumb();
    }, [refreshThumb]);

    // Starts dragging the custom scrollbar thumb; subsequent pointer-moves map the
    // pointer's vertical travel onto the list's scrollTop until pointer-up.
    function handleThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
        const list = listRef.current;
        if (list === null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        dragRef.current = {
            startY: event.clientY,
            startTop: thumb.topPx,
            trackPx: list.clientHeight,
            thumbHeightPx: thumb.heightPx,
        };
    }

    function handleThumbPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
        const drag = dragRef.current;
        const list = listRef.current;
        if (drag === null || list === null) {
            return;
        }
        const nextThumbTop = drag.startTop + (event.clientY - drag.startY);
        list.scrollTop = scrollTopForThumbTop(nextThumbTop, list, drag.trackPx, drag.thumbHeightPx);
        refreshThumb();
    }

    function handleThumbPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        dragRef.current = null;
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    }

    // The list is narrowed to pods matching the search box. When pods are
    // explicitly ticked the search box is disabled, so the full list shows.
    // The result is ordered selected-first then unselected, each group sorted
    // alphanumerically, so the current selection is easy to see at the top.
    const filteredPods = selectedPods.length > 0 ? pods : filterPods(pods, search);
    const visiblePods = orderPods(filteredPods, selectedPods);

    // How many of the visible pods are ticked: the selected group occupies the
    // first `selectedVisibleCount` rows, the unselected group the rest.
    const selectedVisibleCount = visiblePods.filter((pod) => selectedPods.includes(pod.name)).length;
    // Draw the group divider only when both groups are non-empty (no stray line
    // when nothing is ticked, or when every visible pod is ticked).
    const showDivider = selectedVisibleCount > 0 && selectedVisibleCount < visiblePods.length;

    return (
        <Box data-test-id={`${testIdPrefix}-pod-picker`}>
            <Button
                variant="outlined"
                onClick={(e) => setAnchor(e.currentTarget)}
                data-test-id={`${testIdPrefix}-picker-trigger`}
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
                open={open}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                data-test-id={`${testIdPrefix}-pod-dropdown`}
                slotProps={{ paper: { sx: { width: 440, maxWidth: "90vw", p: 1, display: "flex", flexDirection: "column", gap: 1 } } }}
            >
                <TextField
                    size="small"
                    placeholder="Search pods..."
                    value={search}
                    autoFocus
                    onChange={(e) => onSearchChange(e.target.value)}
                    disabled={selectedPods.length > 0}
                    data-test-id={`${testIdPrefix}-search`}
                    fullWidth
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary" data-test-id={`${testIdPrefix}-selected-count`}>
                        {selectedPods.length} selected
                    </Typography>
                    <Button
                        size="small"
                        onClick={onClear}
                        disabled={selectedPods.length === 0}
                        data-test-id={`${testIdPrefix}-clear`}
                    >
                        Clear
                    </Button>
                </Box>

                {/* The scrollable pod list and its custom scrollbar share a relative
                    wrapper so the bar can be drawn over the list's right edge. The
                    native scrollbar is hidden (this browser renders it as an invisible
                    auto-hiding overlay) and an always-visible bar is drawn instead, so
                    a pod list longer than the panel plainly shows that it overflows and
                    scrolls, and the offscreen pods stay reachable. */}
                <Box sx={{ position: "relative", display: "flex" }}>
                    <Box
                        ref={setListRef}
                        onScroll={refreshThumb}
                        data-test-id={`${testIdPrefix}-pod-list`}
                        sx={{
                            flex: 1,
                            maxHeight: "min(60vh, 520px)",
                            overflowY: "scroll",
                            display: "flex",
                            flexDirection: "column",
                            // Leave room on the right so pod names do not run under the
                            // custom scrollbar overlaid there.
                            pr: 2,
                            // Hide the native bar (an invisible auto-hiding overlay
                            // here) so the custom bar beside it is the visible one.
                            scrollbarWidth: "none",
                            "&::-webkit-scrollbar": { display: "none" },
                        }}
                    >
                        {visiblePods.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" sx={{ p: 0.5 }}>
                                No pods match.
                            </Typography>
                        ) : (
                            visiblePods.map((pod, index) => (
                                <Box key={`${pod.namespace}/${pod.name}`}>
                                    {showDivider && index === selectedVisibleCount && (
                                        <Divider data-test-id={`${testIdPrefix}-pod-group-divider`} sx={{ my: 0.5 }} />
                                    )}
                                    <FormControlLabel
                                        data-test-id={`${testIdPrefix}-pod-option`}
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={selectedPods.includes(pod.name)}
                                                onChange={() => onTogglePod(pod.name)}
                                                data-test-id={`${testIdPrefix}-pod-checkbox`}
                                            />
                                        }
                                        label={<Typography variant="body2">{pod.name}</Typography>}
                                    />
                                </Box>
                            ))
                        )}
                    </Box>

                    {/* Always-visible custom scrollbar, drawn only when the list
                        overflows; the thumb is draggable to scroll the list. */}
                    {thumb.visible && (
                        <Box
                            data-test-id={`${testIdPrefix}-scrollbar-track`}
                            sx={{
                                position: "absolute",
                                top: 2,
                                bottom: 2,
                                right: 2,
                                width: "10px",
                                borderRadius: "5px",
                                backgroundColor: "action.hover",
                                border: "1px solid",
                                borderColor: "divider",
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
                                    borderRadius: "5px",
                                    backgroundColor: "grey.500",
                                    cursor: "grab",
                                    "&:hover": { backgroundColor: "grey.600" },
                                    "&:active": { cursor: "grabbing" },
                                }}
                            />
                        </Box>
                    )}
                </Box>
            </Popover>
        </Box>
    );
}
