// How every timestamp in the app is displayed: "age" is the relative time since
// the timestamp (e.g. "3h"), "local" is the absolute time in the viewer's own
// timezone (e.g. "14 Jul 2026, 09:23:45"). The app-wide choice lives in
// `lib/config.tsx` and is read through `lib/use-timestamp-format.ts`.
export type TimestampMode = "age" | "local";

// The shared placeholder for a timestamp the cluster did not report. Every
// timestamp surface renders this rather than an empty cell or "Invalid Date".
export const UNKNOWN_TIMESTAMP = "-";

// The parts of an absolute local time, chosen for readability at a glance: a
// short month name so the date is unambiguous in any locale, and seconds so a
// timestamp that is only seconds old is still distinguishable from one a minute
// old. 24-hour clock so every timestamp is the same width.
const LOCAL_TIME_PARTS: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
};

// Overrides for the locale and timezone `formatLocalTime` formats into. The app
// always omits them, so it formats into the browser's own locale and timezone
// (the "local" in local time). Tests pass them to pin the output.
export type LocalTimeOptions = {
    locale?: string;
    timeZone?: string;
};

// Parses a Kubernetes ISO timestamp, returning null when it is absent or
// unparseable so every formatter below can render `UNKNOWN_TIMESTAMP` rather than "NaN"
// or "Invalid Date".
function parseTimestamp(timestamp: string): Date | null {
    if (timestamp === "")
    {
        return null;
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime()))
    {
        return null;
    }
    return date;
}

// Formats a Kubernetes timestamp as the age since it happened, in the largest
// unit that is non-zero (e.g. "2d", "4h", "5m"), flooring at "0m". This is the
// long-standing Karse age format that the resource tables, detail pages, and the
// errors search all display; it is kept exactly as it was.
export function formatAge(timestamp: string): string {
    const date = parseTimestamp(timestamp);
    if (date === null)
    {
        return UNKNOWN_TIMESTAMP;
    }
    const ms = Date.now() - date.getTime();
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0)
    {
        return `${days}d`;
    }
    if (hours > 0)
    {
        return `${hours}h`;
    }
    return `${minutes}m`;
}

// Formats a Kubernetes timestamp as an absolute date and time in the viewer's
// own timezone (e.g. "14 Jul 2026, 09:23:45"). The app omits `options`, so the
// browser's locale and timezone are used.
export function formatLocalTime(timestamp: string, options: LocalTimeOptions = {}): string {
    const date = parseTimestamp(timestamp);
    if (date === null)
    {
        return UNKNOWN_TIMESTAMP;
    }
    const parts: Intl.DateTimeFormatOptions = {
        ...LOCAL_TIME_PARTS,
    };
    if (options.timeZone !== undefined)
    {
        parts.timeZone = options.timeZone;
    }
    return new Intl.DateTimeFormat(options.locale, parts).format(date);
}

// Formats a Kubernetes timestamp in whichever mode the user has chosen. This is
// the single function every timestamp surface in the app renders through, so one
// setting switches them all at once.
export function formatTimestamp(timestamp: string, mode: TimestampMode, options: LocalTimeOptions = {}): string {
    if (mode === "local")
    {
        return formatLocalTime(timestamp, options);
    }
    return formatAge(timestamp);
}

// The mode the toggle switches to from the given mode. There are only two modes,
// so the toggle simply flips between them.
export function nextTimestampMode(mode: TimestampMode): TimestampMode {
    if (mode === "age")
    {
        return "local";
    }
    return "age";
}
