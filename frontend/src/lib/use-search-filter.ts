import { useDeferredValue, useState, type Dispatch, type SetStateAction } from "react";

// The state behind a table's search box.
//
// `search` is the text in the field. It updates on every keystroke, so the field is never
// laggy or lossy: what the user types appears immediately.
//
// `deferredSearch` is the value the table filters by. React renders the filtered row list at
// a lower priority and abandons that render as soon as another character arrives, so filtering
// and re-rendering the whole table no longer happen synchronously once per character. It
// settles on the same value as `search` the moment typing pauses, so the rows a query selects
// are exactly the rows it selected before.
export interface SearchFilter {
    search: string;
    setSearch: Dispatch<SetStateAction<string>>;
    deferredSearch: string;
}

// Shared search state for every table with a search box, so all of them behave identically:
// bind the field to `search` and the table's `globalFilter` to `deferredSearch`.
export function useSearchFilter(): SearchFilter {
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    return {
        search,
        setSearch,
        deferredSearch,
    };
}
