import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { Box, Paper, TableContainer } from "@mui/material";
import { tableHeadCellTint } from "../lib/table-row-style";
import { scrollTopForThumbTop } from "../lib/log-autoscroll";
import {
    horizontalThumbMetrics,
    sameBar,
    scrollLeftForThumbLeft,
    tableMaxHeightPx,
    verticalThumbMetrics,
    MIN_TABLE_BODY_PX,
    SCROLLBAR_GAP_PX,
    SCROLLBAR_ROW_PX,
    SCROLLBAR_THICKNESS_PX,
    TABLE_BOTTOM_GAP_PX,
    type BarMetrics,
} from "../lib/table-scroll";

const NO_BAR: BarMetrics = { visible: false, lengthPx: 0, offsetPx: 0 };

// Which of the two drawn scrollbars is being talked about. Both are the same bar turned
// ninety degrees, so everything below is written once and switched on this.
type Axis = "horizontal" | "vertical";

// An active drag of a scrollbar thumb, captured on pointer-down so each pointer-move can
// map the pointer's travel along that axis into a scroll position.
interface ThumbDrag {
    axis: Axis;
    startPointerPx: number;
    startOffsetPx: number;
    trackPx: number;
    thumbPx: number;
}

export interface ScrollableTableContainerProps {
    // The table's data-test-id, put on the scroll container itself so e2e tests address
    // the element that actually scrolls.
    testId: string;
    children: ReactNode;
}

// The scroll container every resource table renders its <Table> inside.
//
// It exists because a wide table used to be unusable: the container had `overflow-x: auto`
// already, but nothing bounded its height, so the whole 100-row table was laid out down the
// page and its horizontal scrollbar sat at the bottom of it, below the fold. The trailing
// columns (Labels, Message, Count, CPU/Memory) were unreachable unless the user first
// scrolled the page past every row to find a bar they had no reason to think was there.
//
// So this container bounds its own height to what is left of the window below it and scrolls
// in both directions inside that box: the page stays put, the header row sticks, and the
// horizontal bar is on screen from the moment the table renders. The bound is a *max*-height,
// so a short table is still only as tall as its rows.
//
// Both bars are drawn rather than native. This project's browser renders native scrollbars as
// invisible auto-hiding overlays (the same problem the Logs viewer hit), so the native bars
// are hidden and always-visible ones are drawn from the same `thumbMetrics` maths the Logs
// viewer uses, via lib/table-scroll.ts: the horizontal bar below the table, the vertical bar
// down its right-hand edge. A table that overflows both ways therefore shows both bars at
// once, each inside the window, so either direction can be scrolled without hunting.
export function ScrollableTableContainer({ testId, children }: ScrollableTableContainerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const horizontalTrackRef = useRef<HTMLDivElement | null>(null);
    const verticalTrackRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<ThumbDrag | null>(null);
    // The height bound, in pixels. Null until first measured, so the first paint is the
    // table's natural height rather than a guess that would then jump.
    const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null);
    const [horizontalBar, setHorizontalBar] = useState<BarMetrics>(NO_BAR);
    const [verticalBar, setVerticalBar] = useState<BarMetrics>(NO_BAR);

    // Re-reads the container's scroll state on both axes and repositions both thumbs. Called
    // on every scroll, and after anything that changes the table's size.
    const refreshBars = useCallback(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        // Each track stretches to the side of the table it runs along, so its own measurement
        // is the true length; before a track is drawn, the container's matching inner
        // dimension is the length it will have.
        const horizontalTrackPx = horizontalTrackRef.current?.clientWidth ?? container.clientWidth;
        const nextHorizontal = horizontalThumbMetrics(container, horizontalTrackPx);
        setHorizontalBar((prev) => (sameBar(prev, nextHorizontal) ? prev : nextHorizontal));

        const verticalTrackPx = verticalTrackRef.current?.clientHeight ?? container.clientHeight;
        const nextVertical = verticalThumbMetrics(container, verticalTrackPx);
        setVerticalBar((prev) => (sameBar(prev, nextVertical) ? prev : nextVertical));
    }, []);

    // Re-measures the height bound from where the container's top edge currently sits, and
    // repositions the thumbs. Called on mount and whenever the window, the page scroll, or the
    // table's own size moves that edge.
    const measure = useCallback(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        const top = container.getBoundingClientRect().top;
        // The reserved strip below the table is the page gap, plus the scrollbar row when a
        // bar is drawn there. Reading the live element (not React state) keeps this correct
        // on the same pass that first reveals the bar.
        const reserved = TABLE_BOTTOM_GAP_PX
            + (container.scrollWidth > container.clientWidth ? SCROLLBAR_ROW_PX : 0);
        const next = tableMaxHeightPx(top, window.innerHeight, reserved, MIN_TABLE_BODY_PX);
        setMaxHeightPx((prev) => (prev !== null && Math.abs(prev - next) < 1 ? prev : next));
        refreshBars();
    }, [refreshBars]);

    useLayoutEffect(() => {
        measure();
    });

    useEffect(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        // The window resizing, the page scrolling under the table (capture, so a scroll of the
        // <main> element is seen too), and the table itself growing or shrinking all move the
        // container's top edge or its content width.
        const observer = new ResizeObserver(() => measure());
        observer.observe(container);
        const table = container.firstElementChild;
        if (table !== null) {
            observer.observe(table);
        }
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [measure]);

    function trackElementFor(axis: Axis): HTMLDivElement | null {
        return axis === "horizontal" ? horizontalTrackRef.current : verticalTrackRef.current;
    }

    function trackLengthPx(track: HTMLDivElement, axis: Axis): number {
        return axis === "horizontal" ? track.clientWidth : track.clientHeight;
    }

    // Scrolls the table so the given axis' thumb sits at the given offset along its track.
    function scrollToThumbOffset(axis: Axis, thumbOffsetPx: number, trackPx: number, thumbPx: number): void {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        if (axis === "horizontal") {
            container.scrollLeft = scrollLeftForThumbLeft(thumbOffsetPx, container, trackPx, thumbPx);
        }
        else {
            // The vertical axis is the one the Logs viewer's helper is written in, so it takes
            // the container's metrics directly with no wrapper.
            container.scrollTop = scrollTopForThumbTop(thumbOffsetPx, container, trackPx, thumbPx);
        }
        refreshBars();
    }

    // Starts a thumb drag. Pointer capture keeps the moves coming even when the pointer
    // leaves the thin bar, which is easy to do while dragging along it.
    function handleThumbPointerDown(axis: Axis, event: ReactPointerEvent<HTMLDivElement>): void {
        const track = trackElementFor(axis);
        if (track === null) {
            return;
        }
        const bar = axis === "horizontal" ? horizontalBar : verticalBar;
        dragRef.current = {
            axis,
            startPointerPx: axis === "horizontal" ? event.clientX : event.clientY,
            startOffsetPx: bar.offsetPx,
            trackPx: trackLengthPx(track, axis),
            thumbPx: bar.lengthPx,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        // The thumb sits inside the track, so without this the track's own handler would also
        // see this press and jump the table to centre the thumb on it, shifting the content
        // out from under a drag that has not moved yet.
        event.stopPropagation();
    }

    function handleThumbPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
        const drag = dragRef.current;
        if (drag === null) {
            return;
        }
        const pointerPx = drag.axis === "horizontal" ? event.clientX : event.clientY;
        const nextThumbOffsetPx = drag.startOffsetPx + (pointerPx - drag.startPointerPx);
        scrollToThumbOffset(drag.axis, nextThumbOffsetPx, drag.trackPx, drag.thumbPx);
    }

    function handleThumbPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Clicking the track jumps the table so the thumb centres on the click, the usual
    // scrollbar behaviour for the part of the bar the thumb is not covering.
    function handleTrackPointerDown(axis: Axis, event: ReactPointerEvent<HTMLDivElement>): void {
        const track = trackElementFor(axis);
        if (track === null) {
            return;
        }
        const bar = axis === "horizontal" ? horizontalBar : verticalBar;
        const bounds = track.getBoundingClientRect();
        const clickPx = axis === "horizontal" ? event.clientX - bounds.left : event.clientY - bounds.top;
        scrollToThumbOffset(axis, clickPx - bar.lengthPx / 2, trackLengthPx(track, axis), bar.lengthPx);
    }

    // One drawn scrollbar: a track running along the given side of the table with a draggable
    // thumb positioned inside it. Nothing is rendered when that axis' content fits.
    function renderBar(axis: Axis) {
        const horizontal = axis === "horizontal";
        const bar = horizontal ? horizontalBar : verticalBar;
        if (!bar.visible) {
            return null;
        }
        const name = horizontal ? "hscroll" : "vscroll";
        return (
            <Box
                ref={horizontal ? horizontalTrackRef : verticalTrackRef}
                data-test-id={`${testId}-${name}-track`}
                onPointerDown={(event) => handleTrackPointerDown(axis, event)}
                sx={(theme) => ({
                    position: "relative",
                    flexShrink: 0,
                    ...(horizontal
                        ? {
                            height: `${SCROLLBAR_THICKNESS_PX}px`,
                            mt: `${SCROLLBAR_GAP_PX}px`,
                            // Keeps the horizontal bar under the table itself rather than
                            // running on under the vertical bar beside it.
                            mr: verticalBar.visible ? `${SCROLLBAR_ROW_PX}px` : 0,
                        }
                        : { width: `${SCROLLBAR_THICKNESS_PX}px`, ml: `${SCROLLBAR_GAP_PX}px` }),
                    borderRadius: `${SCROLLBAR_THICKNESS_PX / 2}px`,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                })}
            >
                <Box
                    data-test-id={`${testId}-${name}-thumb`}
                    onPointerDown={(event) => handleThumbPointerDown(axis, event)}
                    onPointerMove={handleThumbPointerMove}
                    onPointerUp={handleThumbPointerUp}
                    sx={(theme) => ({
                        position: "absolute",
                        ...(horizontal
                            ? { top: 0, bottom: 0, left: `${bar.offsetPx}px`, width: `${bar.lengthPx}px` }
                            : { left: 0, right: 0, top: `${bar.offsetPx}px`, height: `${bar.lengthPx}px` }),
                        borderRadius: `${SCROLLBAR_THICKNESS_PX / 2}px`,
                        backgroundColor: theme.palette.mode === "dark" ? "#64748b" : "#94a3b8",
                        cursor: "grab",
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#94a3b8" : "#64748b",
                        },
                        "&:active": { cursor: "grabbing" },
                    })}
                />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* The table and the vertical bar side by side, so the bar sits beside the rows
                rather than over them and is the full height of the bounded table. */}
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "stretch", minWidth: 0 }}>
                <TableContainer
                    component={Paper}
                    ref={containerRef}
                    data-test-id={testId}
                    onScroll={refreshBars}
                    sx={(theme) => ({
                        flex: 1,
                        minWidth: 0,
                        maxHeight: maxHeightPx === null ? undefined : `${maxHeightPx}px`,
                        overflow: "auto",
                        // The native bars are invisible auto-hiding overlays in this browser, so
                        // they are hidden outright and the drawn bars are the usable ones.
                        scrollbarWidth: "none",
                        "&::-webkit-scrollbar": { display: "none" },
                        // The header row stays put while the body scrolls under it. Head cells are
                        // normally painted with a translucent tint over the table's paper, which
                        // rows would show through once they scroll underneath; so the tint is
                        // composited over an opaque paper base instead, giving the same colour with
                        // no transparency. `&&&` outweighs the MuiTableHead theme override, which
                        // sets the tint through a descendant selector.
                        "&&& .MuiTableHead-root .MuiTableCell-head": {
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            backgroundColor: theme.palette.background.paper,
                            backgroundImage: `linear-gradient(${tableHeadCellTint(theme)}, ${tableHeadCellTint(theme)})`,
                        },
                    })}
                >
                    {children}
                </TableContainer>

                {renderBar("vertical")}
            </Box>

            {/* The horizontal bar, drawn below the table rather than overlaid on it, so it
                covers no row and is on screen whenever the table is wider than the window. */}
            {renderBar("horizontal")}
        </Box>
    );
}
