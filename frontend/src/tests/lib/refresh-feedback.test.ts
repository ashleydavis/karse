import { runRefresh, type RefreshFeedbackDeps } from "../../lib/refresh-feedback";

// Records the feedback-flag calls runRefresh makes, so a test can assert the exact
// sequence the button goes through.
type Recorder = {
    refreshing: boolean[];
    justRefreshed: boolean[];
    reloadCalls: number;
    clearCacheCalls: number;
};

// Builds a deps object with fakes: a controllable clock, a scheduler that runs callbacks
// immediately (time is simulated by the clock, not by real timers), and recorders. The
// caller can override any field (e.g. a never-resolving reload).
function makeDeps(over: Partial<RefreshFeedbackDeps>, rec: Recorder): RefreshFeedbackDeps
{
    let clock = 0;
    return {
        clearCache: async () =>
        {
            rec.clearCacheCalls += 1;
        },
        reload: async () =>
        {
            rec.reloadCalls += 1;
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
        reloadCalls: 0,
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

    test("clears the server cache, then fires the page reload", async () =>
    {
        const rec = newRecorder();
        const order: string[] = [];
        await runRefresh(makeDeps({
            clearCache: async () =>
            {
                order.push("clear");
            },
            reload: async () =>
            {
                order.push("reload");
                return undefined;
            },
        }, rec));
        expect(order).toEqual(["clear", "reload"]);
    });

    // The regression this ticket exists for: the feedback lifecycle must NOT be gated on the
    // page reload resolving. The reload awaits every background refetch it restarts, and on a
    // cluster with no Metrics API the shared cluster-performance query only aborts at the 15s
    // load timeout, which pinned the button in the refreshing state for that whole window and
    // read as a dead button. If someone reintroduces `await reload()`, this test hangs and the
    // suite times out.
    test("still acknowledges completion when the reload never resolves", async () =>
    {
        const rec = newRecorder();
        const neverResolves = new Promise<void>(() => {});
        await runRefresh(makeDeps({
            reload: () =>
            {
                rec.reloadCalls += 1;
                return neverResolves;
            },
        }, rec));
        // The reload was still fired...
        expect(rec.reloadCalls).toBe(1);
        // ...and the button reached the completion state and returned to rest regardless.
        expect(rec.refreshing).toContain(false);
        expect(rec.justRefreshed).toContain(true);
        expect(rec.justRefreshed[rec.justRefreshed.length - 1]).toBe(false);
    });

    test("still fires the reload and acknowledges even if clearing the cache fails", async () =>
    {
        const rec = newRecorder();
        await runRefresh(makeDeps({
            clearCache: async () =>
            {
                throw new Error("cache clear failed");
            },
        }, rec));
        expect(rec.reloadCalls).toBe(1);
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
