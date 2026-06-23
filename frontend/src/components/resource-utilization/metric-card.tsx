import { Box, Typography, useTheme } from "@mui/material";
import type { ThresholdLevel } from "../../lib/resource-utilization";

// Props for a resource-utilization metric card: a label, the large value text, a caption
// sublabel, the fill percentage of the progress bar (null → empty bar), the threshold
// level (carried for the colours plan; the bar uses neutral theme colours for now), and a
// test id stamped on the root and the bar.
type MetricCardProps = {
    label: string;
    valueText: string;
    sublabel: string;
    percent: number | null;
    level: ThresholdLevel;
    testId: string;
};

// A cluster-scope metric card: a label, a large monospace value, a thin progress bar whose
// width is the percent, and a caption sublabel. The bar uses the theme primary colour for
// now; the colours plan maps the level prop to a semantic palette later. A null percent
// renders an empty bar. The level prop is intentionally unused visually until then.
export function MetricCard({ label, valueText, sublabel, percent, level, testId }: MetricCardProps) {
    const theme = useTheme();
    const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
    return (
        <Box
            data-test-id={testId}
            data-level={level}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
            }}
        >
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
                {label}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.75rem", lineHeight: 1.1 }}>
                {valueText}
            </Typography>
            <Box sx={{ position: "relative", height: 6, bgcolor: "action.hover", borderRadius: 1 }}>
                <Box
                    data-test-id={`${testId}-bar`}
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${width}%`,
                        bgcolor: theme.palette.primary.main,
                        borderRadius: 1,
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {sublabel}
            </Typography>
        </Box>
    );
}
