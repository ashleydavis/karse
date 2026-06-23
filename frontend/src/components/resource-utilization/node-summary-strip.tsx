import { Box, Typography } from "@mui/material";
import type { ThresholdLevel } from "../../lib/resource-utilization";

// Props for the node-summary strip: the three band counts produced by
// buildNodeUtilizationSummary (nodes over-utilized, healthy, and under-utilized by CPU
// requests share of allocatable).
type NodeSummaryStripProps = {
    summary: {
        over: number;
        healthy: number;
        under: number;
    };
};

// One band card in the strip: a large monospace count, a title, and a caption. The level is
// carried for the colours plan; neutral theme colours for now.
function SummaryCard({
    count,
    title,
    caption,
    level,
    testId,
}: {
    count: number;
    title: string;
    caption: string;
    level: ThresholdLevel;
    testId: string;
}) {
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
                flex: 1,
                minWidth: 120,
            }}
        >
            <Typography sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.75rem", lineHeight: 1.1 }}>
                {count}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {caption}
            </Typography>
        </Box>
    );
}

// The nodes-page summary strip: three cards counting nodes by their CPU-requests band
// (over-utilized ≥ 85%, healthy 40–85%, under-utilized < 40% of allocatable), matching the
// prototype nodes.html strip. Counts come from buildNodeUtilizationSummary.
export function NodeSummaryStrip({ summary }: NodeSummaryStripProps) {
    return (
        <Box data-test-id="node-summary-strip" sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <SummaryCard
                count={summary.over}
                title="Over-utilized"
                caption="CPU requests ≥ 85% of allocatable"
                level="critical"
                testId="node-summary-over"
            />
            <SummaryCard
                count={summary.healthy}
                title="Healthy"
                caption="CPU requests 40–85% of allocatable"
                level="ok"
                testId="node-summary-healthy"
            />
            <SummaryCard
                count={summary.under}
                title="Under-utilized"
                caption="CPU requests < 40% of allocatable"
                level="warn"
                testId="node-summary-under"
            />
        </Box>
    );
}
