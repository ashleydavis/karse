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
    Box,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { searchColumns, type FilterableColumn, type FilterSelection } from "../lib/table-filter-state";

// Minimum width of one option column, in pixels. Each group's options are laid
// out in horizontal rows that wrap into as many columns of at least this width as
// the editor allows, so the checkboxes fill the available width instead of
// stacking in a single column. Kept wide enough that labels stay readable.
const OPTION_COLUMN_MIN_WIDTH = 200;
// The editor body's width, in pixels. Fixed (and capped to the viewport on the
// menu paper) so the option grid always has room to flow its checkboxes into
// several columns and fill the width, rather than collapsing to one narrow
// column. This keeps the wide dropdown the multi-column layout already had.
const EDITOR_BODY_WIDTH = 640;
// The capped height of the scrollable editor body, in pixels. When the groups and
// their options together run past this, the body scrolls and shows a scrollbar so
// the user can tell there is more. Sized so a few small groups fit without
// scrolling, while a group with many values (or many groups) overflows and the
// scrollbar appears.
const EDITOR_BODY_MAX_HEIGHT = 360;

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

// MUI `sx` styling for the Clear control. When `muted` is true the control is
// greyed out and shows the default cursor (its click handler no-ops), but it
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
// filters the shown columns/options by column name or value text, and a "Clear"
// control clears every selection. Each group's options flow in horizontal rows
// that wrap into multiple columns so the checkboxes fill the editor's width, and
// the editor body scrolls with a visible scrollbar when its content overflows.
// This supersedes the old per-table filters.
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
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={close}
                data-test-id={`${testIdPrefix}-menu`}
                // Cap the menu width to the viewport so the option columns never
                // overflow the screen, and cap its height to the viewport so the
                // scrollable body (which has its own capped height) is never pushed
                // off-screen. The width is otherwise left to MUI's default so the
                // dropdown keeps the width it already had.
                slotProps={{ paper: { sx: { maxWidth: "90vw", maxHeight: "90vh" } } }}
            >
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
                        Clear
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
                {/*
                    The editor body holding every group. It is capped to a fixed
                    height and scrolls (overflowY: auto) so that when the groups and
                    their options together run past that height a scrollbar appears,
                    telling the user there is more to see. The scrollbar is styled so
                    it is always painted (not just an overlay that shows on hover), so
                    the user can always tell when there is more below. The body has a
                    fixed width, so the dropdown width is unchanged.
                */}
                {shown.length > 0 && (
                    <Box
                        sx={{
                            width: EDITOR_BODY_WIDTH,
                            maxWidth: "100%",
                            maxHeight: EDITOR_BODY_MAX_HEIGHT,
                            overflowY: "auto",
                            // Make the scrollbar visible (rather than an overlay that
                            // only appears on hover/scroll) so overflow is obvious.
                            scrollbarWidth: "thin",
                            "&::-webkit-scrollbar": { width: "10px" },
                            "&::-webkit-scrollbar-thumb": {
                                backgroundColor: "text.disabled",
                                borderRadius: "5px",
                            },
                        }}
                        data-test-id={`${testIdPrefix}-body`}
                    >
                        {shown.map((column) => (
                            <Box key={column.columnId} data-test-id={`${testIdPrefix}-group-block-${column.columnId}`}>
                                <ListSubheader data-test-id={`${testIdPrefix}-group-${column.columnId}`}>
                                    {column.label}
                                </ListSubheader>
                                {/*
                                    Lay this group's options out in horizontal rows
                                    that wrap into multiple columns, so the checkboxes
                                    fill the editor's width instead of stacking in one
                                    column and leaving a wide empty margin. The grid
                                    fits as many columns of at least
                                    OPTION_COLUMN_MIN_WIDTH as the width allows and
                                    flows the options left-to-right across each row
                                    (grid-auto-flow: row), wrapping to the next row.
                                    Each option keeps its MenuItem markup and
                                    data-test-id, so the filter behaviour and its e2e
                                    hooks are unchanged; only the placement differs.
                                */}
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: `repeat(auto-fill, minmax(${OPTION_COLUMN_MIN_WIDTH}px, 1fr))`,
                                    }}
                                    data-test-id={`${testIdPrefix}-options-${column.columnId}`}
                                >
                                    {column.options.map((value) => (
                                        <MenuItem
                                            key={`${column.columnId}=${value}`}
                                            onClick={() => onToggle(column.columnId, value)}
                                            data-test-id={`${testIdPrefix}-item-${column.columnId}-${value}`}
                                        >
                                            <Checkbox checked={(selection[column.columnId] ?? []).includes(value)} size="small" />
                                            <ListItemText primary={value} />
                                        </MenuItem>
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Menu>
        </div>
    );
}
