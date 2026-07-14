import { useState } from "react";
import {
    Button,
    Menu,
    Stack,
    Radio,
    FormControlLabel,
    RadioGroup,
    TextField,
    Select,
    MenuItem,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import {
    formatTimeRange,
    ALL_TIME_RANGE,
    TIME_RANGE_UNITS,
    MIN_TIME_RANGE_COUNT,
    DEFAULT_TIME_RANGE_COUNT,
    DEFAULT_TIME_RANGE_UNIT,
    type TimeRange,
    type TimeRangeUnit,
} from "../lib/time-range";

// Props for the shared time-range control. `range` is the currently applied range,
// `onChange` reports the range the user picked, and `testIdPrefix` namespaces the
// data-test-id attributes so each view's control is separately addressable.
type TimeRangeFilterProps = {
    range: TimeRange;
    onChange: (range: TimeRange) => void;
    testIdPrefix: string;
};

// The single shared time-range control for a time-based view (Events, Errors). Its
// button reads the applied range ("Range: Last 7 days") and opens a small editor
// offering "All time" or a custom "Last X <period>", where X is a number and the
// period is one of minute/hour/day/week/month.
//
// Editing the number or the period applies a "Last" range immediately (it implies
// the Last mode, so the user does not have to select the radio first). A number
// below the minimum, or a part-typed empty box, leaves the applied range alone
// until it parses to a usable value, so the table never blanks out mid-keystroke.
//
// The number and period boxes keep their own draft state rather than reading the
// applied range, so switching to "All time" (which has no number or period of its
// own) and back does not silently discard the X and period the user last chose.
export function TimeRangeFilter({ range, onChange, testIdPrefix }: TimeRangeFilterProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    // The raw text of the count box, so it can be briefly empty or invalid while the
    // user types without the applied range (and therefore the table) flickering.
    const [countText, setCountText] = useState(
        String(range.kind === "last" ? range.count : DEFAULT_TIME_RANGE_COUNT),
    );
    const [unit, setUnit] = useState<TimeRangeUnit>(
        range.kind === "last" ? range.unit : DEFAULT_TIME_RANGE_UNIT,
    );

    function close(): void {
        setAnchorEl(null);
    }

    // Applies a "Last X <period>" range from the given count text and period,
    // ignoring a count that is not a whole number at or above the minimum.
    function applyLast(text: string, nextUnit: TimeRangeUnit): void {
        const count = Number(text);
        if (!Number.isInteger(count) || count < MIN_TIME_RANGE_COUNT)
        {
            return;
        }
        onChange({
            kind: "last",
            count,
            unit: nextUnit,
        });
    }

    return (
        <div>
            <Button
                variant="outlined"
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                startIcon={<FontAwesomeIcon icon={faClock} />}
                data-test-id={`${testIdPrefix}-button`}
            >
                {`Range: ${formatTimeRange(range)}`}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={close}
                data-test-id={`${testIdPrefix}-menu`}
            >
                <RadioGroup
                    value={range.kind}
                    sx={{ px: 2, py: 1 }}
                >
                    <FormControlLabel
                        value="all"
                        control={<Radio size="small" data-test-id={`${testIdPrefix}-all`} />}
                        label="All time"
                        onChange={() => onChange(ALL_TIME_RANGE)}
                    />
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <FormControlLabel
                            value="last"
                            control={<Radio size="small" data-test-id={`${testIdPrefix}-last`} />}
                            label="Last"
                            onChange={() => applyLast(countText, unit)}
                        />
                        <TextField
                            size="small"
                            type="number"
                            value={countText}
                            onChange={(e) => {
                                setCountText(e.target.value);
                                applyLast(e.target.value, unit);
                            }}
                            // Keep printable typing in the number box out of the Menu's
                            // built-in type-ahead, which would otherwise steal focus to a
                            // menu item as the user types a digit.
                            onKeyDown={(e) => {
                                if (e.key.length === 1)
                                {
                                    e.stopPropagation();
                                }
                            }}
                            slotProps={{ htmlInput: { min: MIN_TIME_RANGE_COUNT } }}
                            sx={{ width: 90 }}
                            data-test-id={`${testIdPrefix}-count`}
                        />
                        <Select
                            size="small"
                            value={unit}
                            onChange={(e) => {
                                setUnit(e.target.value);
                                applyLast(countText, e.target.value);
                            }}
                            data-test-id={`${testIdPrefix}-unit`}
                        >
                            {TIME_RANGE_UNITS.map((option) => (
                                <MenuItem
                                    key={option}
                                    value={option}
                                    data-test-id={`${testIdPrefix}-unit-${option}`}
                                >
                                    {`${option}s`}
                                </MenuItem>
                            ))}
                        </Select>
                    </Stack>
                </RadioGroup>
            </Menu>
        </div>
    );
}
