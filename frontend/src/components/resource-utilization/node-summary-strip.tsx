import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import type { ThresholdLevel } from "../../lib/resource-utilization";
import { NODE_UTILIZATION_BANDS } from "../../lib/resource-utilization";
import { useShareableTo } from "../../lib/nav-state";

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
//
// `to` makes the whole card a link to the nodes list filtered to this band, so the count and
// the rows behind it are one click apart; `linkLabel` is its accessible name, since the
// visible text alone does not say where the card goes. The shareable context/namespace
// params come from useShareableTo. A card with no `to` stays plain, non-interactive text.
function SummaryCard({
    count,
    title,
    caption,
    level,
    to,
    linkLabel,
    testId,
}: {
    count: number;
    title: string;
    caption: string;
    level: ThresholdLevel;
    to?: string;
    linkLabel?: string;
    testId: string;
}) {
    const buildTo = useShareableTo();
    const linked = to !== undefined;
    return (
        <Box
            {...(linked
                ? { component: Link, to: buildTo(to), "aria-label": linkLabel }
                : {})}
            data-test-id={testId}
            data-level={level}
            data-linked={linked ? "true" : "false"}
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
                ...(linked
                    ? {
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer",
                        transition: "border-color 120ms, background-color 120ms",
                        "&:hover, &:focus-visible": {
                            borderColor: "primary.main",
                            bgcolor: "action.hover",
                        },
                        "&:hover [data-test-id='node-summary-count'], &:focus-visible [data-test-id='node-summary-count']": {
                            textDecoration: "underline",
                        },
                    }
                    : {}),
            }}
        >
            <Typography
                data-test-id="node-summary-count"
                sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.75rem", lineHeight: 1.1 }}
            >
                {count}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.75 }}>
                {title}
                {linked && (
                    <FontAwesomeIcon
                        icon={faArrowUpRightFromSquare}
                        style={{ fontSize: "0.7em" }}
                        data-test-id="node-summary-link-icon"
                    />
                )}
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
//
// Each card links to the nodes list filtered to its own band, via the `band` query param
// the nodes view reads to seed its Utilization filter. The band names in the links are
// NODE_UTILIZATION_BANDS, the same labels the classifier and the filter use, so the count
// on the card and the number of rows the link opens are the same nodes.
export function NodeSummaryStrip({ summary }: NodeSummaryStripProps) {
    const [over, healthy, under] = NODE_UTILIZATION_BANDS;
    return (
        <Box data-test-id="node-summary-strip" sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <SummaryCard
                count={summary.over}
                title="Over-utilized"
                caption="CPU requests ≥ 85% of allocatable"
                level="critical"
                to={`/nodes?band=${encodeURIComponent(over)}`}
                linkLabel={`${summary.over} over-utilized nodes: show the nodes list filtered to over-utilized`}
                testId="node-summary-over"
            />
            <SummaryCard
                count={summary.healthy}
                title="Healthy"
                caption="CPU requests 40–85% of allocatable"
                level="ok"
                to={`/nodes?band=${encodeURIComponent(healthy)}`}
                linkLabel={`${summary.healthy} healthy nodes: show the nodes list filtered to healthy`}
                testId="node-summary-healthy"
            />
            <SummaryCard
                count={summary.under}
                title="Under-utilized"
                caption="CPU requests < 40% of allocatable"
                level="warn"
                to={`/nodes?band=${encodeURIComponent(under)}`}
                linkLabel={`${summary.under} under-utilized nodes: show the nodes list filtered to under-utilized`}
                testId="node-summary-under"
            />
        </Box>
    );
}
