import { Box, Typography, useTheme } from "@mui/material";
import type { ThresholdLevel } from "../../lib/resource-utilization";

// Props for a table-cell utilisation bar: the fill percentage (null → em-dash and empty
// bar), the right-aligned monospace display text, the threshold level (carried for the
// colours plan; neutral theme colours for now), and a test id stamped on the root.
type ResourceBarCellProps = {
    percent: number | null;
    displayText: string;
    level: ThresholdLevel;
    testId: string;
};

// A compact nodes/pods table cell: an inline progress bar with a right-aligned monospace
// value. The bar fills to percent using the theme primary colour for now (the colours plan
// maps the level prop to a semantic palette later). A null percent renders an empty bar and
// an em-dash value. The level prop is intentionally unused visually until then.
export function ResourceBarCell({ percent, displayText, level, testId }: ResourceBarCellProps) {
    const theme = useTheme();
    const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
    return (
        <Box
            data-test-id={testId}
            data-level={level}
            sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 140 }}
        >
            <Box sx={{ position: "relative", flexGrow: 1, height: 8, bgcolor: "action.hover", borderRadius: 1 }}>
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
            <Typography
                variant="body2"
                data-test-id={`${testId}-value`}
                sx={{ fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap", textAlign: "right" }}
            >
                {percent === null && displayText === "" ? "—" : displayText}
            </Typography>
        </Box>
    );
}
