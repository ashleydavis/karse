import { useMemo, useState } from "react";
import { IconButton, Menu, MenuItem, ListItemText, ListSubheader, Divider } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsis } from "@fortawesome/free-solid-svg-icons";
import {
    type EventFilter,
    type FilterableItem,
    rowFilterActions,
    filterActionText,
    filterCoverageText,
    countMatchingItems,
} from "../lib/event-filter";

// Props for the per-row "..." filter menu. `item` is the event/error the row shows (the
// menu's actions are derived from its hashes and service), `items` is every item the feed
// loaded (so the menu can say how many of them each action covers), `noun` names them
// ("events" / "errors"), `onAddFilter` activates the chosen filter on the feed, and
// `testIdPrefix` namespaces the data-test-id attributes so each feed's menu is
// addressable ("events" / "errors").
type RowFilterMenuProps = {
    item: FilterableItem;
    items: FilterableItem[];
    noun: string;
    onAddFilter: (filter: EventFilter) => void;
    testIdPrefix: string;
};

// The "..." button on an events/errors row, opening the menu that activates a filter for
// items like that row's. It offers the three hide actions (all like this / like this for
// this service / everything from this service) and the three matching show-only actions.
//
// Every action states what it covers before it is chosen: how many of the loaded items it
// takes in, and the details the group is keyed on (the reason plus the normalised message,
// or the service for a whole-service action). A user must be able to see the reach of a
// filter before hiding anything, because a hidden item is information they no longer see.
//
// Clicks are kept from bubbling, so using the menu never triggers the row's own navigation
// to the detail page.
export function RowFilterMenu({ item, items, noun, onAddFilter, testIdPrefix }: RowFilterMenuProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    // Only worked out while the menu is open: counting each action's matches walks every
    // loaded item, and a closed menu on every row of a long feed must cost nothing.
    const actions = useMemo(() => (open ? rowFilterActions(item) : []), [open, item]);
    const coverage = useMemo(
        () => actions.map((action) => ({
            action,
            matches: countMatchingItems(items, action),
        })),
        [actions, items],
    );

    function close(): void {
        setAnchorEl(null);
    }

    // Renders one action as a menu item: what it does, and under it what it covers —
    // how many of the loaded items it takes in, and the group it is keyed on. Choosing it
    // activates that filter and closes the menu.
    function renderAction({ action, matches }: { action: EventFilter; matches: number }) {
        return (
            <MenuItem
                key={`${action.mode}-${action.scope}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onAddFilter(action);
                    close();
                }}
                data-test-id={`${testIdPrefix}-row-menu-${action.mode}-${action.scope}`}
                sx={{ whiteSpace: "normal", maxWidth: 520 }}
            >
                <ListItemText
                    primary={filterActionText(action)}
                    secondary={(
                        <span data-test-id={`${testIdPrefix}-row-menu-coverage-${action.mode}-${action.scope}`}>
                            {`Matches ${matches} of ${items.length} ${noun}: ${filterCoverageText(action)}`}
                        </span>
                    )}
                    slotProps={{ secondary: { sx: { whiteSpace: "normal" } } }}
                />
            </MenuItem>
        );
    }

    return (
        <div>
            <IconButton
                size="small"
                aria-label="Filter items like this"
                onClick={(event) => {
                    event.stopPropagation();
                    setAnchorEl(event.currentTarget);
                }}
                data-test-id={`${testIdPrefix}-row-menu-button`}
            >
                <FontAwesomeIcon icon={faEllipsis} />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={close}
                onClick={(event) => event.stopPropagation()}
                data-test-id={`${testIdPrefix}-row-menu`}
            >
                <ListSubheader>Hide</ListSubheader>
                {coverage.filter(({ action }) => action.mode === "hide").map(renderAction)}
                <Divider />
                <ListSubheader>Show only</ListSubheader>
                {coverage.filter(({ action }) => action.mode === "only").map(renderAction)}
            </Menu>
        </div>
    );
}
