import type { ColumnFiltersState, FilterFn } from "@tanstack/react-table";

// The periods a custom "last X <period>" time range can be expressed in.
export type TimeRangeUnit = "minute" | "hour" | "day" | "week" | "month";

// A time range chosen in the shared time-range filter. `all` imposes no lower
// bound (every item shows, whatever its age); `last` keeps only items whose
// timestamp is at or after `count` x `unit` before now.
export type TimeRange =
    | { kind: "all" }
    | { kind: "last"; count: number; unit: TimeRangeUnit };

// The X and the period the default range is built from, and the values the
// control's "Last X <period>" row falls back to when the applied range is "all
// time" and has no X or period of its own.
export const DEFAULT_TIME_RANGE_COUNT = 7;
export const DEFAULT_TIME_RANGE_UNIT: TimeRangeUnit = "day";

// The range every time-based view starts on: the last 7 days.
//
// Karse persists nothing and the backend is a stateless kubectl wrapper, so the
// data behind these views is only what the cluster still holds. Kubernetes
// garbage-collects Events at its `--event-ttl` (1 hour by default), so in
// practice the Events feed rarely holds anything older than an hour and this
// default excludes nothing there. It bites on the Errors feed, whose problem-pod
// rows are derived from live pod state and can be arbitrarily old (a pod stuck
// Pending for weeks still reports its start time).
export const DEFAULT_TIME_RANGE: TimeRange = {
    kind: "last",
    count: DEFAULT_TIME_RANGE_COUNT,
    unit: DEFAULT_TIME_RANGE_UNIT,
};

// The unbounded range: no lower bound, so nothing is excluded by age.
export const ALL_TIME_RANGE: TimeRange = { kind: "all" };

// Every selectable period, in display order (shortest first). Drives the period
// dropdown in the shared control.
export const TIME_RANGE_UNITS: TimeRangeUnit[] = ["minute", "hour", "day", "week", "month"];

// The length of one of each period, in milliseconds. A week is 7 days and a month
// is 30 days: both are fixed lengths rather than calendar-aware, so "last 1 month"
// means "the last 30 days" regardless of which month it is. Keeping them fixed
// makes the predicate plain arithmetic over timestamps.
export const TIME_RANGE_UNIT_MS: Record<TimeRangeUnit, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,
};

// The smallest X a "last X <period>" range accepts. A range of zero or fewer
// periods would exclude everything, which is never what the user means.
export const MIN_TIME_RANGE_COUNT = 1;

// The earliest instant (epoch ms) the range admits, or null when the range is
// "all time" and therefore has no lower bound. `now` is passed in rather than read
// from the clock so callers (and tests) control the reference point.
export function timeRangeCutoff(range: TimeRange, now: number): number | null {
    if (range.kind === "all")
    {
        return null;
    }
    return now - range.count * TIME_RANGE_UNIT_MS[range.unit];
}

// True when an item bearing this ISO timestamp falls inside the range. The cutoff
// is inclusive, so an item landing exactly on the boundary is kept.
//
// An item whose timestamp is missing ("") or unparseable cannot be placed in time,
// so it is kept rather than hidden: the alternative silently drops rows the user
// can still see in the unfiltered list, and losing an error or event outright is
// worse than showing one whose age is unknown (the views already render such a
// timestamp as "-").
export function withinTimeRange(timestamp: string, range: TimeRange, now: number): boolean {
    const cutoff = timeRangeCutoff(range, now);
    if (cutoff === null)
    {
        return true;
    }
    const at = new Date(timestamp).getTime();
    if (Number.isNaN(at))
    {
        return true;
    }
    return at >= cutoff;
}

// The range expressed as a whole number of seconds before now, or null when the range
// is "all time" and therefore has no lower bound.
//
// This is the form the Logs view sends to the backend, which turns it into
// `kubectl logs --since=<seconds>s` and so applies the range at fetch. Unlike the
// Events and Errors feeds, whose rows are already in hand and can be filtered by
// `withinTimeRange` client-side, a log line arrives with no timestamp on it: the range
// has to bound what kubectl replays from each pod's backlog in the first place.
//
// Seconds are the unit because kubectl parses the duration with Go's time.ParseDuration,
// which has no day or week unit, so every period is normalised down (a week is 604800s).
export function timeRangeSeconds(range: TimeRange): number | null {
    if (range.kind === "all")
    {
        return null;
    }
    return Math.round(range.count * TIME_RANGE_UNIT_MS[range.unit] / 1000);
}

// The human-readable label for a range, as shown on the control's button:
// "All time", "Last 7 days", "Last 1 hour". The period is pluralised for any
// count other than one.
export function formatTimeRange(range: TimeRange): string {
    if (range.kind === "all")
    {
        return "All time";
    }
    const unit = range.count === 1 ? range.unit : `${range.unit}s`;
    return `Last ${range.count} ${unit}`;
}

// The TanStack column filterFn for a timestamp column driven by the shared
// time-range control. The stored filter value is the chosen `TimeRange`, and a row
// passes when its timestamp for the column falls inside it. "All time" installs no
// filter at all (see `timeRangeColumnFilters`), so this never has to special-case
// it beyond the predicate's own guard. `now` is read at filter time, matching how
// the views' Age columns compute age from the current clock.
export const timeRangeFilterFn: FilterFn<any> = (row, columnId, value: TimeRange) => {
    const timestamp = row.getValue(columnId);
    return withinTimeRange(typeof timestamp === "string" ? timestamp : "", value, Date.now());
};

// Translates the chosen range into the TanStack column filter for a table's
// timestamp column (`columnId`, e.g. the events and errors tables' `lastSeen`).
// "All time" yields no filter, so every row passes and the table behaves exactly as
// it did before the control existed. The result is meant to be concatenated with
// the table's other column filters.
export function timeRangeColumnFilters(columnId: string, range: TimeRange): ColumnFiltersState {
    if (range.kind === "all")
    {
        return [];
    }
    return [
        {
            id: columnId,
            value: range,
        },
    ];
}
