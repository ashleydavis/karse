import { Chip } from "@mui/material";
import type { ThresholdLevel } from "../../lib/resource-utilization";

// Props for a threshold status badge: the text to show and the threshold level that picks
// the MUI semantic colour.
type StatusBadgeProps = {
    label: string;
    level: ThresholdLevel;
};

// Maps a colour-free threshold level to an MUI Chip colour. Uses MUI's built-in semantic
// palette (success/warning/error/default) for now; the colours plan swaps these for the
// project's own threshold palette by reading the same level. "info" is neutral.
function chipColor(level: ThresholdLevel): "success" | "warning" | "error" | "default" {
    if (level === "ok") {
        return "success";
    }
    if (level === "warn") {
        return "warning";
    }
    if (level === "critical") {
        return "error";
    }
    return "default";
}

// A small rounded threshold badge: an MUI Chip coloured by the threshold level. Shown
// against node/pod/cluster rows and health tiles to label their severity.
export function StatusBadge({ label, level }: StatusBadgeProps) {
    return (
        <Chip
            label={label}
            size="small"
            color={chipColor(level)}
            data-test-id="util-status-badge"
            data-level={level}
            sx={{ borderRadius: 1, fontWeight: 600 }}
        />
    );
}
