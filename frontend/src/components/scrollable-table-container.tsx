import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { Box, Paper, TableContainer } from "@mui/material";
import { tableHeadCellTint } from "../lib/table-row-style";
import {
    horizontalThumbMetrics,
    sameBar,
    scrollLeftForThumbLeft,
    tableMaxHeightPx,
    MIN_TABLE_BODY_PX,
    SCROLLBAR_ROW_PX,
    SCROLLBAR_THICKNESS_PX,
    TABLE_BOTTOM_GAP_PX,
    type BarMetrics,
} from "../lib/table-scroll";

const NO_BAR: BarMetrics = { visible: false, lengthPx: 0, offsetPx: 0 };

// An active drag of the horizontal scrollbar thumb, captured on pointer-down so each
// pointer-move can map the pointer's travel into a scrollLeft.
interface ThumbDrag {
    startX: number;
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
// The bar is drawn rather than native. This project's browser renders native scrollbars as
// invisible auto-hiding overlays (the same problem the Logs viewer hit), so the native bar is
// hidden and an always-visible one is drawn below the table from the same `thumbMetrics`
// maths the Logs viewer uses, via lib/table-scroll.ts.
export function ScrollableTableContainer({ testId, children }: ScrollableTableContainerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<ThumbDrag | null>(null);
    // The height bound, in pixels. Null until first measured, so the first paint is the
    // table's natural height rather than a guess that would then jump.
    const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null);
    const [bar, setBar] = useState<BarMetrics>(NO_BAR);

    // Re-reads the container's horizontal scroll state and repositions the thumb. Called on
    // every scroll, and after anything that changes the table's width.
    const refreshBar = useCallback(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        const trackPx = trackRef.current?.clientWidth ?? container.clientWidth;
        const next = horizontalThumbMetrics(container, trackPx);
        setBar((prev) => (sameBar(prev, next) ? prev : next));
    }, []);

    // Re-measures the height bound from where the container's top edge currently sits, and
    // repositions the thumb. Called on mount and whenever the window, the page scroll, or the
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
        refreshBar();
    }, [refreshBar]);

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

    // Starts a thumb drag. Pointer capture keeps the moves coming even when the pointer
    // leaves the thin bar, which is easy to do while dragging along it.
    function handleThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
        const track = trackRef.current;
        if (track === null) {
            return;
        }
        dragRef.current = {
            startX: event.clientX,
            startOffsetPx: bar.offsetPx,
            trackPx: track.clientWidth,
            thumbPx: bar.lengthPx,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    function handleThumbPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
        const drag = dragRef.current;
        const container = containerRef.current;
        if (drag === null || container === null) {
            return;
        }
        const nextThumbLeft = drag.startOffsetPx + (event.clientX - drag.startX);
        container.scrollLeft = scrollLeftForThumbLeft(nextThumbLeft, container, drag.trackPx, drag.thumbPx);
        refreshBar();
    }

    function handleThumbPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Clicking the track jumps the table so the thumb centres on the click, the usual
    // scrollbar behaviour for the part of the bar the thumb is not covering.
    function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
        const track = trackRef.current;
        const container = containerRef.current;
        if (track === null || container === null) {
            return;
        }
        const clickX = event.clientX - track.getBoundingClientRect().left;
        container.scrollLeft = scrollLeftForThumbLeft(
            clickX - bar.lengthPx / 2,
            container,
            track.clientWidth,
            bar.lengthPx,
        );
        refreshBar();
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <TableContainer
                component={Paper}
                ref={containerRef}
                data-test-id={testId}
                onScroll={refreshBar}
                sx={(theme) => ({
                    maxHeight: maxHeightPx === null ? undefined : `${maxHeightPx}px`,
                    overflow: "auto",
                    // The native bars are invisible auto-hiding overlays in this browser, so
                    // they are hidden outright and the drawn bar below is the usable one.
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

            {/* The always-visible horizontal scrollbar, drawn below the table rather than
                overlaid on it, so it covers no row and is on screen whenever the table is
                wider than the window. Absent entirely when every column fits. */}
            {bar.visible && (
                <Box
                    ref={trackRef}
                    data-test-id={`${testId}-hscroll-track`}
                    onPointerDown={handleTrackPointerDown}
                    sx={(theme) => ({
                        position: "relative",
                        height: `${SCROLLBAR_THICKNESS_PX}px`,
                        mt: "6px",
                        borderRadius: `${SCROLLBAR_THICKNESS_PX / 2}px`,
                        border: `1px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                    })}
                >
                    <Box
                        data-test-id={`${testId}-hscroll-thumb`}
                        onPointerDown={handleThumbPointerDown}
                        onPointerMove={handleThumbPointerMove}
                        onPointerUp={handleThumbPointerUp}
                        sx={(theme) => ({
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${bar.offsetPx}px`,
                            width: `${bar.lengthPx}px`,
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
            )}
        </Box>
    );
}
