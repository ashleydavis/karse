import { useState } from "react";
import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography, useTheme } from "@mui/material";
import type { PodPerformance } from "karse-types";
import { formatCpu, formatMemory, podResourceRows } from "../../lib/performance";
import type { PodResourceRow, PodNodeShareResource } from "../../lib/performance";
import { podRequestPercent } from "../../lib/resource-utilization";
import type { ValueFormat } from "../../lib/resource-utilization";

// Props for the pod Performance panel: the pod's performance snapshot and the `active`
// flag (true only when the Performance tab is selected) so a parent can keep the data
// fetch lazy. The panel itself is presentational and renders from `data` directly.
type PodResourcePanelProps = {
    data: PodPerformance;
    active: boolean;
};

// The text shown in a Requested / Limit / Usage-now tile for the selected value format.
// In **Absolute** the raw figure is shown via the metric's own formatter (cpu in m/cores,
// memory in binary units). In **Percentage** the figure is shown as a percentage of the
// pod's own request for that resource — the per-scope base the spec defines for pod detail
// (so usage reads as "how close to its reservation", and the limit as "headroom over the
// request"). A null figure (unset request/limit, or absent usage) renders the em-dash
// placeholder in either format rather than a misleading 0.
function tileText(
    value: number | null,
    request: number | null,
    resource: PodNodeShareResource,
    format: ValueFormat,
): string {
    if (format === "absolute") {
        return (resource === "cpu" ? formatCpu : formatMemory)(value);
    }
    const percent = podRequestPercent(value, request);
    return percent === null ? "—" : `${percent}%`;
}

// One small tile in a resource section: a label (Requested / Limit / Usage now) over a
// large monospace value. A null figure renders the formatter's em-dash placeholder, so an
// unset request/limit or an absent usage reading reads honestly rather than as "0".
function ResourceTile({ label, valueText, testId }: { label: string; valueText: string; testId: string }) {
    return (
        <Box
            data-test-id={testId}
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                p: 1.5,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
            }}
        >
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                {label}
            </Typography>
            <Typography
                data-test-id={`${testId}-value`}
                sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.25rem", lineHeight: 1.2 }}
            >
                {valueText}
            </Typography>
        </Box>
    );
}

// The combined bar for one resource: a neutral track filled to the usage percentage of the
// per-resource scale (the largest of usage/request/limit), with thin vertical markers where
// the request and limit sit on the same scale. Markers are omitted when their value is
// unknown (no request/limit set). Bar colours are neutral theme colours (plan 2 maps a
// semantic palette later). A null usage leaves the fill empty.
function CombinedBar({ row, testId }: { row: PodResourceRow; testId: string }) {
    const theme = useTheme();
    const fill = row.usagePercent === null ? 0 : Math.min(100, Math.max(0, row.usagePercent));
    return (
        <Box data-test-id={testId} sx={{ position: "relative", height: 14, bgcolor: "action.hover", borderRadius: 1 }}>
            <Box
                data-test-id={`${testId}-usage`}
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${fill}%`,
                    bgcolor: theme.palette.primary.main,
                    borderRadius: 1,
                }}
            />
            {row.requestMark !== null && (
                <Box
                    data-test-id={`${testId}-request-mark`}
                    sx={{
                        position: "absolute",
                        top: -2,
                        bottom: -2,
                        left: `${Math.min(100, row.requestMark)}%`,
                        width: 2,
                        bgcolor: "text.secondary",
                    }}
                />
            )}
            {row.limitMark !== null && (
                <Box
                    data-test-id={`${testId}-limit-mark`}
                    sx={{
                        position: "absolute",
                        top: -2,
                        bottom: -2,
                        left: `${Math.min(100, row.limitMark)}%`,
                        width: 2,
                        bgcolor: "text.primary",
                    }}
                />
            )}
        </Box>
    );
}

// One resource section (CPU or Memory): the three tiles (Requested / Limit / Usage now) and
// the combined usage-vs-request-vs-limit bar, with a small legend tying the markers to their
// meaning. Uses the metric's own formatter (cpu in m/cores, memory in binary units).
function ResourceSection({ row, format, testId }: { row: PodResourceRow; format: ValueFormat; testId: string }) {
    const title = row.resource === "cpu" ? "CPU" : "Memory";
    return (
        <Paper data-test-id={testId} variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {title}
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5 }}>
                <ResourceTile
                    label="Requested"
                    valueText={tileText(row.request, row.request, row.resource, format)}
                    testId={`${testId}-requested`}
                />
                <ResourceTile
                    label="Limit"
                    valueText={tileText(row.limit, row.request, row.resource, format)}
                    testId={`${testId}-limit`}
                />
                <ResourceTile
                    label="Usage now"
                    valueText={tileText(row.usage, row.request, row.resource, format)}
                    testId={`${testId}-usage`}
                />
            </Box>
            <CombinedBar row={row} testId={`${testId}-bar`} />
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <LegendItem color="primary.main" label="Usage" />
                <LegendItem color="text.secondary" label="Request" />
                <LegendItem color="text.primary" label="Limit" />
            </Box>
        </Paper>
    );
}

// A small swatch + label tying a bar colour/marker to its meaning in the legend.
function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {label}
            </Typography>
        </Box>
    );
}

// The pod Performance panel: a CPU section and a Memory section, each with Requested / Limit
// / Usage-now tiles and a combined bar plotting live usage against the request and limit on a
// shared per-resource scale. Reads the pod's summed usage/requests/limits from the snapshot
// (defensively defaulting an absent pod to all-null figures so the panel never throws). Bar
// colours are neutral theme colours; the colours plan (plan 2) maps a semantic palette later.
//
// A shared Percentage / Absolute toggle (reusing the resource-utilization ValueFormat token
// and the MUI ToggleButtonGroup styling of ViewToggles) drives both sections together: in
// Absolute the tiles read the raw figures, in Percentage they read as a percentage of the
// pod's own request. Default Absolute, since Requested / Limit / Usage-now are inherently
// absolute readings. Exactly one option is always selected (a null change — clicking the
// active button — is ignored), so the toggle can never end up with nothing chosen.
export function PodResourcePanel({ data }: PodResourcePanelProps) {
    const [format, setFormat] = useState<ValueFormat>("absolute");
    const usage = data.pod?.usage ?? { cpuMillicores: null, memoryBytes: null };
    const requests = data.pod?.requests ?? { cpuMillicores: null, memoryBytes: null };
    const limits = data.pod?.limits ?? { cpuMillicores: null, memoryBytes: null };
    const rows = podResourceRows(usage, requests, limits);
    return (
        <Box data-test-id="pod-resource-panel" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ToggleButtonGroup
                exclusive
                size="small"
                value={format}
                onChange={(_, next: ValueFormat | null) => {
                    if (next !== null) {
                        setFormat(next);
                    }
                }}
                data-test-id="pod-resource-format"
                aria-label="resource value format"
                sx={{ alignSelf: "flex-start" }}
            >
                <ToggleButton value="percent" data-test-id="pod-resource-format-percent">
                    Percentage
                </ToggleButton>
                <ToggleButton value="absolute" data-test-id="pod-resource-format-absolute">
                    Absolute
                </ToggleButton>
            </ToggleButtonGroup>
            {rows.map((row) => (
                <ResourceSection key={row.resource} row={row} format={format} testId={`pod-resource-${row.resource}`} />
            ))}
        </Box>
    );
}
