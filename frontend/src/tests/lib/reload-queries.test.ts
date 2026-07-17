import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { reloadQueries } from "../../lib/reload-queries";

// One observed state transition of a query, recording the fields a page branches on:
// `isLoading` drives the LoadingIndicator, `hasData` says whether the old rows are still
// on screen.
type Observed = {
    isLoading: boolean;
    hasData: boolean;
};

// Builds a query client matching the app's defaults (frontend/src/lib/query-client.ts), so
// the reload is exercised against the same staleTime/retry behaviour the app runs with.
function newQueryClient(): QueryClient
{
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                staleTime: 5_000,
            },
        },
    });
}

// Subscribes an active observer to a query and records every state it passes through, the way
// a mounted page component does. Returns the recorder, a fetch counter, and an unsubscribe.
function observe(qc: QueryClient, queryKey: any[]): {
    states: Observed[];
    fetches: () => number;
    stop: () => void;
}
{
    let fetches = 0;
    const states: Observed[] = [];
    const observer = new QueryObserver(qc, {
        queryKey,
        queryFn: async () =>
        {
            fetches += 1;
            return {
                value: fetches,
            };
        },
    });
    const unsubscribe = observer.subscribe((result) =>
    {
        states.push({
            isLoading: result.isLoading,
            hasData: result.data !== undefined,
        });
    });
    return {
        states,
        fetches: () => fetches,
        stop: unsubscribe,
    };
}

// Lets the query client's in-flight work settle.
async function settle(): Promise<void>
{
    await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("reloadQueries", () =>
{
    // The requirement this module exists for: a refresh must read as a genuine reload of the
    // page's content. Merely invalidating a query refetches it while retaining its data, so
    // `isLoading` never goes true, the page keeps rendering the stale rows, and identical data
    // changes nothing on screen at all — a refresh indistinguishable from a dead button. This
    // test fails against that behaviour: it asserts the query is actually emptied and enters
    // its loading state, which only resetting produces.
    test("empties a page query and puts it into its loading state, then refills it", async () =>
    {
        const qc = newQueryClient();
        const pods = observe(qc, ["pods", "ctx", "default"]);
        await settle();
        // The page is loaded and rendering rows before the refresh.
        expect(pods.states[pods.states.length - 1]).toEqual({
            isLoading: false,
            hasData: true,
        });
        pods.states.length = 0;

        await reloadQueries(qc);
        await settle();

        // The page emptied: it lost its data and rendered its LoadingIndicator (isLoading).
        expect(pods.states).toContainEqual({
            isLoading: false,
            hasData: false,
        });
        expect(pods.states).toContainEqual({
            isLoading: true,
            hasData: false,
        });
        // ...and then refilled with freshly fetched data.
        expect(pods.states[pods.states.length - 1]).toEqual({
            isLoading: false,
            hasData: true,
        });
        pods.stop();
    });

    // The reload must still issue the request; emptying the page is worthless if no refetch
    // follows it. This is the original defect's acceptance criterion, held at the unit level.
    test("refetches the page query", async () =>
    {
        const qc = newQueryClient();
        const pods = observe(qc, ["pods", "ctx", "default"]);
        await settle();
        expect(pods.fetches()).toBe(1);

        await reloadQueries(qc);
        await settle();

        expect(pods.fetches()).toBe(2);
        pods.stop();
    });

    // The reload selects page queries by excluding the shell keys, never by naming them. A key
    // this module has never heard of is a page's, so it reloads — that is what stops a page
    // added tomorrow from silently missing refresh, which is the defect this ticket fixed.
    test("reloads an unknown query key it was never told about", async () =>
    {
        const qc = newQueryClient();
        const invented = observe(qc, ["a-page-invented-tomorrow", "ctx"]);
        await settle();
        invented.states.length = 0;

        await reloadQueries(qc);
        await settle();

        expect(invented.states).toContainEqual({
            isLoading: true,
            hasData: false,
        });
        expect(invented.fetches()).toBe(2);
        invented.stop();
    });

    // The contexts query is the app shell, not page content: every page query embeds its
    // `current` value in its key and is gated on it, so blanking it would disable the page
    // queries rather than put them in flight. It must refetch without ever losing its data.
    test("refetches the contexts query without emptying it", async () =>
    {
        const qc = newQueryClient();
        const contexts = observe(qc, ["contexts"]);
        await settle();
        contexts.states.length = 0;

        await reloadQueries(qc);
        await settle();

        // It refetched...
        expect(contexts.fetches()).toBe(2);
        // ...but never blanked: the header keeps its context list throughout.
        expect(contexts.states.every((state) => state.hasData)).toBe(true);
        // ...and so never re-entered the loading state that disables the refresh button.
        expect(contexts.states.every((state) => !state.isLoading)).toBe(true);
        contexts.stop();
    });
});
