import type { QueryClient } from "@tanstack/react-query";

// Root query keys belonging to the app shell rather than to a page's content. These are
// refetched by a refresh but never reset, because resetting them breaks the page reload
// this module exists to produce:
//
//   ["contexts"] backs useKubeContext's `current`, and every page query both embeds `current`
//   in its key (["pods", current, namespace]) and is gated on it (enabled: current !== null).
//   Resetting contexts blanks `current` to null, which disables those queries instead of
//   putting them in flight — the page would render an empty table rather than a spinner, and
//   the header's own `isLoading` would re-disable the refresh button for the length of the
//   contexts refetch, re-coupling the button's feedback to the network.
//
// This is a denylist, not the allowlist that caused this ticket's original defect: the default
// for any key is to reset, so a page added tomorrow reloads without touching this file. Only a
// key with a mechanical reason to survive belongs here. ["cache-config"] is deliberately absent:
// it is the Config page's own content and nothing else derives from it, so it reloads like any
// other page.
const SHELL_QUERY_KEYS: readonly string[] = ["contexts"];

// True when a query key belongs to the app shell (see SHELL_QUERY_KEYS) rather than to the
// content of a page.
function isShellQuery(queryKey: readonly any[]): boolean
{
    return SHELL_QUERY_KEYS.includes(queryKey[0]);
}

// Reloads every query the app holds, so the visible page empties and re-reads its data.
//
// Page queries are RESET, not invalidated. Invalidating marks a query stale and refetches it
// while retaining its data, so `isLoading` stays false and the page keeps rendering the old
// rows until the new ones silently swap in — when the data is unchanged nothing happens on
// screen at all, which is indistinguishable from a dead button. Resetting returns the query to
// its pending, dataless state and refetches it, so the page's existing `isLoading` branch
// renders its LoadingIndicator and the refresh reads as a genuine reload of the content.
//
// The shell queries are invalidated instead, which refetches them without blanking the data
// the pages and the header depend on.
//
// The returned promise settles once the refetches do; callers driving user-visible feedback
// must not await it (see runRefresh in refresh-feedback.ts).
export async function reloadQueries(qc: QueryClient): Promise<void>
{
    await Promise.all([
        qc.resetQueries({ predicate: (query) => !isShellQuery(query.queryKey) }),
        qc.invalidateQueries({ predicate: (query) => isShellQuery(query.queryKey) }),
    ]);
}
