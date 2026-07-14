import { Alert, Box, Button, Chip, Tooltip, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/free-solid-svg-icons";
import { type EventFilter, filterChipText, filterCoverageText, filterKey } from "../lib/event-filter";

// Props for the active row-filter bar. `filters` are the feed's active row filters,
// `hiddenCount` is how many items they hide, `noun` names the items ("events"/"errors"),
// `onRemove` drops one filter by its key, `onReset` clears every filter, and
// `testIdPrefix` namespaces the data-test-id attributes per feed.
type ActiveRowFiltersProps = {
    filters: EventFilter[];
    hiddenCount: number;
    noun: string;
    onRemove: (key: string) => void;
    onReset: () => void;
    testIdPrefix: string;
};

// The banner shown above an events/errors table while row filters are active. It is the
// UI's indication that items are being hidden: it says how many, lists each active filter
// as a removable chip, and carries the reset control that clears them all and restores
// the full list. It renders nothing when no filter is active.
//
// Each chip names the service the filter reaches and the details of the group it covers,
// so what has been hidden stays visible on the page rather than being an unlabelled
// filter the user has to remember. The details are cut short to keep the chip one line;
// the whole of it is on the chip's tooltip.
export function ActiveRowFilters({ filters, hiddenCount, noun, onRemove, onReset, testIdPrefix }: ActiveRowFiltersProps) {
    if (filters.length === 0) {
        return null;
    }

    return (
        <Alert
            severity="info"
            icon={<FontAwesomeIcon icon={faFilter} />}
            data-test-id={`${testIdPrefix}-active-filters`}
            action={(
                <Button
                    size="small"
                    onClick={onReset}
                    data-test-id={`${testIdPrefix}-reset-filters`}
                >
                    Reset filters
                </Button>
            )}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                }}
            >
                <Typography variant="body2" data-test-id={`${testIdPrefix}-hidden-count`}>
                    {hiddenCount} {noun} hidden by filters
                </Typography>
                {filters.map((filter) => (
                    <Tooltip key={filterKey(filter)} title={filterCoverageText(filter)}>
                        <Chip
                            size="small"
                            label={filterChipText(filter)}
                            onDelete={() => onRemove(filterKey(filter))}
                            data-test-id={`${testIdPrefix}-filter-chip`}
                        />
                    </Tooltip>
                ))}
            </Box>
        </Alert>
    );
}
