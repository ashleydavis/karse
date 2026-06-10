// Pure scroll/follow helpers for the Logs page log viewer. Kept out of the React
// component so the auto-follow decision can be unit-tested without a DOM render.

// The slack, in pixels, allowed when deciding whether a scroll container counts
// as "at the bottom". Sub-pixel rounding and a reserved scrollbar gutter mean the
// scroll position rarely lands on an exact integer, so a small tolerance avoids
// the view reading as "scrolled up" when it is visually pinned to the end.
export const AT_BOTTOM_TOLERANCE_PX = 4;

// The minimal shape of a scrollable element this module reasons about. Using a
// plain interface (rather than the full HTMLElement) keeps the logic testable
// with simple fakes.
export interface ScrollMetrics {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

// True when the container is scrolled to (or within tolerance of) its bottom.
// A container that cannot scroll (content fits) is always "at the bottom".
export function isAtBottom(metrics: ScrollMetrics): boolean {
    const distanceFromBottom = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
    return distanceFromBottom <= AT_BOTTOM_TOLERANCE_PX;
}

// Whether new lines should auto-follow (pin the view to the bottom). We only
// follow when the view was already at the bottom before the new lines arrived:
// if the user has scrolled up to read history, their position is left alone.
export function shouldFollow(metricsBeforeAppend: ScrollMetrics): boolean {
    return isAtBottom(metricsBeforeAppend);
}

// The scrollTop that pins a container to its exact bottom. Setting scrollTop to
// this value follows the newest line without overshooting (the browser clamps
// any larger value, but computing it exactly keeps a follow-up isAtBottom read
// landing at distance 0).
export function bottomScrollTop(metrics: Pick<ScrollMetrics, "scrollHeight" | "clientHeight">): number {
    return Math.max(0, metrics.scrollHeight - metrics.clientHeight);
}

// The smallest the custom scrollbar thumb is allowed to get, in pixels, so it
// stays large enough to see and grab even when the content is very long.
export const MIN_THUMB_PX = 24;

// Geometry of the custom scrollbar thumb, as fractions/pixels of the track.
// `visible` is false when the content fits (nothing to scroll), so the caller
// can hide the bar entirely in that case.
export interface ThumbMetrics {
    visible: boolean;
    heightPx: number; // thumb height within the track
    topPx: number;    // thumb offset from the track top
}

// Computes where to draw the custom scrollbar thumb for a given scroll state and
// track height. This project's browser renders native scrollbars as invisible
// auto-hiding overlays (`::-webkit-scrollbar` is ignored), so the Logs viewer
// draws its own always-visible bar; this pure helper holds the math so it is
// unit-testable without a DOM.
export function thumbMetrics(metrics: ScrollMetrics, trackPx: number): ThumbMetrics {
    const { scrollTop, scrollHeight, clientHeight } = metrics;
    const overflow = scrollHeight - clientHeight;
    if (overflow <= 0 || trackPx <= 0) {
        return { visible: false, heightPx: trackPx, topPx: 0 };
    }
    // Thumb height is proportional to how much of the content is on screen,
    // floored at MIN_THUMB_PX so it never shrinks to an ungrabbable sliver.
    const rawHeight = (clientHeight / scrollHeight) * trackPx;
    const heightPx = Math.max(MIN_THUMB_PX, Math.min(trackPx, rawHeight));
    // The thumb travels the remaining track in step with scrollTop over overflow.
    const travel = trackPx - heightPx;
    const topPx = travel <= 0 ? 0 : (scrollTop / overflow) * travel;
    return { visible: true, heightPx, topPx };
}

// Inverse of `thumbMetrics`: given the thumb's top offset within the track,
// returns the scrollTop that puts it there. Used while dragging the thumb so the
// viewer scrolls to match the pointer.
export function scrollTopForThumbTop(
    thumbTopPx: number,
    metrics: Pick<ScrollMetrics, "scrollHeight" | "clientHeight">,
    trackPx: number,
    thumbHeightPx: number,
): number {
    const overflow = metrics.scrollHeight - metrics.clientHeight;
    const travel = trackPx - thumbHeightPx;
    if (overflow <= 0 || travel <= 0) {
        return 0;
    }
    const clampedTop = Math.max(0, Math.min(travel, thumbTopPx));
    return (clampedTop / travel) * overflow;
}
