import { useState } from "react";
import {
    Button,
    Menu,
    MenuItem,
    Checkbox,
    ListItemText,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/free-solid-svg-icons";

// Props for the shared StatusFilter dropdown. `all` is every status value in
// display order; `selected` is the currently-visible subset; `onChange` is
// called with the next subset whenever a checkbox is toggled. `label` names the
// status dimension (e.g. "Phase" for pods, "Status" for nodes) and `testIdPrefix`
// namespaces the data-test-id attributes so each table's filter is addressable.
type StatusFilterProps = {
    all: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    label: string;
    testIdPrefix: string;
};

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
