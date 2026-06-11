import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { PerformanceMetric } from "karse-types";

// A controlled CPU / Memory toggle shared by every Performance view. The selected
// metric drives which usage field the treemap, heatmap, and tables read. Exactly one
// option is always selected: a null change (clicking the active button) is ignored so
// the toggle can never end up with no metric chosen.
export function MetricToggle({
    value,
    onChange,
}: {
    value: PerformanceMetric;
    onChange: (metric: PerformanceMetric) => void;
}) {
    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            value={value}
            onChange={(_, next: PerformanceMetric | null) => {
                if (next !== null) {
                    onChange(next);
                }
            }}
            data-test-id="perf-metric-toggle"
            aria-label="performance metric"
        >
            <ToggleButton value="cpu" data-test-id="perf-metric-cpu">
                CPU
            </ToggleButton>
            <ToggleButton value="memory" data-test-id="perf-metric-memory">
                Memory
            </ToggleButton>
        </ToggleButtonGroup>
    );
}
