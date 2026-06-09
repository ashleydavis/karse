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

// Props for the shared StatusFilter dropdown. `all` is every status value in
// display order; `selected` is the currently-visible subset; `onChange` is
// called with the next subset whenever a checkbox is toggled. `label` names the
// status dimension ("Status" everywhere) and `testIdPrefix` namespaces the
// data-test-id attributes so each table's filter is addressable.
type StatusFilterProps = {
    all: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    label: string;
    testIdPrefix: string;
};

// MUI `sx` styling for a select-all/deselect-all control. When `muted` is true the
// control is greyed out and shows the default cursor (its click handler no-ops), but it
// stays focusable so the menu still closes on Escape. Returns an empty object when active.
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

// A multi-select dropdown of status checkboxes that controls which rows are
// visible in a resource table. One checkbox per distinct status value; defaults
// to all selected. Shared across every table whose kind has a status field so
// the filtering behaviour is identical everywhere.
export function StatusFilter({ all, selected, onChange, label, testIdPrefix }: StatusFilterProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    // Toggles a single status value in or out of the selected set.
    function toggle(value: string): void {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        }
        else {
            onChange([...selected, value]);
        }
    }

    const allSelected = selected.length === all.length;
    const noneSelected = selected.length === 0;

    // Ticks every status (showing all rows). Preserves the `all` display order. No-op
    // when everything is already selected so the muted control is inert.
    function selectAll(): void {
        if (allSelected) {
            return;
        }
        onChange([...all]);
    }

    // Unticks every status (hiding all rows / showing the no-match message). No-op when
    // nothing is selected so the muted control is inert.
    function deselectAll(): void {
        if (noneSelected) {
            return;
        }
        onChange([]);
    }
    const buttonLabel = allSelected ? `${label}: All` : `${label}: ${selected.length} selected`;

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
                        aria-disabled={allSelected}
                        onClick={selectAll}
                        sx={mutedWhen(allSelected)}
                        data-test-id={`${testIdPrefix}-select-all`}
                    >
                        Select all
                    </Link>
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
