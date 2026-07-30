import { useState, type Dispatch, type SetStateAction } from "react";

// How long typing must pause in the search box before the parent table
// re-filters. Owned by `search-box.tsx` (the draft text lives there so keystrokes
// do not re-render the row list); exported here so tests and docs can name the
// same constant the box uses.
export const SEARCH_DEBOUNCE_MS = 250;

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

// Shared committed search state for every table with a search box. Bind the
// `SearchBox` to `search` / `setSearch` and the table's `globalFilter` to
// `deferredSearch` (the same committed value; the name is kept so every table
// keeps the same wiring).
export function useSearchFilter(): SearchFilter {
    const [search, setSearch] = useState("");
    return {
        search,
        setSearch,
        deferredSearch: search,
    };
}
