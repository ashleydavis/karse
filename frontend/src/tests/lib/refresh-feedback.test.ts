import { runRefresh, type RefreshFeedbackDeps } from "../../lib/refresh-feedback";

// Records the feedback-flag calls runRefresh makes, so a test can assert the exact
// sequence the button goes through.
type Recorder = {
    refreshing: boolean[];
    justRefreshed: boolean[];
    invalidateCalls: number;
    clearCacheCalls: number;
};

// Builds a deps object with fakes: a controllable clock, a scheduler that runs callbacks
// immediately (time is simulated by the clock, not by real timers), and recorders. The
// caller can override any field (e.g. a never-resolving invalidate).
function makeDeps(over: Partial<RefreshFeedbackDeps>, rec: Recorder): RefreshFeedbackDeps
{
    let clock = 0;
    return {
        clearCache: async () =>
        {
            rec.clearCacheCalls += 1;
        },
        invalidate: async () =>
        {
            rec.invalidateCalls += 1;
        },
        onRefreshing: (v) =>
        {
            rec.refreshing.push(v);
        },
        onJustRefreshed: (v) =>
        {
            rec.justRefreshed.push(v);
        },
        schedule: (fn, ms) =>
        {
            clock += ms;
            fn();
        },
        now: () => clock,
        minVisibleMs: 400,
        doneMs: 1500,
        ...over,
    };
}

function newRecorder(): Recorder
{
    return {
        refreshing: [],
        justRefreshed: [],
        invalidateCalls: 0,
        clearCacheCalls: 0,
    };
}

describe("runRefresh", () =>
{
    test("takes the button through refreshing then a completed state and back to rest", async () =>
    {
        const rec = newRecorder();
        await runRefresh(makeDeps({}, rec));
        // Enters the in-progress state, then leaves it.
        expect(rec.refreshing).toEqual([true, false]);
        // Clears any prior completion flag, then shows "done", then returns to rest.
        expect(rec.justRefreshed).toEqual([false, true, false]);
    });

    test("clears the server cache, then fires the query invalidation", async () =>
    {
        const rec = newRecorder();
        const order: string[] = [];
        await runRefresh(makeDeps({
            clearCache: async () =>
            {
                order.push("clear");
            },
            invalidate: async () =>
            {
                order.push("invalidate");
                return undefined;
            },
        }, rec));
        expect(order).toEqual(["clear", "invalidate"]);
    });

    // The regression this ticket exists for: the feedback lifecycle must NOT be gated on the
    // query invalidation resolving. invalidateQueries() awaits background refetches that can
    // stay pending forever (the shared cluster-performance query), which previously pinned the
    // button in the refreshing state and never acknowledged the click. If someone reintroduces
    // `await invalidate()`, this test hangs and the suite times out.
    test("still acknowledges completion when invalidation never resolves", async () =>
    {
        const rec = newRecorder();
        const neverResolves = new Promise<void>(() => {});
        await runRefresh(makeDeps({
            invalidate: () =>
            {
                rec.invalidateCalls += 1;
                return neverResolves;
            },
        }, rec));
        // The refetch was still fired...
        expect(rec.invalidateCalls).toBe(1);
        // ...and the button reached the completion state and returned to rest regardless.
        expect(rec.refreshing).toContain(false);
        expect(rec.justRefreshed).toContain(true);
        expect(rec.justRefreshed[rec.justRefreshed.length - 1]).toBe(false);
    });

    test("still fires the refetch and acknowledges even if clearing the cache fails", async () =>
    {
        const rec = newRecorder();
        await runRefresh(makeDeps({
            clearCache: async () =>
            {
                throw new Error("cache clear failed");
            },
        }, rec));
        expect(rec.invalidateCalls).toBe(1);
        expect(rec.justRefreshed).toContain(true);
    });

    test("holds the in-progress state for the minimum visible window", async () =>
    {
        const rec = newRecorder();
        const delays: number[] = [];
        await runRefresh(makeDeps({
            // Cache clear returns instantly (elapsed 0), so the scheduler must be asked to wait
            // the full minimum visible window before flipping to the completed state.
            schedule: (fn, ms) =>
            {
                delays.push(ms);
                fn();
            },
        }, rec));
        expect(delays[0]).toBe(400);
        // The second schedule is the completion-state duration.
        expect(delays[1]).toBe(1500);
    });
});
