import { Box, Typography } from "@mui/material";
import type { ThresholdLevel } from "../../lib/resource-utilization";
import { StatusBadge } from "./status-badge";

// Props for a cluster health-signal tile: a title, the large value text, a badge label and
// its threshold level, an optional highlighted flag (tints the border for a tile that needs
// attention, e.g. node pressure), and a test id stamped on the root.
type HealthSignalCardProps = {
    title: string;
    value: string;
    badgeLabel: string;
    level: ThresholdLevel;
    highlighted?: boolean;
    testId: string;
};

// A cluster health-signal tile matching the prototype health tiles: a title, a large
// monospace value, and a status badge. When highlighted, the border takes the MUI warning
// colour to draw attention (used for the node-pressure tile). Neutral theme colours
// otherwise; the colours plan maps the level to a semantic palette later.
export function HealthSignalCard({ title, value, badgeLabel, level, highlighted, testId }: HealthSignalCardProps) {
    return (
        <Box
            data-test-id={testId}
            data-level={level}
            data-highlighted={highlighted ? "true" : "false"}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                p: 2,
                borderRadius: 2,
                border: highlighted ? 2 : 1,
                borderColor: highlighted ? "warning.main" : "divider",
                bgcolor: "background.paper",
            }}
        >
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
                {title}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.5rem", lineHeight: 1.1 }}>
                {value}
            </Typography>
            <Box>
                <StatusBadge label={badgeLabel} level={level} />
            </Box>
        </Box>
    );
}
