import { Paper, Typography } from "@mui/material";

// Props for the node Performance tab. `nodeName` and `active` mirror the eventual
// signature so the content ticket can fill the body in place without changing the
// call site.
type NodePerformanceTabProps = {
    nodeName: string;
    active: boolean;
};

// Stub for the node-level Performance tab. Renders a labelled placeholder only;
// no metrics fetch or charts yet. The content ticket replaces the body.
export function NodePerformanceTab({ nodeName: _nodeName, active: _active }: NodePerformanceTabProps) {
    return (
        <Paper variant="outlined" sx={{ p: 3 }} data-test-id="perf-node-stub">
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Performance
            </Typography>
            <Typography color="text.secondary">
                Performance metrics coming soon.
            </Typography>
        </Paper>
    );
}
