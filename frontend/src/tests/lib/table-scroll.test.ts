import {
    tableMaxHeightPx,
    horizontalThumbMetrics,
    verticalThumbMetrics,
    scrollLeftForThumbLeft,
    sameBar,
    MIN_TABLE_BODY_PX,
    TABLE_BOTTOM_GAP_PX,
    SCROLLBAR_ROW_PX,
} from "../../lib/table-scroll";

describe("tableMaxHeightPx", () => {
    test("bounds the table to the window space below its top edge", () => {
        expect(tableMaxHeightPx(240, 900, 24, 200)).toBe(636);
    });

    test("subtracts the reserved strip so the scrollbar row fits below the table", () => {
        const withoutBar = tableMaxHeightPx(240, 900, TABLE_BOTTOM_GAP_PX, MIN_TABLE_BODY_PX);
        const withBar = tableMaxHeightPx(240, 900, TABLE_BOTTOM_GAP_PX + SCROLLBAR_ROW_PX, MIN_TABLE_BODY_PX);
        expect(withoutBar - withBar).toBe(SCROLLBAR_ROW_PX);
    });

    test("never squeezes the body below the floor when the top edge is far down a short window", () => {
        expect(tableMaxHeightPx(700, 760, 24, 200)).toBe(200);
    });

    test("returns the floor rather than a negative height when the top edge is off screen", () => {
        expect(tableMaxHeightPx(1200, 760, 24, 200)).toBe(200);
    });
});

describe("horizontalThumbMetrics", () => {
    test("hides the bar when every column fits", () => {
        expect(horizontalThumbMetrics({ scrollLeft: 0, scrollWidth: 800, clientWidth: 800 }, 800)).toEqual({
            visible: false,
            lengthPx: 800,
            offsetPx: 0,
        });
    });

    test("sizes the thumb by the fraction of the table on screen", () => {
        const bar = horizontalThumbMetrics({ scrollLeft: 0, scrollWidth: 2000, clientWidth: 1000 }, 1000);
        expect(bar.visible).toBe(true);
        expect(bar.lengthPx).toBe(500);
        expect(bar.offsetPx).toBe(0);
    });

    test("moves the thumb along the track as the table scrolls right", () => {
        const bar = horizontalThumbMetrics({ scrollLeft: 500, scrollWidth: 2000, clientWidth: 1000 }, 1000);
        expect(bar.offsetPx).toBe(250);
    });

    test("puts the thumb at the end of the track at full scroll", () => {
        const bar = horizontalThumbMetrics({ scrollLeft: 1000, scrollWidth: 2000, clientWidth: 1000 }, 1000);
        expect(bar.offsetPx + bar.lengthPx).toBe(1000);
    });
});

describe("verticalThumbMetrics", () => {
    test("hides the bar when every row fits", () => {
        expect(verticalThumbMetrics({ scrollTop: 0, scrollHeight: 600, clientHeight: 600 }, 600)).toEqual({
            visible: false,
            lengthPx: 600,
            offsetPx: 0,
        });
    });

    test("sizes the thumb by the fraction of the rows on screen", () => {
        const bar = verticalThumbMetrics({ scrollTop: 0, scrollHeight: 2400, clientHeight: 600 }, 600);
        expect(bar.visible).toBe(true);
        expect(bar.lengthPx).toBe(150);
        expect(bar.offsetPx).toBe(0);
    });

    test("moves the thumb down the track as the rows scroll", () => {
        const bar = verticalThumbMetrics({ scrollTop: 900, scrollHeight: 2400, clientHeight: 600 }, 600);
        expect(bar.offsetPx).toBe(225);
    });

    test("puts the thumb at the end of the track at full scroll", () => {
        const bar = verticalThumbMetrics({ scrollTop: 1800, scrollHeight: 2400, clientHeight: 600 }, 600);
        expect(bar.offsetPx + bar.lengthPx).toBe(600);
    });

    test("is visible at the same time as the horizontal bar when the table overflows both ways", () => {
        const container = {
            scrollTop: 0,
            scrollHeight: 3000,
            clientHeight: 600,
            scrollLeft: 0,
            scrollWidth: 2000,
            clientWidth: 1000,
        };
        expect(verticalThumbMetrics(container, 600).visible).toBe(true);
        expect(horizontalThumbMetrics(container, 1000).visible).toBe(true);
    });
});

describe("scrollLeftForThumbLeft", () => {
    test("maps a thumb offset back to the scroll position that puts it there", () => {
        const metrics = { scrollLeft: 0, scrollWidth: 2000, clientWidth: 1000 };
        expect(scrollLeftForThumbLeft(250, metrics, 1000, 500)).toBe(500);
    });

    test("clamps a drag past the end of the track to the last column", () => {
        const metrics = { scrollLeft: 0, scrollWidth: 2000, clientWidth: 1000 };
        expect(scrollLeftForThumbLeft(9000, metrics, 1000, 500)).toBe(1000);
    });

    test("clamps a drag before the start of the track to the first column", () => {
        const metrics = { scrollLeft: 400, scrollWidth: 2000, clientWidth: 1000 };
        expect(scrollLeftForThumbLeft(-80, metrics, 1000, 500)).toBe(0);
    });

    test("returns zero when there is nothing to scroll", () => {
        expect(scrollLeftForThumbLeft(120, { scrollLeft: 0, scrollWidth: 900, clientWidth: 900 }, 900, 900)).toBe(0);
    });
});

describe("sameBar", () => {
    test("treats a sub-pixel move as the same drawing", () => {
        expect(sameBar(
            { visible: true, lengthPx: 500, offsetPx: 250 },
            { visible: true, lengthPx: 500.4, offsetPx: 250.2 },
        )).toBe(true);
    });

    test("treats a visible bar and a hidden one as different", () => {
        expect(sameBar(
            { visible: true, lengthPx: 500, offsetPx: 0 },
            { visible: false, lengthPx: 500, offsetPx: 0 },
        )).toBe(false);
    });

    test("treats a real move as different", () => {
        expect(sameBar(
            { visible: true, lengthPx: 500, offsetPx: 250 },
            { visible: true, lengthPx: 500, offsetPx: 260 },
        )).toBe(false);
    });
});
