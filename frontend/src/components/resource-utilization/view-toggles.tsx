import { ToggleButton, ToggleButtonGroup, Box } from "@mui/material";
import { useResourceUtilization } from "../../lib/resource-utilization-context";
import type { ViewMode, ValueFormat } from "../../lib/resource-utilization";

// The shared View-mode (Usage | Requests) and Value-format (% | Absolute) toggles for the
// resource-utilization surfaces. Both groups read and write the shared
// resource-utilization-context so one choice drives every bar in the wrapped section
// together. Styled with MUI ToggleButtonGroup to match the existing MetricToggle. Exactly
// one option is always selected in each group: a null change (clicking the active button)
// is ignored so a group can never end up with nothing chosen.
export function ViewToggles() {
    const { mode, format, setMode, setFormat } = useResourceUtilization();
    return (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                onChange={(_, next: ViewMode | null) => {
                    if (next !== null) {
                        setMode(next);
                    }
                }}
                data-test-id="util-view-mode"
                aria-label="resource view mode"
            >
                <ToggleButton value="usage" data-test-id="util-view-mode-usage">
                    Usage
                </ToggleButton>
                <ToggleButton value="requests" data-test-id="util-view-mode-requests">
                    Requests
                </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
                exclusive
                size="small"
                value={format}
                onChange={(_, next: ValueFormat | null) => {
                    if (next !== null) {
                        setFormat(next);
                    }
                }}
                data-test-id="util-value-format"
                aria-label="resource value format"
            >
                <ToggleButton value="percent" data-test-id="util-value-format-percent">
                    %
                </ToggleButton>
                <ToggleButton value="absolute" data-test-id="util-value-format-absolute">
                    Absolute
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
