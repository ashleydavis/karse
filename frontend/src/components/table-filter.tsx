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
    TextField,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { searchColumns, type FilterableColumn, type FilterSelection } from "../lib/table-filter-state";

// Props for the shared table filter editor. `columns` are the table's filterable
// columns (each a heading plus its distinct values); `selection` is the currently
// ticked values per column; `onToggle` flips one column/value in or out;
// `onDeselectAll` clears every selection; `totalSelected` is the count of ticked
// values across all columns (drives the button text and active/off state); and
// `testIdPrefix` namespaces the data-test-id attributes so each table's editor is
// addressable.
type TableFilterProps = {
    columns: FilterableColumn[];
    selection: FilterSelection;
    onToggle: (columnId: string, value: string) => void;
    onDeselectAll: () => void;
    totalSelected: number;
    testIdPrefix: string;
};

// MUI `sx` styling for the deselect-all control. When `muted` is true the control
// is greyed out and shows the default cursor (its click handler no-ops), but it
// stays focusable so the menu still closes on Escape. Returns an empty object when
// active.
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

// The single shared dropdown filter editor for a resource table. It lists every
// filterable column the table declared and, under each, that column's distinct
// values as checkboxes. Ticking values narrows the rows: within one column the
// ticked values are OR'd, across columns they are AND'd. An empty selection means
// the filter is off (all rows show); it activates on the first tick. A search input
// filters the shown columns/options by column name or value text, and a "Deselect
// all" control clears every selection. This supersedes the old per-table filters.
export function TableFilter({ columns, selection, onToggle, onDeselectAll, totalSelected, testIdPrefix }: TableFilterProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [search, setSearch] = useState("");
    const open = anchorEl !== null;

    const noneSelected = totalSelected === 0;
    const buttonLabel = noneSelected ? "Filter: All" : `Filter: ${totalSelected} selected`;
    const shown = searchColumns(columns, search);

    function close(): void {
        setAnchorEl(null);
    }

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
            <Menu anchorEl={anchorEl} open={open} onClose={close} data-test-id={`${testIdPrefix}-menu`}>
                <Stack spacing={1} sx={{ px: 2, py: 1 }}>
                    <TextField
                        size="small"
                        placeholder="Search filters..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        // Keep printable typing in the search box out of the Menu's
                        // built-in type-ahead (which would otherwise jump focus to an
                        // option as you type). Navigation/closing keys (Escape, Tab,
                        // arrows) are left to bubble so the menu still closes on Escape.
                        onKeyDown={(e) => {
                            if (e.key.length === 1) {
                                e.stopPropagation();
                            }
                        }}
                        data-test-id={`${testIdPrefix}-search`}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                                ),
                            },
                        }}
                    />
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
                        sx={{ alignSelf: "flex-start", ...mutedWhen(noneSelected) }}
                        data-test-id={`${testIdPrefix}-deselect-all`}
                    >
                        Deselect all
                    </Link>
                </Stack>
                <Divider />
                {columns.length === 0 && (
                    <MenuItem disabled data-test-id={`${testIdPrefix}-empty`}>
                        <Typography variant="body2" color="text.secondary">No filters</Typography>
                    </MenuItem>
                )}
                {columns.length > 0 && shown.length === 0 && (
                    <MenuItem disabled data-test-id={`${testIdPrefix}-no-match`}>
                        <Typography variant="body2" color="text.secondary">No matching filters</Typography>
                    </MenuItem>
                )}
                {shown.map((column) => [
                    <ListSubheader key={`${column.columnId}-header`} data-test-id={`${testIdPrefix}-group-${column.columnId}`}>
                        {column.label}
                    </ListSubheader>,
                    ...column.options.map((value) => (
                        <MenuItem
                            key={`${column.columnId}=${value}`}
                            onClick={() => onToggle(column.columnId, value)}
                            data-test-id={`${testIdPrefix}-item-${column.columnId}-${value}`}
                        >
                            <Checkbox checked={(selection[column.columnId] ?? []).includes(value)} size="small" />
                            <ListItemText primary={value} />
                        </MenuItem>
                    )),
                ])}
            </Menu>
        </div>
    );
}
