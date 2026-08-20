import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import type { ThresholdLevel } from "../../lib/resource-utilization";
import { useShareableTo } from "../../lib/nav-state";
import { StatusBadge } from "./status-badge";

// Props for a cluster health-signal tile: a title, the large value text, a badge label and
// its threshold level, an optional highlighted flag (tints the border for a tile that needs
// attention, e.g. node pressure), an optional caption shown below the badge (used to
// explain a permanently-unavailable tile such as CPU throttling), and a test id stamped on
// the root.
//
// `to` turns the whole tile into a link to the list its count came from, carrying whatever
// query param that list reads to seed its filter (e.g. "/pods?phase=Pending"). The
// shareable context/namespace params are added by useShareableTo, so a linked tile keeps
// the cluster and namespace the user is looking at. `linkLabel` is the tile's accessible
// name and says where the link goes, since the visible text is only a number and a title.
// A tile with no `to` (the permanently-unavailable CPU-throttling tile) renders as plain,
// non-interactive text exactly as before.
type HealthSignalCardProps = {
    title: string;
    value: string;
    badgeLabel: string;
    level: ThresholdLevel;
    highlighted?: boolean;
    caption?: string;
    to?: string;
    linkLabel?: string;
    testId: string;
};

// A cluster health-signal tile matching the prototype health tiles: a title, a large
// monospace value, a status badge, and an optional caption. When highlighted, the border
// takes the MUI warning colour to draw attention (used for the node-pressure tile). Neutral
// theme colours otherwise; the colours plan maps the level to a semantic palette later.
//
// A linked tile carries a visible affordance: an arrow icon beside the title, an underlined
// value, and a primary-coloured border and lifted background on hover/focus, so it reads as
// somewhere to go rather than a static readout.
export function HealthSignalCard({ title, value, badgeLabel, level, highlighted, caption, to, linkLabel, testId }: HealthSignalCardProps) {
    const buildTo = useShareableTo();
    const linked = to !== undefined;
    return (
        <Box
            {...(linked
                ? { component: Link, to: buildTo(to), "aria-label": linkLabel }
                : {})}
            data-test-id={testId}
            data-level={level}
            data-highlighted={highlighted ? "true" : "false"}
            data-linked={linked ? "true" : "false"}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                p: 2,
                borderRadius: 2,
                border: highlighted ? 2 : 1,
                borderColor: highlighted ? "warning.main" : "divider",
                bgcolor: "background.paper",
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
                        "&:hover [data-test-id='health-signal-value'], &:focus-visible [data-test-id='health-signal-value']": {
                            textDecoration: "underline",
                        },
                    }
                    : {}),
            }}
        >
            <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "text.secondary", display: "flex", alignItems: "center", gap: 0.75 }}
            >
                {title}
                {linked && (
                    <FontAwesomeIcon
                        icon={faArrowUpRightFromSquare}
                        style={{ fontSize: "0.7em" }}
                        data-test-id="health-signal-link-icon"
                    />
                )}
            </Typography>
            <Typography
                data-test-id="health-signal-value"
                sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.5rem", lineHeight: 1.1 }}
            >
                {value}
            </Typography>
            <Box>
                <StatusBadge label={badgeLabel} level={level} />
            </Box>
            {caption && (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {caption}
                </Typography>
            )}
        </Box>
    );
}
