// Orchestrates the navbar refresh button's visible feedback lifecycle, kept as a pure,
// side-effect-injected unit so it is testable without a DOM. The button must acknowledge
// every click deterministically: a brief in-progress state, then a completion state, then
// back to rest. Crucially the lifecycle is NOT gated on the page reload resolving —
// see runRefresh for why.

// Dependencies runRefresh needs, injected so the orchestration can be unit-tested with
// fakes (a never-resolving invalidate, a synchronous scheduler, a controllable clock).
export type RefreshFeedbackDeps = {
    // Empties the server-side cluster-data cache. Awaited so the refetch below re-reads
    // fresh kubectl data rather than a still-warm cache entry.
    clearCache: () => Promise<unknown>;
    // Empties the client-side page queries and refetches them, so the active page returns to
    // its loading state and reloads (see reloadQueries). Its returned promise is deliberately
    // not awaited (see runRefresh).
    reload: () => Promise<unknown>;
    // Sets the "refetch in flight" flag that drives the spinning, disabled button.
    onRefreshing: (value: boolean) => void;
    // Sets the transient "just completed" flag that drives the check / "Refreshed" state.
    onJustRefreshed: (value: boolean) => void;
    // Defers a callback by a number of milliseconds (window.setTimeout in the app; a
    // synchronous stand-in in tests).
    schedule: (fn: () => void, ms: number) => void;
    // Reads the current time in milliseconds (Date.now in the app; a fake clock in tests).
    now: () => number;
    // Minimum time the in-progress state stays visible, so the spinner is perceptible even
    // when clearing the cache returns almost instantly.
    minVisibleMs?: number;
    // How long the completion ("Refreshed") state shows before returning to rest.
    doneMs?: number;
};

// Default minimum visible in-progress duration (ms).
const DEFAULT_MIN_VISIBLE_MS = 400;

// Default completion-state duration (ms).
const DEFAULT_DONE_MS = 1500;

// Drives one refresh: show the in-progress state, clear the server cache, fire the page
// reload, then acknowledge completion and return to rest.
//
// The reload promise is fired but NOT awaited. It settles only once every query it restarts has
// settled, so awaiting it holds the acknowledgement hostage to the slowest refetch on the page —
// most visibly the cluster-performance query that the Cluster and resource pages share, which on
// a cluster with no Metrics API does not come back promptly and aborts only at the axios load
// timeout (LOAD_TIMEOUT_MS, 15s). Awaiting it pinned the button in the refreshing state for that
// whole window, so the "done" acknowledgement and the re-enable arrived some 15 seconds after the
// click, long after the user had concluded the button was dead: the "refresh looks completely
// dead" report. The refetch requests still go out; we simply do not gate the button's feedback on
// their completion. The feedback timing is therefore driven by the clock, not by the network.
//
// The reload emptying the page is what makes the refresh visible in the content itself: the page
// falls back to its spinner while the data is re-read. That is the page's own loading state and
// is independent of this button-level feedback, which must stay clock-driven.
export async function runRefresh(deps: RefreshFeedbackDeps): Promise<void>
{
    const minVisibleMs = deps.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS;
    const doneMs = deps.doneMs ?? DEFAULT_DONE_MS;
    deps.onRefreshing(true);
    deps.onJustRefreshed(false);
    const started = deps.now();
    try
    {
        try
        {
            await deps.clearCache();
        }
        catch
        {
            // Clearing the server cache failed; still fire the reload and acknowledge the
            // click rather than leaving the button stuck in the refreshing state.
        }
        void Promise.resolve(deps.reload()).catch(() => {});
    }
    finally
    {
        const remaining = Math.max(0, minVisibleMs - (deps.now() - started));
        deps.schedule(() =>
        {
            deps.onRefreshing(false);
            deps.onJustRefreshed(true);
            deps.schedule(() => deps.onJustRefreshed(false), doneMs);
        }, remaining);
    }
}
