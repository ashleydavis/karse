import { useState } from "react";
import {
    Button,
    Menu,
    MenuItem,
    Checkbox,
    ListItemText,
    ListSubheader,
    Divider,
    Stack,
    Link,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import type { LabelSelection } from "../lib/label-filter-state";

// Props for the shared LabelFilter dropdown. `available` maps every label key
// present on the loaded resources to its sorted distinct values; `selection` is
// the currently-picked key/value sets; `onToggle` flips a single key/value in or
// out of the selection; `onDeselectAll` clears every selection. `selectedCount`
// is the total number of selected values (drives the button text) and `testIdPrefix`
// namespaces the data-test-id attributes so each table's filter is addressable.
type LabelFilterProps = {
    available: Record<string, string[]>;
    selection: LabelSelection;
    onToggle: (key: string, value: string) => void;
    onDeselectAll: () => void;
    selectedCount: number;
    testIdPrefix: string;
};

// MUI `sx` styling for the deselect-all control. When `muted` is true the control
// is greyed out and shows the default cursor (its click handler no-ops), but it stays
// focusable so the menu still closes on Escape. Returns an empty object when active.
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

// A structured label-filter dropdown for a resource table. Lists every label key
// present on the loaded resources; under each key, one checkbox per distinct value.
// Ticking values narrows the table to resources whose labels match the selection
// (AND across keys, OR within a key's values). A "Deselect all" control clears every
// selection. Defaults to nothing selected, which shows all resources. Shared across
// every table whose kind carries labels so the behaviour is identical everywhere.
export function LabelFilter({ available, selection, onToggle, onDeselectAll, selectedCount, testIdPrefix }: LabelFilterProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    const keys = Object.keys(available);
    const noneSelected = selectedCount === 0;
    const buttonLabel = noneSelected ? "Labels: All" : `Labels: ${selectedCount} selected`;

    return (
        <div>
            <Button
                variant="outlined"
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                startIcon={<FontAwesomeIcon icon={faTags} />}
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
                        onClick={() => {
                            if (!noneSelected) {
                                onDeselectAll();
                            }
                        }}
                        sx={mutedWhen(noneSelected)}
                        data-test-id={`${testIdPrefix}-deselect-all`}
                    >
                        Deselect all
                    </Link>
                </Stack>
                <Divider />
                {keys.length === 0 && (
                    <MenuItem disabled data-test-id={`${testIdPrefix}-empty`}>
                        <Typography variant="body2" color="text.secondary">No labels</Typography>
                    </MenuItem>
                )}
                {keys.map((key) => [
                    <ListSubheader key={`${key}-header`} data-test-id={`${testIdPrefix}-key-${key}`}>
                        {key}
                    </ListSubheader>,
                    ...available[key].map((value) => (
                        <MenuItem
                            key={`${key}=${value}`}
                            onClick={() => onToggle(key, value)}
                            data-test-id={`${testIdPrefix}-item-${key}-${value}`}
                        >
                            <Checkbox checked={(selection[key] ?? []).includes(value)} size="small" />
                            <ListItemText primary={value} />
                        </MenuItem>
                    )),
                ])}
            </Menu>
        </div>
    );
}
