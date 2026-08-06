import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";

// How long typing must pause in the search box before the parent table
// re-filters. Owned by `search-box.tsx` (the draft text lives there so keystrokes
// do not re-render the row list); exported here so tests and docs can name the
// same constant the box uses.
export const SEARCH_DEBOUNCE_MS = 250;

// The query-param key a page's main table writes its committed search text to.
// A route that renders a second searchable table passes its own key instead, so
// two boxes on one route cannot overwrite each other's param.
export const SEARCH_PARAM = "q";

// The state behind a table's search filter.
//
// `search` / `deferredSearch` are the committed filter text the table filters by.
// They update when `SearchBox` commits (after SEARCH_DEBOUNCE_MS of quiet typing,
// or immediately on clear). The characters the user is mid-typing live inside
// `SearchBox` as a local draft, so keystrokes stay snappy.
export interface SearchFilter {
    search: string;
    setSearch: Dispatch<SetStateAction<string>>;
    deferredSearch: string;
}

// Mirrors a committed search value into the given query-param key. The write is a
// history replacement, so one query leaves no trail of entries to walk back
// through, and it is built from the params already on the URL, so `context`,
// `namespace` and `from` survive it. An empty value deletes the param rather than
// leaving an empty `?q=` behind.
function writeSearchParam(
    setSearchParams: ReturnType<typeof useSearchParams>[1],
    paramKey: string,
    value: string,
): void {
    setSearchParams(
        (prev) => {
            const next = new URLSearchParams(prev);
            if (value === "")
            {
                next.delete(paramKey);
            }
            else
            {
                next.set(paramKey, value);
            }
            return next;
        },
        {
            replace: true,
        },
    );
}

// Shared committed search state for every table with a search box. Bind the
// `SearchBox` to `search` / `setSearch` and the table's `globalFilter` to
// `deferredSearch` (the same committed value; the name is kept so every table
// keeps the same wiring).
//
// The committed value is mirrored into the page's URL query string under
// `paramKey`, so a narrowed table is shareable by copying the address bar, and the
// browser back button restores the search a detail page was reached from: the
// table remounts on the way back and reads the param below.
//
// A committed value is also held locally until the URL agrees with it, and while it
// is outstanding that local value wins. A router navigation does not land in the
// same tick as the call that asked for it, so reading the search straight off the
// URL left the table a commit behind (a clear stayed applied for as long as the
// navigation took). The override keeps re-filtering immediate; the URL stays the
// resting place the value is read back from.
//
// Pass `null` for `paramKey` to keep the search out of the URL entirely. That is
// for transient search inside a dialog (the labels modal), which is not part of the
// page's shareable view.
export function useSearchFilter(paramKey: string | null = SEARCH_PARAM): SearchFilter {
    const [searchParams, setSearchParams] = useSearchParams();

    // The committed value the URL has not caught up to yet, or null when the URL is
    // already the whole truth.
    const [pending, setPending] = useState<string | null>(null);

    const urlSearch = paramKey === null ? "" : (searchParams.get(paramKey) ?? "");
    const search = pending !== null ? pending : urlSearch;

    // The value in force right now, for resolving a functional update without
    // waiting for a re-render (TanStack Table hands `onGlobalFilterChange` an
    // updater function, and two commits can land in one tick).
    const currentRef = useRef(search);
    currentRef.current = search;

    // `setSearchParams` is a fresh function whenever the router's location changes.
    // Reading it through a ref keeps `setSearch` referentially stable, which matters
    // because `SearchBox` restarts its debounce whenever the `onChange` it was handed
    // changes identity: an unstable setter would let an unrelated re-render (a query
    // refetch, say) cancel the commit the user is waiting on.
    const setSearchParamsRef = useRef(setSearchParams);
    useEffect(() => {
        setSearchParamsRef.current = setSearchParams;
    }, [setSearchParams]);

    // Once the URL holds the committed value, drop the override and go back to
    // reading the param, so a later back or forward that changes it on its own is
    // picked up. A URL landing on some earlier committed value (two commits inside
    // one navigation) leaves the override in place, so the newest value still wins.
    useEffect(() => {
        if (pending !== null && urlSearch === pending)
        {
            setPending(null);
        }
    }, [urlSearch, pending]);

    const setSearch = useCallback<Dispatch<SetStateAction<string>>>((update) => {
        const value = typeof update === "function" ? update(currentRef.current) : update;
        currentRef.current = value;
        setPending(value);
        if (paramKey !== null)
        {
            writeSearchParam(setSearchParamsRef.current, paramKey, value);
        }
    }, [paramKey]);

    return {
        search,
        setSearch,
        deferredSearch: search,
    };
}
