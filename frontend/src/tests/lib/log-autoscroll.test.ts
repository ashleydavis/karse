import { isAtBottom, shouldFollow, bottomScrollTop, thumbMetrics, scrollTopForThumbTop, MIN_THUMB_PX, AT_BOTTOM_TOLERANCE_PX } from "../../lib/log-autoscroll";

describe("isAtBottom", () => {
    test("true when scrolled exactly to the bottom", () => {
        expect(isAtBottom({ scrollTop: 700, scrollHeight: 1000, clientHeight: 300 })).toBe(true);
    });

    test("true within the rounding tolerance of the bottom", () => {
        expect(isAtBottom({ scrollTop: 700 - AT_BOTTOM_TOLERANCE_PX, scrollHeight: 1000, clientHeight: 300 })).toBe(true);
    });

    test("false when scrolled up beyond the tolerance", () => {
        expect(isAtBottom({ scrollTop: 700 - (AT_BOTTOM_TOLERANCE_PX + 1), scrollHeight: 1000, clientHeight: 300 })).toBe(false);
    });

    test("true when the content fits and cannot scroll", () => {
        expect(isAtBottom({ scrollTop: 0, scrollHeight: 200, clientHeight: 300 })).toBe(true);
    });
});

describe("shouldFollow", () => {
    test("follows when the view was at the bottom before appending", () => {
        expect(shouldFollow({ scrollTop: 700, scrollHeight: 1000, clientHeight: 300 })).toBe(true);
    });

    test("does not follow when the user has scrolled up", () => {
        expect(shouldFollow({ scrollTop: 100, scrollHeight: 1000, clientHeight: 300 })).toBe(false);
    });
});

describe("bottomScrollTop", () => {
    test("is the overflow distance for scrollable content", () => {
        expect(bottomScrollTop({ scrollHeight: 1000, clientHeight: 300 })).toBe(700);
    });

    test("never goes negative when content fits", () => {
        expect(bottomScrollTop({ scrollHeight: 200, clientHeight: 300 })).toBe(0);
    });
});

describe("thumbMetrics", () => {
    test("is hidden when the content fits (nothing to scroll)", () => {
        expect(thumbMetrics({ scrollTop: 0, scrollHeight: 200, clientHeight: 300 }, 300).visible).toBe(false);
    });

    test("is hidden when the track has no height", () => {
        expect(thumbMetrics({ scrollTop: 0, scrollHeight: 1000, clientHeight: 300 }, 0).visible).toBe(false);
    });

    test("thumb height is proportional to the visible fraction", () => {
        // 300 of 1000 visible over a 300px track => 90px thumb.
        const m = thumbMetrics({ scrollTop: 0, scrollHeight: 1000, clientHeight: 300 }, 300);
        expect(m.visible).toBe(true);
        expect(m.heightPx).toBeCloseTo(90);
        expect(m.topPx).toBe(0);
    });

    test("thumb sits at the bottom of the track when scrolled to the bottom", () => {
        // Track 300, thumb 90 => travel 210; scrolled fully (scrollTop 700 of 700).
        const m = thumbMetrics({ scrollTop: 700, scrollHeight: 1000, clientHeight: 300 }, 300);
        expect(m.topPx).toBeCloseTo(210);
    });

    test("thumb never shrinks below the minimum grabbable size", () => {
        // Tiny visible fraction would give a sub-pixel thumb without the floor.
        const m = thumbMetrics({ scrollTop: 0, scrollHeight: 100000, clientHeight: 300 }, 300);
        expect(m.heightPx).toBe(MIN_THUMB_PX);
    });
});

describe("scrollTopForThumbTop", () => {
    test("maps the thumb top back onto scrollTop (inverse of thumbMetrics)", () => {
        // Track 300, thumb 90 => travel 210; half-way down => half the overflow.
        expect(scrollTopForThumbTop(105, { scrollHeight: 1000, clientHeight: 300 }, 300, 90)).toBeCloseTo(350);
    });

    test("clamps a thumb dragged past the top to scrollTop 0", () => {
        expect(scrollTopForThumbTop(-50, { scrollHeight: 1000, clientHeight: 300 }, 300, 90)).toBe(0);
    });

    test("clamps a thumb dragged past the bottom to the maximum scrollTop", () => {
        expect(scrollTopForThumbTop(9999, { scrollHeight: 1000, clientHeight: 300 }, 300, 90)).toBeCloseTo(700);
    });

    test("returns 0 when the content fits (no overflow to map onto)", () => {
        expect(scrollTopForThumbTop(50, { scrollHeight: 200, clientHeight: 300 }, 300, 90)).toBe(0);
    });
});
