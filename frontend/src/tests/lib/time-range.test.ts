import {
    timeRangeCutoff,
    timeRangeSeconds,
    withinTimeRange,
    formatTimeRange,
    timeRangeColumnFilters,
    DEFAULT_TIME_RANGE,
    ALL_TIME_RANGE,
    TIME_RANGE_UNIT_MS,
    TIME_RANGE_UNITS,
    type TimeRange,
} from "../../lib/time-range";

// A fixed reference "now" so every boundary assertion is exact rather than
// relative to the wall clock while the test runs.
const NOW = new Date("2026-07-14T12:00:00.000Z").getTime();

// Returns the ISO timestamp `ms` milliseconds before the reference NOW.
function agoMs(ms: number): string {
    return new Date(NOW - ms).toISOString();
}

describe("timeRangeCutoff", () => {
    test("all time has no lower bound", () => {
        expect(timeRangeCutoff(ALL_TIME_RANGE, NOW)).toBeNull();
    });

    test("last 7 days cuts off 7 days before now", () => {
        expect(timeRangeCutoff({ kind: "last", count: 7, unit: "day" }, NOW)).toBe(NOW - 7 * 86_400_000);
    });

    test("last 1 minute cuts off 1 minute before now", () => {
        expect(timeRangeCutoff({ kind: "last", count: 1, unit: "minute" }, NOW)).toBe(NOW - 60_000);
    });

    test("a week is seven days and a month is thirty days", () => {
        expect(TIME_RANGE_UNIT_MS.week).toBe(7 * 86_400_000);
        expect(TIME_RANGE_UNIT_MS.month).toBe(30 * 86_400_000);
    });

    test("every selectable unit produces a cutoff before now", () => {
        for (const unit of TIME_RANGE_UNITS) {
            expect(timeRangeCutoff({ kind: "last", count: 2, unit }, NOW)).toBe(NOW - 2 * TIME_RANGE_UNIT_MS[unit]);
        }
    });
});

describe("withinTimeRange: the default last 7 days", () => {
    test("keeps an item from 6 days ago", () => {
        expect(withinTimeRange(agoMs(6 * 86_400_000), DEFAULT_TIME_RANGE, NOW)).toBe(true);
    });

    test("excludes an item from 8 days ago", () => {
        expect(withinTimeRange(agoMs(8 * 86_400_000), DEFAULT_TIME_RANGE, NOW)).toBe(false);
    });

    test("keeps an item landing exactly on the 7-day boundary (inclusive)", () => {
        expect(withinTimeRange(agoMs(7 * 86_400_000), DEFAULT_TIME_RANGE, NOW)).toBe(true);
    });

    test("excludes an item one millisecond past the 7-day boundary", () => {
        expect(withinTimeRange(agoMs(7 * 86_400_000 + 1), DEFAULT_TIME_RANGE, NOW)).toBe(false);
    });

    test("keeps an item timestamped now", () => {
        expect(withinTimeRange(agoMs(0), DEFAULT_TIME_RANGE, NOW)).toBe(true);
    });
});

describe("withinTimeRange: all time", () => {
    test("keeps a recent item", () => {
        expect(withinTimeRange(agoMs(60_000), ALL_TIME_RANGE, NOW)).toBe(true);
    });

    test("excludes nothing, however old the item", () => {
        expect(withinTimeRange(agoMs(365 * 86_400_000), ALL_TIME_RANGE, NOW)).toBe(true);
    });

    test("keeps an item with no timestamp", () => {
        expect(withinTimeRange("", ALL_TIME_RANGE, NOW)).toBe(true);
    });
});

describe("withinTimeRange: a custom last X period", () => {
    test("last 5 minutes keeps a 4-minute-old item", () => {
        const range: TimeRange = { kind: "last", count: 5, unit: "minute" };
        expect(withinTimeRange(agoMs(4 * 60_000), range, NOW)).toBe(true);
    });

    test("last 5 minutes excludes a 6-minute-old item", () => {
        const range: TimeRange = { kind: "last", count: 5, unit: "minute" };
        expect(withinTimeRange(agoMs(6 * 60_000), range, NOW)).toBe(false);
    });

    test("last 1 hour keeps an item exactly one hour old (boundary, inclusive)", () => {
        const range: TimeRange = { kind: "last", count: 1, unit: "hour" };
        expect(withinTimeRange(agoMs(3_600_000), range, NOW)).toBe(true);
    });

    test("last 1 hour excludes an item two hours old", () => {
        const range: TimeRange = { kind: "last", count: 1, unit: "hour" };
        expect(withinTimeRange(agoMs(2 * 3_600_000), range, NOW)).toBe(false);
    });

    test("last 2 weeks keeps a 13-day-old item and excludes a 15-day-old one", () => {
        const range: TimeRange = { kind: "last", count: 2, unit: "week" };
        expect(withinTimeRange(agoMs(13 * 86_400_000), range, NOW)).toBe(true);
        expect(withinTimeRange(agoMs(15 * 86_400_000), range, NOW)).toBe(false);
    });

    test("last 1 month keeps a 29-day-old item and excludes a 31-day-old one", () => {
        const range: TimeRange = { kind: "last", count: 1, unit: "month" };
        expect(withinTimeRange(agoMs(29 * 86_400_000), range, NOW)).toBe(true);
        expect(withinTimeRange(agoMs(31 * 86_400_000), range, NOW)).toBe(false);
    });
});

describe("withinTimeRange: an item that cannot be placed in time", () => {
    test("keeps an item with an empty timestamp rather than hiding it", () => {
        expect(withinTimeRange("", DEFAULT_TIME_RANGE, NOW)).toBe(true);
    });

    test("keeps an item with an unparseable timestamp rather than hiding it", () => {
        expect(withinTimeRange("not-a-timestamp", DEFAULT_TIME_RANGE, NOW)).toBe(true);
    });
});

describe("formatTimeRange", () => {
    test("labels the unbounded range as All time", () => {
        expect(formatTimeRange(ALL_TIME_RANGE)).toBe("All time");
    });

    test("labels the default range as Last 7 days", () => {
        expect(formatTimeRange(DEFAULT_TIME_RANGE)).toBe("Last 7 days");
    });

    test("uses the singular period for a count of one", () => {
        expect(formatTimeRange({ kind: "last", count: 1, unit: "hour" })).toBe("Last 1 hour");
    });

    test("pluralises the period for a count above one", () => {
        expect(formatTimeRange({ kind: "last", count: 5, unit: "month" })).toBe("Last 5 months");
    });
});

describe("timeRangeColumnFilters", () => {
    test("installs no column filter for all time, so every row passes", () => {
        expect(timeRangeColumnFilters("lastSeen", ALL_TIME_RANGE)).toEqual([]);
    });

    test("installs the range as the timestamp column's filter value", () => {
        expect(timeRangeColumnFilters("lastSeen", DEFAULT_TIME_RANGE)).toEqual([
            { id: "lastSeen", value: DEFAULT_TIME_RANGE },
        ]);
    });
});

describe("DEFAULT_TIME_RANGE", () => {
    test("is the last 7 days", () => {
        expect(DEFAULT_TIME_RANGE).toEqual({ kind: "last", count: 7, unit: "day" });
    });
});

// The Logs view cannot filter lines it already holds (they carry no timestamp), so its
// range is applied at fetch: it is sent to the backend as a cutoff in seconds, which
// becomes `kubectl logs --since=<n>s` and bounds the backlog each pod replays.
describe("timeRangeSeconds", () => {
    test("all time has no cutoff at all", () => {
        expect(timeRangeSeconds(ALL_TIME_RANGE)).toBeNull();
    });

    test("the 7-day default is 604800 seconds", () => {
        // kubectl parses --since with Go's time.ParseDuration, which has no day or week
        // unit, so a range is only expressible to it once normalised to seconds.
        expect(timeRangeSeconds(DEFAULT_TIME_RANGE)).toBe(604800);
    });

    test("converts every period to whole seconds", () => {
        expect(timeRangeSeconds({ kind: "last", count: 1, unit: "minute" })).toBe(60);
        expect(timeRangeSeconds({ kind: "last", count: 1, unit: "hour" })).toBe(3600);
        expect(timeRangeSeconds({ kind: "last", count: 1, unit: "day" })).toBe(86400);
        expect(timeRangeSeconds({ kind: "last", count: 1, unit: "week" })).toBe(604800);
        expect(timeRangeSeconds({ kind: "last", count: 1, unit: "month" })).toBe(2592000);
    });

    test("scales by the count", () => {
        expect(timeRangeSeconds({ kind: "last", count: 5, unit: "minute" })).toBe(300);
        expect(timeRangeSeconds({ kind: "last", count: 2, unit: "week" })).toBe(1209600);
    });

    test("agrees with the cutoff the client-side predicate uses", () => {
        // The two must describe the same instant, or the Logs view and the Events/Errors
        // views would disagree about what "last 2 hours" means.
        const now = Date.now();
        for (const unit of TIME_RANGE_UNITS) {
            const range: TimeRange = { kind: "last", count: 3, unit };
            const cutoff = timeRangeCutoff(range, now);
            expect(cutoff).not.toBeNull();
            expect(now - timeRangeSeconds(range)! * 1000).toBe(cutoff);
        }
    });

    test("is always a whole number of seconds", () => {
        // A fractional --since would not parse as a Go duration of seconds.
        for (const unit of TIME_RANGE_UNITS) {
            const seconds = timeRangeSeconds({ kind: "last", count: 1, unit });
            expect(Number.isInteger(seconds)).toBe(true);
        }
    });
});
