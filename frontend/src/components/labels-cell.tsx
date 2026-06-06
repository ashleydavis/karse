import { Chip, Typography } from "@mui/material";
import { labelsToPairs } from "./labels-cell-pairs";

// Renders a resource's labels as compact "key=value" chips for a table Labels
// column. Shows a muted dash when the resource carries no labels. Used across
// every resource list (pods, nodes, deployments, statefulsets, daemonsets,
// namespaces) so the Labels column looks the same everywhere.
export function LabelsCell({ labels }: { labels: Record<string, string> | undefined | null }) {
    const pairs = labelsToPairs(labels);
    if (pairs.length === 0) {
        return <Typography component="span" color="text.secondary">-</Typography>;
    }
    return (
        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }} data-test-id="labels-cell">
            {pairs.map((pair) => (
                <Chip key={pair} label={pair} size="small" variant="outlined" />
            ))}
        </span>
    );
}
