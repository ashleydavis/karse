// Layout and scrollbar maths for the shared resource-table container
// (components/scrollable-table-container.tsx). Kept out of the component so the
// arithmetic can be unit-tested without a DOM render.

import { thumbMetrics, scrollTopForThumbTop, type ScrollMetrics } from "./log-autoscroll";

// Space left below a table between its bottom edge and the bottom of the window, so the
// bounded table does not sit flush against the viewport edge. Matches the page padding
// the app shell puts around <main>.
export const TABLE_BOTTOM_GAP_PX = 24;

// Vertical space the custom horizontal scrollbar row occupies below a table: the bar's
// own thickness plus the gap between it and the table.
export const SCROLLBAR_THICKNESS_PX = 12;
export const SCROLLBAR_ROW_PX = SCROLLBAR_THICKNESS_PX + 6;

// The smallest a table body is allowed to be squeezed to. A table whose top is already
// far down the window (a page with a lot of chrome above it, or a very short window)
// would otherwise be bounded to a sliver or a negative height; below this floor the page
// scrolls instead, which is the better of the two bad outcomes.
export const MIN_TABLE_BODY_PX = 200;

// The max-height that bounds a table's scroll container to the window: everything from the
// container's top edge down to the bottom of the viewport, less the space reserved below it.
// It is a *max*-height, so a table with few rows still renders at its natural height and
// leaves no empty area; only a table taller than the window is bounded, and it then scrolls
// inside itself (vertically and horizontally) instead of making the page the scroll container.
export function tableMaxHeightPx(
    containerTopPx: number,
    viewportHeightPx: number,
    bottomReservedPx: number,
    minHeightPx: number,
): number {
    return Math.max(minHeightPx, viewportHeightPx - containerTopPx - bottomReservedPx);
}

// A horizontally scrolling element's metrics, the horizontal counterpart of ScrollMetrics.
export interface HorizontalScrollMetrics {
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
}

// Geometry of the custom horizontal scrollbar thumb, as pixels along its track.
// `visible` is false when the content fits, so the caller draws no bar at all.
export interface BarMetrics {
    visible: boolean;
    lengthPx: number; // thumb width within the track
    offsetPx: number; // thumb offset from the track's left edge
}

// Maps a horizontal scroll state onto the vertical ScrollMetrics the log viewer's thumb
// maths already works in, so both scrollbars are positioned by the same helper rather than
// a second copy of the same arithmetic.
function asVertical(metrics: HorizontalScrollMetrics): ScrollMetrics {
    return {
        scrollTop: metrics.scrollLeft,
        scrollHeight: metrics.scrollWidth,
        clientHeight: metrics.clientWidth,
    };
}

// Where to draw the custom horizontal scrollbar thumb for a given scroll state and track
// width. This project's browser renders native scrollbars as invisible auto-hiding overlays
// (`::-webkit-scrollbar` is ignored), which is why a wide table's horizontal bar could not be
// found at all; the table container hides the native bar and draws this one instead.
export function horizontalThumbMetrics(metrics: HorizontalScrollMetrics, trackPx: number): BarMetrics {
    const thumb = thumbMetrics(asVertical(metrics), trackPx);
    return { visible: thumb.visible, lengthPx: thumb.heightPx, offsetPx: thumb.topPx };
}

// Inverse of `horizontalThumbMetrics`: the scrollLeft that puts the thumb at the given
// offset along its track. Used while dragging the thumb.
export function scrollLeftForThumbLeft(
    thumbLeftPx: number,
    metrics: HorizontalScrollMetrics,
    trackPx: number,
    thumbWidthPx: number,
): number {
    return scrollTopForThumbTop(
        thumbLeftPx,
        { scrollHeight: metrics.scrollWidth, clientHeight: metrics.clientWidth },
        trackPx,
        thumbWidthPx,
    );
}

// True when two bar geometries are close enough to be the same drawing, so a scroll or
// resize that moves nothing does not re-render the table.
export function sameBar(a: BarMetrics, b: BarMetrics): boolean {
    return a.visible === b.visible
        && Math.abs(a.lengthPx - b.lengthPx) < 1
        && Math.abs(a.offsetPx - b.offsetPx) < 1;
}
