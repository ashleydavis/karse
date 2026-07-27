import { useRef } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";

// Props for the shared table search box. `placeholder` is the per-table wording
// ("Search pods...", "Search nodes...", ...); `value` is the text currently in the
// field and `onChange` sets it (the state itself lives in `use-search-filter.ts`, so
// the deferred filtering behaviour is untouched); `testId` goes on the field root and
// namespaces the clear button's own id (`<testId>-clear`) so e2e tests can address
// both; `sx` is an optional style passthrough for the few tables that constrain the
// field's width.
type SearchBoxProps = {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    testId: string;
    sx?: SxProps<Theme>;
};

// The one search box every resource table renders. It owns the magnifying-glass
// adornment and the clear button, so the tables cannot drift apart: the clear button
// is shown only while there is text to clear, empties the box in one click, and
// returns focus to the input so the user can type a new query straight away. Clearing
// only touches the search text, so any active column-filter selection survives it.
export function SearchBox({ placeholder, value, onChange, testId, sx }: SearchBoxProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Empties the box and puts the caret back in it, in one action.
    function onClear() {
        onChange("");
        inputRef.current?.focus();
    }

    return (
        <TextField
            size="small"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-test-id={testId}
            inputRef={inputRef}
            sx={sx}
            slotProps={{
                input: {
                    startAdornment: (
                        <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                    ),
                    endAdornment: value === "" ? null : (
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
