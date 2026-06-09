import { useState } from "react";
import {
    Button,
    Menu,
    MenuItem,
    Checkbox,
    ListItemText,
    Divider,
    Stack,
    Link,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/free-solid-svg-icons";

// Props for the events type-filter dropdown. `all` is every event type in
// display order; `selected` is the currently-checked subset (empty means "show
// all"); `onChange` is called with the next subset whenever a checkbox toggles.
type EventTypeFilterProps = {
    all: string[];
    selected: string[];
    onChange: (next: string[]) => void;
};

// MUI `sx` styling for a muted (greyed-out, inert) deselect-all control. Returns
// an empty object when the control is active. The control stays focusable so the
// menu still closes on Escape.
function mutedWhen(muted: boolean): Record<string, any> {
    if (!muted) {
        return {};
    }
    return {
        opacity: 0.4,
        cursor: "default",
        textDecoration: "none",
    };
}

// A multi-select dropdown of event-type checkboxes for the events page. Unlike the
// shared status filter, the events page shows every event by default: an empty
// selection means "no type restriction" (all events visible), and checking types
// narrows the table to just those types. "Deselect all" clears back to showing all.
export function EventTypeFilter({ all, selected, onChange }: EventTypeFilterProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    // Toggles a single event type in or out of the selected set.
    function toggle(value: string): void {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        }
        else {
            onChange([...selected, value]);
        }
    }

    const noneSelected = selected.length === 0;

    // Clears the selection, which restores the default of showing every event. No-op
    // when nothing is selected so the muted control is inert.
    function deselectAll(): void {
        if (noneSelected) {
            return;
        }
        onChange([]);
    }

    // With nothing checked the events page shows everything, so the button reads "All".
    const buttonLabel = noneSelected ? "Type: All" : `Type: ${selected.length} selected`;

    return (
        <div>
            <Button
                variant="outlined"
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                startIcon={<FontAwesomeIcon icon={faFilter} />}
                data-test-id="events-type-filter-button"
            >
                {buttonLabel}
            </Button>
            <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} data-test-id="events-type-filter-menu">
                <Stack direction="row" spacing={2} sx={{ px: 2, py: 1 }}>
                    <Link
                        component="button"
                        type="button"
                        variant="body2"
                        underline="hover"
                        aria-disabled={noneSelected}
                        onClick={deselectAll}
                        sx={mutedWhen(noneSelected)}
                        data-test-id="events-type-filter-deselect-all"
                    >
                        Deselect all
                    </Link>
                </Stack>
                <Divider />
                {all.map((value) => (
                    <MenuItem
                        key={value}
                        onClick={() => toggle(value)}
                        data-test-id={`events-type-filter-item-${value}`}
                    >
                        <Checkbox checked={selected.includes(value)} size="small" />
                        <ListItemText primary={value} />
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}
