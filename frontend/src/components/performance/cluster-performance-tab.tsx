import { Paper, Typography } from "@mui/material";

// Props for the cluster Performance tab. `active` mirrors the eventual signature
// (true when this tab is the selected one) so the content ticket can fill the
// body in place without changing the call site.
type ClusterPerformanceTabProps = {
    active: boolean;
};

// Stub for the cluster-level Performance tab. Renders a labelled placeholder
// only; no metrics fetch or charts yet. The content ticket replaces the body.
export function ClusterPerformanceTab({ active: _active }: ClusterPerformanceTabProps) {
    return (
        <Paper variant="outlined" sx={{ p: 3 }} data-test-id="perf-cluster-stub">
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Performance
            </Typography>
            <Typography color="text.secondary">
                Performance metrics coming soon.
            </Typography>
        </Paper>
    );
}
