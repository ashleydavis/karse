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
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/free-solid-svg-icons";

// Props for the TypeFilter dropdown. `all` is every type value present in the
// data, in display order; `selected` is the subset the user has checked;
// `onChange` is called with the next subset whenever a checkbox is toggled.
// `label` names the dimension (e.g. "Type" for errors) and `testIdPrefix`
// namespaces the data-test-id attributes so the filter is addressable in tests.
type TypeFilterProps = {
    all: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    label: string;
    testIdPrefix: string;
};

// MUI `sx` styling for a muted (inert) control. When `muted` is true the control
// is greyed out and shows the default cursor (its click handler no-ops), but it
// stays focusable so the menu still closes on Escape. Returns an empty object
// when active.
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

// A multi-select dropdown of type checkboxes that controls which rows are
// visible in a table, using include semantics: when nothing is checked every
// row shows (the default); checking one or more types narrows the table to rows
// of those types. A "Deselect all" control clears the selection, restoring the
// show-all default.
export function TypeFilter({ all, selected, onChange, label, testIdPrefix }: TypeFilterProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    // Toggles a single type value in or out of the selected set.
    function toggle(value: string): void {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        }
        else {
            onChange([...selected, value]);
        }
    }

    const noneSelected = selected.length === 0;

    // Clears the selection, restoring the show-all default. No-op when nothing is
    // selected so the muted control is inert.
    function deselectAll(): void {
        if (noneSelected) {
            return;
        }
        onChange([]);
    }

    // Nothing checked is the default "show all" state; once types are checked the
    // button reports how many are selected.
    const buttonLabel = noneSelected ? `${label}: All` : `${label}: ${selected.length} selected`;

    return (
        <div>
            <Button
                variant="outlined"
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                startIcon={<FontAwesomeIcon icon={faFilter} />}
                data-test-id={`${testIdPrefix}-button`}
            >
                {buttonLabel}
            </Button>
            <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} data-test-id={`${testIdPrefix}-menu`}>
                <Stack direction="row" spacing={2} sx={{ px: 2, py: 1 }}>
                    <Link
                        component="button"
                        type="button"
                        variant="body2"
                        underline="hover"
                        aria-disabled={noneSelected}
                        onClick={deselectAll}
                        sx={mutedWhen(noneSelected)}
                        data-test-id={`${testIdPrefix}-deselect-all`}
                    >
                        Deselect all
                    </Link>
                </Stack>
                <Divider />
                {all.length === 0 && (
                    <MenuItem disabled data-test-id={`${testIdPrefix}-empty`}>
                        <Typography variant="body2" color="text.secondary">No types</Typography>
                    </MenuItem>
                )}
                {all.map((value) => (
                    <MenuItem
                        key={value}
                        onClick={() => toggle(value)}
                        data-test-id={`${testIdPrefix}-item-${value}`}
                    >
                        <Checkbox checked={selected.includes(value)} size="small" />
                        <ListItemText primary={value} />
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}
