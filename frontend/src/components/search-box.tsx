import { useEffect, useRef, useState } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { SEARCH_DEBOUNCE_MS } from "../lib/use-search-filter";

// Props for the shared table search box. `placeholder` is the per-table wording
// ("Search pods...", "Search nodes...", ...); `value` is the committed filter
// text the parent holds (updated after the debounce, or immediately on clear);
// `onChange` commits that filter value to the parent; `testId` goes on the field
// root and namespaces the clear button's own id (`<testId>-clear`) so e2e tests
// can address both; `sx` is an optional style passthrough for the few tables
// that constrain the field's width.
type SearchBoxProps = {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    testId: string;
    sx?: SxProps<Theme>;
};

// The one search box every resource table renders. It owns the magnifying-glass
// adornment, the clear button, and the draft text the user is typing.
//
// The draft lives here — not in the parent table — so each keystroke re-renders
// only this field. Committing to the parent (which re-filters and re-renders the
// row list) waits until typing pauses for SEARCH_DEBOUNCE_MS, or happens at once
// when the box is cleared. Without that split, every character re-rendered the
// whole table and the characters themselves appeared late.
export function SearchBox({ placeholder, value, onChange, testId, sx }: SearchBoxProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(value);

    // Keep the draft aligned when the parent commits a new value (clear from
    // outside, a page opened on a URL that already carries a search, and the
    // debounce catching up).
    useEffect(() => {
        setDraft(value);
    }, [value]);

    // Push the draft up to the parent after a quiet period. An empty draft
    // commits immediately so clear feels instant.
    useEffect(() => {
        if (draft === value)
        {
            return;
        }
        if (draft === "")
        {
            onChange("");
            return;
        }
        const timeoutId = window.setTimeout(() => {
            onChange(draft);
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [draft, value, onChange]);

    // Empties the box and puts the caret back in it, in one action.
    function onClear() {
        setDraft("");
        onChange("");
        inputRef.current?.focus();
    }

    return (
        <TextField
            size="small"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            data-test-id={testId}
            inputRef={inputRef}
            sx={sx}
            slotProps={{
                input: {
                    startAdornment: (
                        <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                    ),
                    endAdornment: draft === "" ? null : (
                        <InputAdornment position="end">
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label="Clear search"
                                title="Clear search"
                                data-test-id={`${testId}-clear`}
                                onClick={onClear}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}
