import { formatAge, formatLocalTime, formatTimestamp, nextTimestampMode, UNKNOWN_TIMESTAMP } from "../../lib/timestamps";

// A fixed instant to format, and the locale/timezone the local-time assertions pin
// to, so the expected strings do not depend on the machine running the tests.
const INSTANT = "2026-07-14T09:23:45Z";
const PINNED = {
    locale: "en-GB",
    timeZone: "UTC",
};

// Builds an ISO timestamp the given number of milliseconds in the past, so the age
// assertions describe an instant relative to now rather than a fixed date.
function agoIso(ms: number): string {
    return new Date(Date.now() - ms).toISOString();
}

describe("formatAge", () => {
    test("renders an age in days once a day has passed", () => {
        expect(formatAge(agoIso(2 * 86_400_000 + 3 * 3_600_000))).toBe("2d");
    });

    test("renders an age in hours below a day", () => {
        expect(formatAge(agoIso(4 * 3_600_000))).toBe("4h");
    });

    test("renders an age in minutes below an hour", () => {
        expect(formatAge(agoIso(37 * 60_000))).toBe("37m");
    });

    test("floors a seconds-old timestamp at 0m", () => {
        expect(formatAge(agoIso(5_000))).toBe("0m");
    });

    test("renders an absent timestamp as the unknown placeholder", () => {
        expect(formatAge("")).toBe(UNKNOWN_TIMESTAMP);
    });

    test("renders an unparseable timestamp as the unknown placeholder", () => {
        expect(formatAge("not-a-date")).toBe(UNKNOWN_TIMESTAMP);
    });
});

describe("formatLocalTime", () => {
    test("renders a readable date and time", () => {
        expect(formatLocalTime(INSTANT, PINNED)).toBe("14 Jul 2026, 09:23:45");
    });

    test("renders the instant in the viewer's timezone, not UTC", () => {
        expect(formatLocalTime(INSTANT, { locale: "en-GB", timeZone: "America/New_York" })).toBe("14 Jul 2026, 05:23:45");
    });

    test("keeps the seconds of a very recent timestamp, so it is not indistinguishable from a minute ago", () => {
        expect(formatLocalTime("2026-01-02T03:04:05Z", PINNED)).toBe("02 Jan 2026, 03:04:05");
    });

    test("renders an absent timestamp as the unknown placeholder", () => {
        expect(formatLocalTime("", PINNED)).toBe(UNKNOWN_TIMESTAMP);
    });

    test("renders an unparseable timestamp as the unknown placeholder", () => {
        expect(formatLocalTime("not-a-date", PINNED)).toBe(UNKNOWN_TIMESTAMP);
    });
});

describe("formatTimestamp", () => {
    test("renders the same instant as an age in age mode", () => {
        expect(formatTimestamp(agoIso(4 * 3_600_000), "age", PINNED)).toBe("4h");
    });

    test("renders the same instant as a local time in local mode", () => {
        expect(formatTimestamp(INSTANT, "local", PINNED)).toBe("14 Jul 2026, 09:23:45");
    });
});

describe("nextTimestampMode", () => {
    test("switches age to local", () => {
        expect(nextTimestampMode("age")).toBe("local");
    });

    test("switches local back to age", () => {
        expect(nextTimestampMode("local")).toBe("age");
    });
});
